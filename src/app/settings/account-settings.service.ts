import { Injectable, OnDestroy, effect, inject, signal } from '@angular/core';
import { APP_RUNTIME_CONFIG } from '../app.tokens';
import { AccountService } from '../auth/account.service';
import { Theme, ThemeService } from '../services/theme.service';
import { SourceBookFilterService } from '../editor/source-book-filter.service';
import { AccountSetting, SettingsCache, SETTING_KEYS, SettingKey, validSetting, acknowledgeSetting } from './account-settings';

/** Small preferences sync independently: changing a theme never overwrites the Source Books selection. */
@Injectable({ providedIn: 'root' })
export class AccountSettingsService implements OnDestroy {
  private readonly account = inject(AccountService);
  private readonly config = inject(APP_RUNTIME_CONFIG).firebase;
  private readonly theme = inject(ThemeService);
  private readonly books = inject(SourceBookFilterService);
  readonly error = signal('');
  readonly busy = signal(false);
  readonly pending = signal(0);
  private uid = '';
  private cache: SettingsCache = {};
  private observed = { theme: '', sourceBooks: '' };
  private running?: Promise<void>;
  private rerun = false;
  private readonly reconnect = () => void this.sync();
  private readonly interval = typeof window === 'undefined' ? undefined : setInterval(this.reconnect, 60_000);

  constructor() {
    if (typeof window !== 'undefined') window.addEventListener('online', this.reconnect);
    effect(() => {
      const uid = this.account.accessible() ? this.account.user()?.uid ?? '' : '';
      const theme = this.theme.currentTheme();
      const sourceBooks = this.books.selected();
      if (uid !== this.uid) {
        this.activate(uid);
        if (uid) void this.sync();
        return;
      }
      if (!uid) return;
      const values = { theme: JSON.stringify(theme), sourceBooks: JSON.stringify([...sourceBooks].sort()) };
      let changed = false;
      for (const key of SETTING_KEYS) {
        if (values[key] === this.observed[key]) continue;
        const setting = { value: values[key], mutationId: crypto.randomUUID(), pending: true };
        if (!validSetting(key, setting)) { this.error.set('Preference exceeds the supported settings limits.'); continue; }
        this.cache[key] = setting;
        this.observed[key] = values[key];
        changed = true;
      }
      if (changed) { this.persist(); void this.sync(); }
    });
  }
  ngOnDestroy() {
    clearInterval(this.interval);
    if (typeof window !== 'undefined') window.removeEventListener('online', this.reconnect);
  }
  private activate(uid: string) {
    this.uid = uid;
    this.cache = {};
    this.error.set('');
    if (uid) {
      try {
        const stored = JSON.parse(localStorage.getItem(`dice-ally-settings-${uid}`) ?? '{}');
        for (const key of SETTING_KEYS) {
          const value = stored[key];
          if (validSetting(key, value)) this.cache[key] = { ...value, pending: Reflect.get(value, 'pending') === true };
        }
        // Preserve this device's pre-sync preferences once, without copying account A into account B.
        if (!localStorage.getItem('dice-ally-settings-first-account')) {
          this.cache.theme ??= { value: JSON.stringify(this.theme.currentTheme()), mutationId: crypto.randomUUID(), pending: false };
          this.cache.sourceBooks ??= { value: JSON.stringify(this.books.selected()), mutationId: crypto.randomUUID(), pending: false };
          localStorage.setItem('dice-ally-settings-first-account', uid);
        }
      } catch { /* Use defaults when local preferences are unavailable. */ }
    }
    this.apply();
    this.pending.set(Object.values(this.cache).filter(value => value?.pending).length);
    if (uid) this.persist();
  }
  private apply() {
    this.observed = { theme: this.cache.theme?.value ?? '"dark-mc"', sourceBooks: this.cache.sourceBooks?.value ?? '[]' };
    this.theme.setTheme(JSON.parse(this.observed.theme) as Theme);
    this.books.setSelection(JSON.parse(this.observed.sourceBooks) as string[]);
  }
  private persist() {
    this.pending.set(Object.values(this.cache).filter(value => value?.pending).length);
    try { localStorage.setItem(`dice-ally-settings-${this.uid}`, JSON.stringify(this.cache)); }
    catch { this.error.set('Preferences could not be saved on this device. Keep the page open until settings sync succeeds.'); }
  }
  sync(): Promise<void> {
    if (this.running) {
      this.rerun = true;
      return this.running.then(async () => { if (this.running) await this.running; });
    }
    this.running = this.run().finally(() => {
      this.running = undefined;
      if (this.rerun) { this.rerun = false; void this.sync(); }
    });
    return this.running;
  }
  private async run() {
    const user = this.account.user();
    if (!user || !this.account.accessible() || !this.config) return;
    if (this.uid !== user.uid) this.activate(user.uid);
    const uid = user.uid;
    const active = () => this.uid === uid && this.account.user()?.uid === uid && this.account.accessible();
    this.busy.set(true);
    this.error.set('');
    try {
      const request = async (path: string, setting?: AccountSetting) => {
        const token = await user.getIdToken();
        if (!active()) throw new Error('Account changed.');
        const url = `${this.config!.databaseURL.replace(/\/$/, '')}/users/${encodeURIComponent(uid)}/settings${path}.json?auth=${encodeURIComponent(token)}${setting ? '&print=silent' : ''}`;
        const response = await fetch(url, { method: setting ? 'PUT' : 'GET', cache: 'no-store',
          headers: { 'Content-Type': 'application/json' }, body: setting ? JSON.stringify(setting) : undefined,
          signal: AbortSignal.timeout(20_000) });
        if (!response.ok) throw new Error('Settings sync failed. Publish the latest database rules and check your connection.');
        return response;
      };
      const remote = await (await request('')).json() as Partial<Record<SettingKey, unknown>> | null;
      if (!active()) return;
      for (const key of SETTING_KEYS) {
        const value = remote?.[key];
        if (value != null && !validSetting(key, value)) throw new Error(`Invalid cloud setting: ${key}.`);
        if (this.cache[key]?.pending) continue;
        if (value) this.cache[key] = { ...value as AccountSetting, pending: false };
        else if (this.cache[key]) this.cache[key] = { ...this.cache[key]!, mutationId: crypto.randomUUID(), pending: true };
      }
      this.apply();
      this.persist();
      for (const key of SETTING_KEYS) {
        const current = this.cache[key];
        if (!current?.pending || !active()) continue;
        const uploaded = { value: current.value, mutationId: current.mutationId };
        if (!validSetting(key, remote?.[key]) || remote![key].mutationId !== uploaded.mutationId) {
          await request(`/${key}`, uploaded);
        }
        if (!active()) return;
        acknowledgeSetting(this.cache, key, uploaded);
        this.persist();
      }
    } catch (error) { if (active()) this.error.set(error instanceof Error ? error.message : 'Settings sync failed.'); }
    finally { this.busy.set(false); }
  }
}
