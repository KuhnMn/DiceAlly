import { Injectable, inject } from '@angular/core';
import { AccountService } from '../auth/account.service';
import { APP_RUNTIME_CONFIG } from '../app.tokens';
import { ExportedCharacter } from '../models/character.model';
import { normalizeCharacterEditorIdentity } from '../editor/editor-identity';
import { decodeCloudCharacter, encodeCloudCharacter } from './sync/character-cloud';

export function parseShareCode(input: string): string | null {
  const code = input.trim().replace(/[-\s]/g, '').toLowerCase();
  return /^[a-f0-9]{24}$/.test(code) ? code : null;
}
export function independentCharacter(sheet: ExportedCharacter): ExportedCharacter {
  const copy = structuredClone(sheet);
  copy.character!.characterUuid = crypto.randomUUID();
  return normalizeCharacterEditorIdentity(copy);
}

/** Codes grant approved users access to a frozen snapshot, never the sender's private character path. */
@Injectable({ providedIn: 'root' })
export class CharacterSharingService {
  private readonly account = inject(AccountService);
  private readonly config = inject(APP_RUNTIME_CONFIG).firebase;

  private async request(code: string, options?: RequestInit) {
    const user = this.account.user();
    if (!user || !this.account.accessible() || !this.config) throw new Error('Sign in with an approved account to share characters.');
    const token = await user.getIdToken();
    if (this.account.user()?.uid !== user.uid || !this.account.accessible()) throw new Error('Account changed. Try again.');
    const url = `${this.config.databaseURL.replace(/\/$/, '')}/characterShares/${code}.json?auth=${encodeURIComponent(token)}${options ? '&print=silent' : ''}`;
    const response = await fetch(url, { ...options, cache: 'no-store', signal: AbortSignal.timeout(30_000) });
    if (!response.ok) throw new Error(options ? 'Could not create or revoke the share code. Publish the latest database rules and try again.' : 'This share code is invalid, expired, revoked, or unavailable to your account.');
    if (this.account.user()?.uid !== user.uid || !this.account.accessible()) throw new Error('Account changed. Try again.');
    return response;
  }
  async create(sheet: ExportedCharacter): Promise<string> {
    const ownerUid = this.account.user()?.uid;
    if (!ownerUid || !this.account.accessible()) throw new Error('An approved account is required.');
    const character = await encodeCloudCharacter({ id: sheet.character!.characterUuid!, sheet, version: 0, updatedAt: new Date().toISOString() }, 1);
    const code = Array.from(crypto.getRandomValues(new Uint8Array(12)), byte => byte.toString(16).padStart(2, '0')).join('');
    const createdAt = Date.now();
    await this.request(code, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ownerUid,
      characterId: sheet.character!.characterUuid, createdAt, expiresAt: createdAt + 24 * 60 * 60 * 1000, character }) });
    return code.match(/.{6}/g)!.join('-').toUpperCase();
  }
  async redeem(input: string): Promise<ExportedCharacter> {
    const recipientUid = this.account.user()?.uid;
    const code = parseShareCode(input);
    if (!code) throw new Error('Enter the complete share code (four groups of six characters).');
    const shared = await (await this.request(code)).json();
    if (!shared || typeof shared.characterId !== 'string' || typeof shared.expiresAt !== 'number' || shared.expiresAt <= Date.now()) throw new Error('This share code has expired or is unavailable.');
    const record = await decodeCloudCharacter(shared.characterId, shared.character);
    if (this.account.user()?.uid !== recipientUid || !this.account.accessible()) throw new Error('Account changed. Try importing again.');
    return independentCharacter(record.sheet);
  }
  async revoke(input: string) {
    const code = parseShareCode(input);
    if (!code) throw new Error('Invalid share code.');
    await this.request(code, { method: 'DELETE' });
  }
}
