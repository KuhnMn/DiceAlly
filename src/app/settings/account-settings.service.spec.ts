import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { APP_RUNTIME_CONFIG } from '../app.tokens';
import { AccountService } from '../auth/account.service';
import { SourceBookFilterService } from '../editor/source-book-filter.service';
import { Theme, ThemeService } from '../services/theme.service';
import { AccountSettingsService } from './account-settings.service';
import { AccountSetting, acknowledgeSetting, validSetting } from './account-settings';

describe('Account settings synchronization', () => {
  afterEach(() => { vi.unstubAllGlobals(); TestBed.resetTestingModule(); });
  it('syncs theme and Source Books changes independently and isolates account preferences', async () => {
    localStorage.clear();
    const user = signal({ uid: 'alice', getIdToken: async () => 'token' });
    const currentTheme = signal<Theme>('light-mc');
    const selected = signal<string[]>([]);
    const remote: Record<string, Record<string, AccountSetting>> = { alice: {}, bob: {} };
    const writes: string[] = [];
    vi.stubGlobal('fetch', vi.fn(async (input: string, options: RequestInit) => {
      const url = new URL(input);
      const parts = url.pathname.split('/');
      const uid = parts[2];
      if (options.method === 'PUT') {
        const key = parts[4].replace('.json', '');
        remote[uid][key] = JSON.parse(String(options.body));
        writes.push(`${uid}/${key}`);
        return new Response(null, { status: 204 });
      }
      return new Response(JSON.stringify(remote[uid]), { status: 200 });
    }));
    TestBed.configureTestingModule({ providers: [
      { provide: APP_RUNTIME_CONFIG, useValue: { firebase: { databaseURL: 'https://test.invalid' } } },
      { provide: AccountService, useValue: { user, accessible: () => true } },
      { provide: ThemeService, useValue: { currentTheme, setTheme: (value: Theme) => currentTheme.set(value) } },
      { provide: SourceBookFilterService, useValue: { selected, setSelection: (value: string[]) => selected.set(value) } },
    ] });
    const service = TestBed.inject(AccountSettingsService);
    TestBed.tick(); await service.sync();
    writes.length = 0;
    selected.set(['XPHB', 'PHB']);
    TestBed.tick(); await service.sync();
    expect(JSON.parse(remote['alice']['sourceBooks'].value)).toEqual(['PHB', 'XPHB']);
    expect(writes).not.toContain('alice/theme');
    currentTheme.set('dark-forge');
    TestBed.tick(); await service.sync();
    expect(JSON.parse(remote['alice']['theme'].value)).toBe('dark-forge');
    expect(service.pending()).toBe(0);
    selected.set([]); TestBed.tick(); await service.sync();
    expect(remote['alice']['sourceBooks'].value).toBe('[]');
    user.set({ uid: 'bob', getIdToken: async () => 'token' });
    TestBed.tick(); await service.sync();
    expect(currentTheme()).toBe('light-mc');
    expect(selected()).toEqual([]);
    expect(remote['bob']).toEqual({});
    remote['bob']['sourceBooks'] = { value: '["HB"]', mutationId: crypto.randomUUID() };
    await service.sync();
    expect(selected()).toEqual(['HB']);
    user.set({ uid: 'alice', getIdToken: async () => 'token' });
    TestBed.tick(); await service.sync();
    expect(currentTheme()).toBe('dark-forge');
    expect(selected()).toEqual([]);
  });

  it('validates settings and does not acknowledge a newer edit using an old response', () => {
    const old = { value: '[]', mutationId: crypto.randomUUID() };
    const current = { value: '["PHB"]', mutationId: crypto.randomUUID(), pending: true };
    const cache = { sourceBooks: current };
    acknowledgeSetting(cache, 'sourceBooks', old);
    expect(cache.sourceBooks.pending).toBe(true);
    acknowledgeSetting(cache, 'sourceBooks', current);
    expect(cache.sourceBooks.pending).toBe(false);
    expect(validSetting('sourceBooks', old)).toBe(true);
    expect(validSetting('sourceBooks', { ...old, value: '[1]' })).toBe(false);
    expect(validSetting('theme', { ...old, value: '"nonexistent-theme"' })).toBe(false);
  });
});

