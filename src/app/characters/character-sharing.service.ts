import { Injectable, inject } from '@angular/core';
import { AccountService } from '../auth/account.service';
import { APP_RUNTIME_CONFIG } from '../app.tokens';
import { ExportedCharacter } from '../models/character.model';
import { normalizeCharacterEditorIdentity } from '../editor/editor-identity';
import { AccountCharacterRepository } from './account-character-repository';
import { formatShareCode, parseShareCode } from './character-share-codes';
import { decodeCloudCharacter, CloudCharacter } from './sync/character-cloud';
import { CharacterSyncService } from './sync/character-sync.service';
import { FirebaseCharacterShares } from './sync/firebase-character-shares';
import { FirebaseDatabaseClient, FirebaseDatabaseError } from './sync/firebase-database-client';

export { parseShareCode } from './character-share-codes';
export function independentCharacter(sheet: ExportedCharacter): ExportedCharacter {
  const copy = structuredClone(sheet);
  copy.character!.characterUuid = crypto.randomUUID();
  return normalizeCharacterEditorIdentity(copy);
}

/** Permanent codes resolve the owner's latest synced character without storing a second body. */
@Injectable({ providedIn: 'root' })
export class CharacterSharingService {
  private readonly account = inject(AccountService);
  private readonly config = inject(APP_RUNTIME_CONFIG).firebase;
  private readonly repository = inject(AccountCharacterRepository);
  private readonly sync = inject(CharacterSyncService);

  private session() {
    const user = this.account.user();
    if (!user || !this.account.accessible() || !this.config) throw new Error('Sign in with an approved account to share characters.');
    const database = new FirebaseDatabaseClient(this.config.databaseURL, () => user.getIdToken(),
      () => this.account.user()?.uid === user.uid && this.account.accessible());
    return { uid: user.uid, database, shares: new FirebaseCharacterShares(database, user.uid) };
  }
  async create(characterId: string): Promise<string> {
    const session = this.session();
    const existing = await session.shares.current(characterId);
    if (existing) return formatShareCode(existing);
    await this.sync.sync();
    if (this.account.user()?.uid !== session.uid || !this.account.accessible()) throw new Error('Account changed. Try again.');
    const record = await this.repository.get(characterId);
    if (!record || record.deletedAt) throw new Error('This character is no longer available.');
    if (record.conflict || record.version !== record.syncedVersion) throw new Error('Sync this character and resolve any conflicts before sharing it.');
    return session.shares.create(characterId);
  }
  async redeem(input: string): Promise<ExportedCharacter> {
    const code = parseShareCode(input);
    if (!code) throw new Error('Enter the six-character share code, for example K7M-P4R. Old 24-character codes have been replaced.');
    const session = this.session();
    try {
      const link = await session.shares.resolve(code);
      const value = await session.database.read(`users/${encodeURIComponent(link.ownerUid)}/characters/${encodeURIComponent(link.characterId)}`);
      if (!value) throw new Error('This shared character is no longer available.');
      const record = await decodeCloudCharacter(link.characterId, value as CloudCharacter);
      if (record.deletedAt) throw new Error('This shared character has been deleted.');
      if (this.account.user()?.uid !== session.uid || !this.account.accessible()) throw new Error('Account changed. Try importing again.');
      return independentCharacter(record.sheet);
    } catch (error) {
      if (error instanceof FirebaseDatabaseError && (error.status === 401 || error.status === 403)) {
        throw new Error('This share code is revoked, deleted, or unavailable to your account.');
      }
      throw error;
    }
  }
  async revoke(input: string) {
    const code = parseShareCode(input);
    if (!code) throw new Error('Invalid share code.');
    await this.session().shares.revoke(code);
  }
}
