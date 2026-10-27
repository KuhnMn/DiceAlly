import { Injectable, OnDestroy, effect, inject, signal } from '@angular/core';
import { AccountService } from '../../auth/account.service';
import { APP_RUNTIME_CONFIG } from '../../app.tokens';
import { AccountCharacterRepository } from '../account-character-repository';
import { CharacterLibraryService } from '../character-library.service';
import { CharacterRecord } from '../character-repository';
import { FirebaseCharacterCloud } from './firebase-character-cloud';
import { CharacterSyncEngine } from './character-sync-engine';
import { AccountSettingsService } from '../../settings/account-settings.service';

@Injectable({ providedIn: 'root' })
export class CharacterSyncService implements OnDestroy {
  readonly settings = inject(AccountSettingsService);
  private readonly account = inject(AccountService);
  private readonly config = inject(APP_RUNTIME_CONFIG).firebase;
  private readonly repository = inject(AccountCharacterRepository);
  private readonly library = inject(CharacterLibraryService);
  readonly busy = signal(false);
  readonly pending = signal(0);
  readonly conflicts = signal<CharacterRecord[]>([]);
  readonly error = signal('');
  readonly lastChecked = signal('');
  readonly lastSuccessfulSync = signal<number | null>(null);
  readonly initialReady = signal(false);
  private running?: Promise<void>;
  private rerun = false;
  private readonly cleanedShareOwners = new Set<string>();
  private readonly interval = typeof window === 'undefined' ? undefined : setInterval(() => void this.sync(), 60_000);
  private readonly online = () => void this.sync();

  constructor() {
    if (typeof window !== 'undefined') window.addEventListener('online', this.online);
    effect(() => {
      const accessible = this.account.accessible();
      this.account.user();
      this.repository.changed();
      if (accessible) void this.sync();
      else { this.lastSuccessfulSync.set(null); this.initialReady.set(false); this.conflicts.set([]); this.pending.set(0); this.lastChecked.set(''); this.error.set(''); }
    });
  }
  /** A direct sheet/editor URL must wait too, not just the library screen. Failures expose cached data with an error. */
  async ensureInitialSync() {
    while (this.account.accessible() && !this.initialReady()) await this.sync();
  }
  ngOnDestroy() {
    clearInterval(this.interval);
    if (typeof window !== 'undefined') window.removeEventListener('online', this.online);
  }
  private session() {
    const user = this.account.user();
    if (!user || !this.account.accessible() || !this.config) return;
    const active = () => this.account.user()?.uid === user.uid && this.account.accessible();
    const local = this.repository.current();
    const cloud = new FirebaseCharacterCloud(this.config.databaseURL, user.uid, () => user.getIdToken(), active);
    return { uid: user.uid, active, local, cloud, engine: new CharacterSyncEngine(local, cloud, active) };
  }
  sync(): Promise<void> {
    if (this.running) { this.rerun = true; return this.running; }
    this.running = this.run().finally(() => {
      this.running = undefined;
      if (this.rerun) { this.rerun = false; void this.sync(); }
    });
    return this.running;
  }
  private async run() {
    const session = this.session();
    if (!session) return;
    this.busy.set(true);
    this.error.set('');
    try {
      await this.settings.sync();
      const execute = async () => {
        if (!session.active()) return;
        const result = await session.engine.run();
        if (session.active() && !this.cleanedShareOwners.has(session.uid)) {
          try {
            await session.cloud.shares.cleanupLegacy();
            if (session.active()) this.cleanedShareOwners.add(session.uid);
          } catch (error) {
            result.errors.push(`Old share cleanup failed: ${error instanceof Error ? error.message : String(error)}`);
          }
        }
        if (!session.active()) return;
        this.pending.set(result.pending);
        this.conflicts.set(result.conflicts);
        this.error.set([...new Set(result.errors)].join(' '));
        this.lastChecked.set(new Date().toLocaleTimeString());
        if (!result.errors.length && !result.pending && !result.conflicts.length && !this.settings.error() && !this.settings.pending()) {
          this.lastSuccessfulSync.set(Date.now());
        }
        if (result.changed || result.conflicts.length) this.library.notifyStoredChange();
      };
      // Serialize sync across tabs; server revision rules remain authoritative on all browsers/devices.
      if (typeof navigator !== 'undefined' && navigator.locks) await navigator.locks.request(`dice-ally-sync-${session.uid}`, execute);
      else await execute();
    } catch (error) {
      if (session.active()) {
        this.error.set(error instanceof Error ? error.message : 'Sync failed. Local changes are retained.');
        const rows = await session.local.listAll();
        if (session.active()) {
          this.pending.set(rows.filter(row => row.version !== row.syncedVersion).length);
          this.conflicts.set(rows.filter(row => row.conflict));
        }
      }
    } finally {
      if (session.active()) this.initialReady.set(true);
      this.busy.set(false);
    }
  }
  async resolve(id: string, choice: 'local' | 'cloud' | 'both') {
    if (this.busy()) return;
    const session = this.session();
    if (!session) return;
    this.busy.set(true);
    try {
      await session.engine.resolve(id, choice);
      this.library.notifyStoredChange();
    } catch (error) { this.error.set(String(error)); }
    finally { this.busy.set(false); }
    await this.sync();
  }
}
