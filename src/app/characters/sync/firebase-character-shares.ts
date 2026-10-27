import { formatShareCode, generateShareCode, SHARE_CODE_PATTERN } from '../character-share-codes';
import { FirebaseDatabaseClient, FirebaseDatabaseError } from './firebase-database-client';

export interface CharacterShareLink { ownerUid: string; characterId: string; }

function shareLink(value: unknown): CharacterShareLink | null {
  if (!value || typeof value !== 'object') return null;
  const link = value as Partial<CharacterShareLink>;
  return typeof link.ownerUid === 'string' && typeof link.characterId === 'string'
    ? { ownerUid: link.ownerUid, characterId: link.characterId } : null;
}

/** One reversible link per character; the character body stays in its original account record. */
export class FirebaseCharacterShares {
  constructor(private readonly database: FirebaseDatabaseClient, private readonly uid: string) {}

  async current(characterId: string): Promise<string | null> {
    const code = await this.database.read(`users/${this.uid}/shareCodes/${characterId}`);
    if (code === null) return null;
    if (typeof code !== 'string' || !SHARE_CODE_PATTERN.test(code)) throw new Error('The saved share code is malformed.');
    return code;
  }

  async create(characterId: string): Promise<string> {
    const existing = await this.current(characterId);
    if (existing) return formatShareCode(existing);
    for (let attempt = 0; attempt < 5; attempt++) {
      const code = generateShareCode();
      try {
        await this.database.update({
          [`characterCodes/${code}`]: { ownerUid: this.uid, characterId },
          [`users/${this.uid}/shareCodes/${characterId}`]: code,
        });
        return formatShareCode(code);
      } catch (error) {
        if (!(error instanceof FirebaseDatabaseError) || (error.status !== 401 && error.status !== 403)) throw error;
        // Another device may have shared this character, or another character claimed this code.
        const winner = await this.current(characterId);
        if (winner) return formatShareCode(winner);
        if (!shareLink(await this.database.read(`characterCodes/${code}`))) throw error;
      }
    }
    throw new Error('Could not reserve a share code. Please try again.');
  }

  async resolve(code: string): Promise<CharacterShareLink> {
    const link = shareLink(await this.database.read(`characterCodes/${code}`));
    if (!link) throw new Error('This share code is invalid or has been revoked.');
    return link;
  }

  async revoke(code: string) {
    const value = await this.database.read(`characterCodes/${code}`);
    if (value === null) return;
    const link = shareLink(value);
    if (!link || link.ownerUid !== this.uid) throw new Error('Only the character owner can revoke this code.');
    await this.database.update({
      [`characterCodes/${code}`]: null,
      [`users/${this.uid}/shareCodes/${link.characterId}`]: null,
    });
  }

  async deletionUpdates(characterId: string): Promise<Record<string, null>> {
    const code = await this.current(characterId);
    return code ? { [`characterCodes/${code}`]: null, [`users/${this.uid}/shareCodes/${characterId}`]: null } : {};
  }

  async cleanupLegacy() {
    // New snapshot creation is disabled. Delete only this owner's old copies, in bounded batches.
    for (;;) {
      const shares = await this.database.read('characterShares', {
        orderBy: JSON.stringify('ownerUid'), equalTo: JSON.stringify(this.uid), limitToFirst: '10',
      });
      if (shares === null) return;
      if (typeof shares !== 'object' || Array.isArray(shares)) throw new Error('Legacy share cleanup returned invalid data.');
      const codes = Object.keys(shares);
      if (!codes.length) return;
      if (codes.some(code => !/^[a-f0-9]{24}$/.test(code))) throw new Error('An old share requires administrator cleanup.');
      await this.database.update(Object.fromEntries(codes.map(code => [`characterShares/${code}`, null])));
    }
  }
}
