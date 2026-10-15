import 'fake-indexeddb/auto';
import { vi } from 'vitest';
import { emptyBasicCharacter } from '../../editor/basic-info';
import { IndexedDbCharacterRepository } from '../indexeddb-character-repository';
import { CharacterSyncEngine } from './character-sync-engine';
import { CharacterCloud, CloudCharacter, decodeCloudCharacter, encodeCloudCharacter } from './character-cloud';

class MemoryCloud implements CharacterCloud {
  rows = new Map<string, CloudCharacter>();
  reads = 0;
  writes = 0;
  failAfterWrite = false;
  async ids() { return [...this.rows.keys()]; }
  async meta(id: string) { return structuredClone(this.rows.get(id)?.meta ?? null); }
  async read(id: string) { this.reads++; return structuredClone(this.rows.get(id) ?? null); }
  async write(id: string, row: CloudCharacter) {
    if (row.meta.revision !== (this.rows.get(id)?.meta.revision ?? 0) + 1) throw new Error('Stale revision');
    this.rows.set(id, structuredClone(row)); this.writes++;
    if (this.failAfterWrite) throw new Error('Response lost');
  }
}
function cache() { return new IndexedDbCharacterRepository(`sync-test-${crypto.randomUUID()}`); }

describe('Character synchronization', () => {
  it('uploads complete JSON, downloads on another device, and skips unchanged bodies', async () => {
    const first = cache(), second = cache(), cloud = new MemoryCloud();
    const sheet = emptyBasicCharacter();
    const id = sheet.character!.characterUuid!;
    sheet.notes = [{ id: 1, title: 'Notes', body: 'x'.repeat(1_200_000) }];
    await first.save(sheet, 0);
    expect((await new CharacterSyncEngine(first, cloud).run()).pending).toBe(0);
    const engine = new CharacterSyncEngine(second, cloud);
    expect((await engine.run()).changed).toBe(true);
    expect((await second.get(id))!.sheet).toEqual(sheet);
    const reads = cloud.reads;
    await engine.run();
    expect(cloud.reads).toBe(reads);
    expect(cloud.writes).toBe(1);
  });

  it('retains conflicts across reload and keeps both versions when requested', async () => {
    const first = cache(), second = cache(), cloud = new MemoryCloud();
    const sheet = emptyBasicCharacter(), id = sheet.character!.characterUuid!;
    await first.save(sheet, 0);
    const a = new CharacterSyncEngine(first, cloud), b = new CharacterSyncEngine(second, cloud);
    await a.run(); await b.run();
    const local = structuredClone(sheet); local.character!.name = 'Device A';
    const remote = structuredClone(sheet); remote.character!.name = 'Device B';
    await first.save(local, 1); await second.save(remote, 1);
    await a.run();
    expect((await b.run()).conflicts).toHaveLength(1);
    expect((await second.get(id))!.sheet.character!.name).toBe('Device B');
    const reloaded = new CharacterSyncEngine(second, cloud);
    expect((await reloaded.run()).conflicts).toHaveLength(1);
    await reloaded.resolve(id, 'both');
    await reloaded.run();
    expect((await second.list()).map(row => row.sheet.character!.name).sort()).toEqual(['Device A', 'Device B (Local Copy)']);
    expect(cloud.rows.size).toBe(2);
  });

  it('recognizes a committed write when its response is lost', async () => {
    const local = cache(), cloud = new MemoryCloud();
    await local.save(emptyBasicCharacter(), 0);
    cloud.failAfterWrite = true;
    expect((await new CharacterSyncEngine(local, cloud).run()).pending).toBe(0);
    await new CharacterSyncEngine(local, cloud).run();
    expect(cloud.writes).toBe(1);
  });

  it('preserves an edit made while a previous version is uploading', async () => {
    const local = cache(), cloud = new MemoryCloud();
    const sheet = emptyBasicCharacter(), id = sheet.character!.characterUuid!;
    await local.save(sheet, 0);
    const write = cloud.write.bind(cloud);
    vi.spyOn(cloud, 'write').mockImplementationOnce(async (key, row) => {
      const edited = structuredClone(sheet); edited.character!.name = 'Newer edit';
      await local.save(edited, 1);
      await write(key, row);
    });
    const engine = new CharacterSyncEngine(local, cloud);
    expect((await engine.run()).pending).toBe(1);
    expect((await engine.run()).pending).toBe(0);
    expect(JSON.parse(cloud.rows.get(id)!.body).character.name).toBe('Newer edit');
  });

  it('turns simultaneous cloud deletion and local editing into a conflict', async () => {
    const first = cache(), second = cache(), cloud = new MemoryCloud();
    const sheet = emptyBasicCharacter(), id = sheet.character!.characterUuid!;
    await first.save(sheet, 0);
    const a = new CharacterSyncEngine(first, cloud), b = new CharacterSyncEngine(second, cloud);
    await a.run(); await b.run();
    await first.delete(id, 1);
    await second.save(sheet, 1);
    await a.run();
    expect((await b.run()).conflicts[0].conflict!.deleted).toBe(true);
    await b.resolve(id, 'local'); await b.run();
    expect(cloud.rows.get(id)!.meta.deleted).toBe(false);
  });

  it('retains pending work after network failure and rejects corrupt bodies and embedded images', async () => {
    const local = cache(), cloud = new MemoryCloud();
    const sheet = emptyBasicCharacter(), id = sheet.character!.characterUuid!;
    await local.save(sheet, 0);
    vi.spyOn(cloud, 'write').mockRejectedValueOnce(new Error('Offline'));
    expect((await new CharacterSyncEngine(local, cloud).run()).pending).toBe(1);
    expect((await new CharacterSyncEngine(local, cloud).run()).pending).toBe(0);
    const encoded = await encodeCloudCharacter((await local.get(id))!, 2);
    await expect(decodeCloudCharacter(id, { ...encoded, body: '{}' })).rejects.toThrow('integrity');
    sheet.portaitUrl = 'data:image/png;base64,abc';
    await local.save(sheet, 1);
    const result = await new CharacterSyncEngine(local, cloud).run();
    expect(result.pending).toBe(1);
    expect(result.errors[0]).toContain('external image URLs');
  });
});
