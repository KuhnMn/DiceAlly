import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { vi } from 'vitest';
import { emptyBasicCharacter } from '../editor/basic-info';
import { AccountService } from '../auth/account.service';
import { APP_RUNTIME_CONFIG } from '../app.tokens';
import { AccountCharacterRepository } from './account-character-repository';
import { CharacterRecord } from './character-repository';
import { CharacterSharingService, independentCharacter, parseShareCode } from './character-sharing.service';
import { CharacterSyncService } from './sync/character-sync.service';
import { encodeCloudCharacter } from './sync/character-cloud';
import { FirebaseCharacterCloud } from './sync/firebase-character-cloud';
import { FirebaseCharacterShares } from './sync/firebase-character-shares';
import { FirebaseDatabaseClient } from './sync/firebase-database-client';

describe('Permanent character sharing', () => {
  afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

  async function setup() {
    const sheet = emptyBasicCharacter(), id = sheet.character!.characterUuid!;
    sheet.notes = [{ id: 1, title: 'Notes', body: 'Keep me' }];
    const local: CharacterRecord = { id, sheet, version: 1, syncedVersion: 1, updatedAt: new Date().toISOString() };
    const database = new Map<string, unknown>([[`users/alice/characters/${id}`, await encodeCloudCharacter(local, 1)]]);
    const user = signal<{ uid: string; getIdToken: () => Promise<string> } | null>({ uid: 'alice', getIdToken: async () => 'alice-token' });
    const account = { user, accessible: () => user() !== null };
    const sync = { sync: vi.fn(async () => {}) };
    const fetcher = vi.fn(async (input: string, init?: RequestInit) => {
      const url = new URL(input), path = decodeURIComponent(url.pathname.slice(1, -5));
      if (init?.method === 'PATCH') {
        const changes = JSON.parse(init.body as string) as Record<string, unknown>;
        if (Object.entries(changes).some(([key, value]) => key.startsWith('characterCodes/') && value !== null && database.has(key))) {
          return new Response('Permission denied', { status: 403 });
        }
        for (const [key, value] of Object.entries(changes)) {
          if (value === null) database.delete(key); else database.set(key, value);
        }
        return new Response(null, { status: 204 });
      }
      if (path === 'characterShares') {
        const owner = JSON.parse(url.searchParams.get('equalTo')!);
        const shares = [...database].filter(([key, value]) => key.startsWith('characterShares/') && (value as { ownerUid: string }).ownerUid === owner)
          .slice(0, 10).map(([key, value]) => [key.split('/')[1], value]);
        return new Response(JSON.stringify(shares.length ? Object.fromEntries(shares) : null));
      }
      return new Response(JSON.stringify(database.get(path) ?? null));
    });
    vi.stubGlobal('fetch', fetcher);
    TestBed.configureTestingModule({ providers: [
      { provide: AccountService, useValue: account },
      { provide: APP_RUNTIME_CONFIG, useValue: { firebase: { databaseURL: 'https://database.example.test' } } },
      { provide: AccountCharacterRepository, useValue: { get: async () => local } },
      { provide: CharacterSyncService, useValue: sync },
    ] });
    const client = new FirebaseDatabaseClient('https://database.example.test', () => Promise.resolve('alice-token'), () => user()?.uid === 'alice');
    return { sheet, id, local, database, account, sync, fetcher, client, service: TestBed.inject(CharacterSharingService) };
  }

  it('normalizes short spoken codes, excludes ambiguous characters, and rejects retired codes', () => {
    expect(parseShareCode(' k7m-p4r ')).toBe('K7MP4R');
    expect(parseShareCode('K7M P4R')).toBe('K7MP4R');
    expect(parseShareCode('O0I1AB')).toBeNull();
    expect(parseShareCode('ABCDEF-012345-ABCDEF-012345')).toBeNull();
    expect(parseShareCode('../users/alice')).toBeNull();
  });

  it('keeps imported copies independent of their source and one another', () => {
    const sheet = emptyBasicCharacter(); sheet.notes = [{ id: 1, title: 'Notes', body: 'Keep me' }];
    const first = independentCharacter(sheet), second = independentCharacter(sheet);
    expect(first.character!.characterUuid).not.toBe(sheet.character!.characterUuid);
    expect(second.character!.characterUuid).not.toBe(first.character!.characterUuid);
    first.notes![0].body = 'Changed';
    expect(sheet.notes![0].body).toBe('Keep me'); expect(second.notes![0].body).toBe('Keep me');
  });

  it('reuses the same short code on subsequent visits without uploading a duplicate character', async () => {
    const f = await setup();
    const code = await f.service.create(f.id);
    expect(code).toMatch(/^[A-HJ-NP-Z2-9]{3}-[A-HJ-NP-Z2-9]{3}$/);
    const reopened = TestBed.runInInjectionContext(() => new CharacterSharingService());
    expect(await reopened.create(f.id)).toBe(code);
    const links = [...f.database].filter(([key]) => key.startsWith('characterCodes/'));
    expect(links).toHaveLength(1);
    expect(links[0][1]).toEqual({ ownerUid: 'alice', characterId: f.id });
    expect([...f.database.keys()].filter(key => key.includes('/characters/'))).toHaveLength(1);
    expect(f.sync.sync).toHaveBeenCalledTimes(1);
  });

  it('resolves the latest synced version even long after code creation', async () => {
    const f = await setup(), code = await f.service.create(f.id);
    f.sheet.character!.name = 'Updated character';
    f.database.set(`users/alice/characters/${f.id}`, await encodeCloudCharacter(f.local, 2));
    vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 30 * 86400000);
    f.account.user.set({ uid: 'bob', getIdToken: async () => 'bob-token' });
    const imported = await f.service.redeem(code);
    expect(imported.character!.name).toBe('Updated character');
    expect(imported.character!.characterUuid).not.toBe(f.id);
    expect(imported.notes).toEqual(f.sheet.notes);
  });

  it('removes both directions of a revoked link while preserving the original character', async () => {
    const f = await setup(), code = await f.service.create(f.id);
    await f.service.revoke(code);
    expect(f.database.has(`characterCodes/${parseShareCode(code)}`)).toBe(false);
    expect(f.database.has(`users/alice/shareCodes/${f.id}`)).toBe(false);
    expect(f.database.has(`users/alice/characters/${f.id}`)).toBe(true);
    await expect(f.service.redeem(code)).rejects.toThrow('invalid or has been revoked');
  });

  it('retries a code collision instead of overwriting somebody else’s link', async () => {
    const f = await setup();
    f.database.set('characterCodes/AAAAAA', { ownerUid: 'bob', characterId: 'other' });
    let randomCalls = 0;
    vi.spyOn(crypto, 'getRandomValues').mockImplementation(((bytes: Uint8Array) => {
      bytes.fill(randomCalls++); return bytes;
    }) as Crypto['getRandomValues']);
    expect(await f.service.create(f.id)).toBe('BBB-BBB');
    expect(f.database.get('characterCodes/AAAAAA')).toEqual({ ownerUid: 'bob', characterId: 'other' });
  });

  it('uses a code created concurrently on another device rather than leaving a second link', async () => {
    const f = await setup();
    f.fetcher.mockImplementationOnce(async () => new Response('null'));
    f.fetcher.mockImplementationOnce(async () => new Response('null'));
    f.fetcher.mockImplementationOnce(async () => {
      f.database.set(`users/alice/shareCodes/${f.id}`, 'K7MP4R');
      f.database.set('characterCodes/K7MP4R', { ownerUid: 'alice', characterId: f.id });
      return new Response('Permission denied', { status: 403 });
    });
    expect(await f.service.create(f.id)).toBe('K7M-P4R');
    expect([...f.database.keys()].filter(key => key.startsWith('characterCodes/'))).toHaveLength(1);
  });

  it('atomically removes the code and owner index when synchronizing a character deletion', async () => {
    const f = await setup(), code = await f.service.create(f.id);
    const cloud = new FirebaseCharacterCloud('https://database.example.test', 'alice', () => Promise.resolve('alice-token'), () => true);
    f.local.deletedAt = new Date().toISOString();
    await cloud.write(f.id, await encodeCloudCharacter(f.local, 2));
    const deleted = f.database.get(`users/alice/characters/${f.id}`) as { body?: string; meta: { deleted: boolean } };
    expect(deleted.body).toBeUndefined(); expect(deleted.meta.deleted).toBe(true);
    expect(f.database.has(`characterCodes/${parseShareCode(code)}`)).toBe(false);
    expect(f.database.has(`users/alice/shareCodes/${f.id}`)).toBe(false);
    const lastWrite = f.fetcher.mock.calls.filter(([, init]) => init?.method === 'PATCH').at(-1)!;
    expect(Object.keys(JSON.parse(lastWrite[1]!.body as string))).toHaveLength(3);
  });

  it('cleans up old snapshots in batches without deleting another owner’s snapshots or any original characters', async () => {
    const f = await setup();
    for (let i = 0; i < 12; i++) f.database.set(`characterShares/${i.toString(16).padStart(24, '0')}`, { ownerUid: 'alice', character: 'old snapshot' });
    f.database.set(`characterShares/${'f'.repeat(24)}`, { ownerUid: 'bob', character: 'other snapshot' });
    await new FirebaseCharacterShares(f.client, 'alice').cleanupLegacy();
    expect([...f.database.keys()].filter(key => key.startsWith('characterShares/'))).toEqual([`characterShares/${'f'.repeat(24)}`]);
    expect(f.database.has(`users/alice/characters/${f.id}`)).toBe(true);
  });

  it('prevents publishing unsynced changes and conflicts', async () => {
    const f = await setup(); f.local.syncedVersion = undefined;
    await expect(f.service.create(f.id)).rejects.toThrow('Sync this character');
    expect([...f.database.keys()].some(key => key.startsWith('characterCodes/'))).toBe(false);
    f.local.syncedVersion = 1;
    f.local.conflict = { revision: 2, hash: 'a'.repeat(64), updatedAt: f.local.updatedAt, deleted: false, sheet: f.sheet };
    await expect(f.service.create(f.id)).rejects.toThrow('resolve any conflicts');
  });

  it('keeps an existing code available for revocation even when the character has unsynced edits', async () => {
    const f = await setup(), code = await f.service.create(f.id);
    f.local.syncedVersion = undefined;
    expect(await f.service.create(f.id)).toBe(code);
    await f.service.revoke(code);
    expect(f.database.has(`users/alice/shareCodes/${f.id}`)).toBe(false);
  });

  it('reports permission and service failures instead of treating them as collisions', async () => {
    const f = await setup();
    f.fetcher.mockResolvedValueOnce(new Response('Permission denied', { status: 401 }));
    await expect(f.service.create(f.id)).rejects.toThrow('HTTP 401');
    f.fetcher.mockResolvedValueOnce(new Response('Unavailable', { status: 503 }));
    await expect(f.service.create(f.id)).rejects.toThrow('HTTP 503');
    f.fetcher.mockResolvedValueOnce(new Response('Permission denied', { status: 403 }));
    await expect(f.service.redeem('K7M-P4R')).rejects.toThrow('revoked, deleted, or unavailable');
  });

  it('rejects a response after the account changes', async () => {
    const f = await setup();
    f.fetcher.mockImplementationOnce(async () => {
      f.account.user.set({ uid: 'bob', getIdToken: async () => 'bob-token' });
      return new Response(JSON.stringify({ ownerUid: 'alice', characterId: f.id }));
    });
    await expect(f.service.redeem('K7M-P4R')).rejects.toThrow('Account changed');
  });
});
