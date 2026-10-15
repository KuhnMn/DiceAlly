import { Injectable, inject, signal } from '@angular/core';
import { AccountService } from '../auth/account.service';
import { IndexedDbCharacterRepository } from './indexeddb-character-repository';
import type { CharacterRepository } from './character-repository';
import type { ExportedCharacter } from '../models/character.model';

/** Resolve the account for every operation so signing out cannot expose another account's cache. */
@Injectable({ providedIn: 'root' })
export class AccountCharacterRepository implements CharacterRepository {
  private readonly account = inject(AccountService);
  private readonly repositories = new Map<string, IndexedDbCharacterRepository>();
  readonly changed = signal(0);
  current() {
    const user = this.account.user();
    if (!user || !this.account.accessible()) throw new Error('Sign in with an approved account first.');
    let repository = this.repositories.get(user.uid);
    if (!repository) {
      repository = new IndexedDbCharacterRepository(`dice-ally-account-${user.uid}`);
      this.repositories.set(user.uid, repository);
    }
    return repository;
  }
  list() { return this.current().list(); }
  get(id: string) { return this.current().get(id); }
  async save(sheet: ExportedCharacter, expectedVersion: number) {
    const version = await this.current().save(sheet, expectedVersion);
    this.changed.update(value => value + 1);
    return version;
  }
  async delete(id: string, expectedVersion: number) {
    await this.current().delete(id, expectedVersion);
    this.changed.update(value => value + 1);
  }
}
