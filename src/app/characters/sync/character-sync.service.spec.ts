import { TestBed } from '@angular/core/testing';
import { computed, signal } from '@angular/core';
import { vi } from 'vitest';
import { AccountService } from '../../auth/account.service';
import { APP_RUNTIME_CONFIG } from '../../app.tokens';
import { AccountSettingsService } from '../../settings/account-settings.service';
import { AccountCharacterRepository } from '../account-character-repository';
import { CharacterLibraryService } from '../character-library.service';
import { CharacterSyncService } from './character-sync.service';
import { CharacterSyncEngine } from './character-sync-engine';
import { FirebaseCharacterShares } from './firebase-character-shares';

describe('Legacy share cleanup during synchronization', () => {
  afterEach(() => vi.restoreAllMocks());

  function setup() {
    const user = signal<{ uid: string; getIdToken: () => Promise<string> } | null>(null);
    const account = { user, accessible: computed(() => !!user()) };
    const engine = vi.spyOn(CharacterSyncEngine.prototype, 'run').mockImplementation(async () => ({ changed: true, pending: 0, conflicts: [], errors: [] }));
    const cleanup = vi.spyOn(FirebaseCharacterShares.prototype, 'cleanupLegacy').mockResolvedValue();
    const library = { notifyStoredChange: vi.fn() };
    TestBed.configureTestingModule({ providers: [
      { provide: AccountService, useValue: account },
      { provide: APP_RUNTIME_CONFIG, useValue: { firebase: { databaseURL: 'https://database.example.test' } } },
      { provide: AccountSettingsService, useValue: { sync: async () => {}, error: signal(''), pending: signal(0) } },
      { provide: AccountCharacterRepository, useValue: { changed: signal(0), current: () => ({ listAll: async () => [] }) } },
      { provide: CharacterLibraryService, useValue: library },
    ] });
    const service = TestBed.inject(CharacterSyncService); TestBed.tick();
    const signIn = (uid: string) => { user.set({ uid, getIdToken: async () => 'test-token' }); TestBed.tick(); };
    return { service, engine, cleanup, library, signIn };
  }

  it('automatically cleans each signed-in owner once per session and retains normal sync behavior', async () => {
    const f = setup(); f.signIn('alice');
    await vi.waitFor(() => expect(f.service.lastSuccessfulSync()).not.toBeNull());
    expect(f.cleanup).toHaveBeenCalledTimes(1); expect(f.library.notifyStoredChange).toHaveBeenCalled();
    await f.service.sync();
    expect(f.cleanup).toHaveBeenCalledTimes(1);
    f.signIn('bob');
    await vi.waitFor(() => expect(f.cleanup).toHaveBeenCalledTimes(2));
    await vi.waitFor(() => expect(f.service.busy()).toBe(false));
  });

  it('reports a failed cleanup, continues character sync, and retries cleanup on the next sync', async () => {
    const f = setup(); f.cleanup.mockRejectedValueOnce(new Error('Network unavailable'));
    f.signIn('alice');
    await vi.waitFor(() => expect(f.service.error()).toContain('Old share cleanup failed'));
    expect(f.library.notifyStoredChange).toHaveBeenCalled();
    await f.service.sync();
    expect(f.cleanup).toHaveBeenCalledTimes(2);
    expect(f.service.error()).toBe(''); expect(f.service.lastSuccessfulSync()).not.toBeNull();
  });
});
