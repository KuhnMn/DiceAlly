import { emptyBasicCharacter } from '../editor/basic-info';
import { independentCharacter, parseShareCode } from './character-sharing.service';
import { CharacterSharingService } from './character-sharing.service';
import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { afterEach, vi } from 'vitest';
import { AccountService } from '../auth/account.service';
import { APP_RUNTIME_CONFIG } from '../app.tokens';

describe('Database character sharing', () => {
  it('normalizes complete share codes and rejects old temporary codes', () => {
    expect(parseShareCode('ABCDEF-012345-ABCDEF-012345')).toBe('abcdef012345abcdef012345');
    expect(parseShareCode('123456')).toBeNull();
    expect(parseShareCode('../users/alice')).toBeNull();
  });
  it('imports an independent copy without changing the shared snapshot', () => {
    const sheet = emptyBasicCharacter();
    sheet.notes = [{ id: 1, title: 'Notes', body: 'Keep me' }];
    const first = independentCharacter(sheet), second = independentCharacter(sheet);
    expect(first.character!.characterUuid).not.toBe(sheet.character!.characterUuid);
    expect(second.character!.characterUuid).not.toBe(first.character!.characterUuid);
    first.notes![0].body = 'Changed';
    expect(sheet.notes![0].body).toBe('Keep me');
    expect(second.notes![0].body).toBe('Keep me');
  });
});

describe('Share-code requests', () => {
  afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

  function setup(fetcher: ReturnType<typeof vi.fn>) {
    const user = signal<{ uid: string; getIdToken: () => Promise<string> } | null>({ uid: 'alice', getIdToken: async () => 'test-token' });
    const account = { user, accessible: () => user() !== null };
    TestBed.configureTestingModule({ providers: [
      { provide: AccountService, useValue: account },
      { provide: APP_RUNTIME_CONFIG, useValue: { firebase: { databaseURL: 'https://database.example.test' } } },
    ] });
    vi.stubGlobal('fetch', fetcher);
    return { account, service: TestBed.inject(CharacterSharingService) };
  }

  for (const skew of [-7 * 86400000, 7 * 86400000]) {
    it(`creates and redeems an intact independent snapshot with a ${skew < 0 ? 'slow' : 'fast'} device clock`, async () => {
      const serverTime = Date.now();
      let shared: Record<string, unknown> | undefined;
      const fetcher = vi.fn(async (_url: string, init?: RequestInit) => {
        if (init?.method === 'PUT') {
          const uploaded = JSON.parse(init.body as string);
          expect(uploaded.createdAt).toEqual({ '.sv': 'timestamp' });
          expect(uploaded.expiresAt).toBeUndefined();
          shared = { ...uploaded, createdAt: serverTime };
          return new Response(null, { status: 204 });
        }
        return new Response(JSON.stringify(shared), { status: 200 });
      });
      const { account, service } = setup(fetcher);
      vi.spyOn(Date, 'now').mockReturnValue(serverTime + skew);
      const sheet = emptyBasicCharacter();
      sheet.notes = [{ id: 1, title: 'Keep', body: 'Authored notes' }];
      const code = await service.create(sheet);
      expect(code).toMatch(/^[A-F0-9]{6}(-[A-F0-9]{6}){3}$/);
      account.user.set({ uid: 'bob', getIdToken: async () => 'recipient-token' });
      const imported = await service.redeem(code);
      expect(imported.character!.characterUuid).not.toBe(sheet.character!.characterUuid);
      expect(imported.notes).toEqual(sheet.notes);
      expect(JSON.parse((shared!['character'] as { body: string }).body).character.characterUuid).toBe(sheet.character!.characterUuid);
    });
  }

  it('continues decoding legacy codes without checking expiry against the device clock', async () => {
    const sheet = emptyBasicCharacter();
    const { encodeCloudCharacter } = await import('./sync/character-cloud');
    const createdAt = Date.now();
    const character = await encodeCloudCharacter({ id: sheet.character!.characterUuid!, sheet, version: 0, updatedAt: new Date().toISOString() }, 1);
    const { service } = setup(vi.fn().mockResolvedValue(new Response(JSON.stringify({ characterId: sheet.character!.characterUuid, createdAt, expiresAt: createdAt + 86400000, character }))));
    vi.spyOn(Date, 'now').mockReturnValue(createdAt + 7 * 86400000);
    expect((await service.redeem('a'.repeat(24))).character!.name).toBe(sheet.character!.name);
  });

  it('reports the HTTP status for denied creation and distinguishes service failures', async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(new Response('{"error":"Permission denied"}', { status: 401 }))
      .mockResolvedValueOnce(new Response('Unavailable', { status: 503 }));
    const { service } = setup(fetcher);
    await expect(service.create(emptyBasicCharacter())).rejects.toThrow('Firebase denied the share-code request (HTTP 401)');
    await expect(service.create(emptyBasicCharacter())).rejects.toThrow('Share-code request failed (HTTP 503)');
  });

  it('keeps denied or expired codes unavailable', async () => {
    const { service } = setup(vi.fn().mockResolvedValue(new Response('{"error":"Permission denied"}', { status: 401 })));
    await expect(service.redeem('a'.repeat(24))).rejects.toThrow('invalid, expired, revoked, or unavailable');
  });
});
