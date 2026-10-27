import type { CharacterCloud, CloudCharacter, CloudCharacterMeta } from './character-cloud';
import { validateMeta } from './character-cloud';
import { FirebaseDatabaseClient } from './firebase-database-client';
import { FirebaseCharacterShares } from './firebase-character-shares';

/** Only metadata is read during routine checks. Whole documents travel when content actually changes. */
export class FirebaseCharacterCloud implements CharacterCloud {
  private readonly database: FirebaseDatabaseClient;
  readonly shares: FirebaseCharacterShares;
  constructor(baseUrl: string, private readonly uid: string,
    token: () => Promise<string>, active: () => boolean) {
    this.database = new FirebaseDatabaseClient(baseUrl, token, active);
    this.shares = new FirebaseCharacterShares(this.database, uid);
  }

  private async request(path: string, init?: RequestInit, shallow = false) {
    return this.database.request(`users/${encodeURIComponent(this.uid)}/characters${path}`, init, shallow ? { shallow: 'true' } : {});
  }
  async ids() {
    const value = await (await this.request('', undefined, true)).json();
    return value ? Object.keys(value) : [];
  }
  async meta(id: string): Promise<CloudCharacterMeta | null> {
    const value: unknown = await (await this.request(`/${encodeURIComponent(id)}/meta`)).json();
    return value === null ? null : validateMeta(value);
  }
  async read(id: string): Promise<CloudCharacter | null> {
    return (await this.request(`/${encodeURIComponent(id)}`)).json();
  }
  async write(id: string, record: CloudCharacter) {
    if (record.meta.deleted) {
      await this.database.update({
        [`users/${this.uid}/characters/${id}`]: record,
        ...await this.shares.deletionUpdates(id),
      });
      return;
    }
    // Rules enforce revision = previous revision + 1 atomically at this exact character path.
    await this.request(`/${encodeURIComponent(id)}`, { method: 'PUT',
      headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(record) });
  }
}
