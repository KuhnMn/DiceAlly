import 'fake-indexeddb/auto';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { AccountService } from '../auth/account.service';
import { emptyBasicCharacter } from '../editor/basic-info';
import { AccountCharacterRepository } from './account-character-repository';

describe('Account character cache', () => {
  it('isolates accounts and refuses access after sign-out or approval removal', async () => {
    const first = crypto.randomUUID();
    const second = crypto.randomUUID();
    const user = signal<{ uid: string } | null>({ uid: first });
    const accessible = signal(true);
    TestBed.configureTestingModule({ providers: [
      { provide: AccountService, useValue: { user, accessible } },
    ] });
    const repository = TestBed.inject(AccountCharacterRepository);
    const sheet = emptyBasicCharacter();
    const id = sheet.character!.characterUuid!;
    await repository.save(sheet, 0);
    user.set({ uid: second });
    expect(await repository.get(id)).toBeUndefined();
    expect(await repository.list()).toEqual([]);
    user.set({ uid: first });
    expect((await repository.get(id))?.version).toBe(1);
    accessible.set(false);
    expect(() => repository.get(id)).toThrow('approved account');
    user.set(null);
    expect(() => repository.list()).toThrow('approved account');
  });
});
