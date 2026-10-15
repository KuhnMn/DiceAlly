import type { CharacterCloud, CloudCharacter, CloudCharacterMeta } from './character-cloud';
import { validateMeta } from './character-cloud';

/** Only metadata is read during routine checks. Whole documents travel when content actually changes. */
export class FirebaseCharacterCloud implements CharacterCloud {
  constructor(private readonly baseUrl: string, private readonly uid: string,
    private readonly token: () => Promise<string>, private readonly active: () => boolean) {}

  private async request(path: string, init?: RequestInit, shallow = false) {
    if (!this.active()) throw new Error('Account changed. Sync stopped.');
    const token = await this.token();
    if (!this.active()) throw new Error('Account changed. Sync stopped.');
    const url = `${this.baseUrl.replace(/\/$/, '')}/users/${encodeURIComponent(this.uid)}/characters${path}.json?auth=${encodeURIComponent(token)}${shallow ? '&shallow=true' : ''}${init?.method === 'PUT' ? '&print=silent' : ''}`;
    const response = await fetch(url, { ...init, cache: 'no-store', signal: AbortSignal.timeout(30_000) });
    if (!response.ok) throw new Error(response.status === 401 || response.status === 403
      ? 'Cloud access was denied or the revision changed. Check membership and publish the latest database rules, then retry.'
      : `Cloud request failed (HTTP ${response.status}). Local changes are retained.`);
    if (!this.active()) throw new Error('Account changed. Sync stopped.');
    return response;
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
    // Rules enforce revision = previous revision + 1 atomically at this exact character path.
    await this.request(`/${encodeURIComponent(id)}`, { method: 'PUT',
      headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(record) });
  }
}
