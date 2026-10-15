import { TestBed } from '@angular/core/testing';
import { Router, UrlTree, provideRouter } from '@angular/router';
import { AccountService } from './account.service';
import { requireApprovedAccount } from './account.guard';
import { CharacterSyncService } from '../characters/sync/character-sync.service';

describe('Approved account guard', () => {
  it('waits for initial character synchronization before allowing a sheet to open', async () => {
    let finish!: () => void;
    const initial = new Promise<void>(resolve => { finish = resolve; });
    TestBed.configureTestingModule({ providers: [provideRouter([]),
      { provide: CharacterSyncService, useValue: { ensureInitialSync: () => initial } },
      { provide: AccountService, useValue: { ready: Promise.resolve(), accessible: () => true } },
    ] });
    let opened = false;
    const navigation = Promise.resolve(TestBed.runInInjectionContext(() => requireApprovedAccount({} as never, {} as never)))
      .then(result => { opened = true; return result; });
    await Promise.resolve();
    await Promise.resolve();
    expect(opened).toBe(false);
    finish();
    expect(await navigation).toBe(true);
  });
  for (const approved of [false, true]) {
    it(approved ? 'allows approved accounts' : 'redirects unapproved accounts', async () => {
      TestBed.configureTestingModule({ providers: [provideRouter([]),
        { provide: CharacterSyncService, useValue: { ensureInitialSync: async () => undefined } }, {
        provide: AccountService, useValue: { ready: Promise.resolve(), accessible: () => approved },
      }] });
      const result = await TestBed.runInInjectionContext(() => requireApprovedAccount({} as never, {} as never));
      if (approved) expect(result).toBe(true);
      else expect(TestBed.inject(Router).serializeUrl(result as UrlTree)).toBe('/login');
    });
  }
});
