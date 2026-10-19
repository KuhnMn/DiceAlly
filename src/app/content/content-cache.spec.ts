import 'fake-indexeddb/auto';
import { IndexedDbContentCache } from './content-cache';
import { ContentRecord, DEFAULT_CONTENT_SOURCE, ImportRevision, sourceIdentity } from './content.model';

function revision(namespace: string): ImportRevision {
  return { id: crypto.randomUUID(), namespace, source: DEFAULT_CONTENT_SOURCE,
    sourceIdentity: sourceIdentity(DEFAULT_CONTENT_SOURCE), commit: 'a'.repeat(40), adapterVersion: 1,
    createdAt: new Date().toISOString(), status: 'staging', files: [], diagnostics: [],
    metrics: { bytes: 0, records: 0, elapsedMs: 0, mappedBytes: 0 } };
}
function row(index: number): ContentRecord {
  return { key: String(index).padStart(5, '0'), kind: 'class', name: `Synthetic ${index}`, publication: 'TEST', file: 'test.json', data: {}, links: [] };
}
describe('IndexedDB content cache', () => {
  it('ranks matches across cursor pages and categories before pagination, retaining filters and totals', async () => {
    const cache = new IndexedDbContentCache(), imported = revision('search-ranking');
    const records: ContentRecord[] = [
      ...Array.from({ length: 65 }, (_, i) => ({ ...row(i), name: `Ascended Longsword ${i}` })),
      { ...row(900), kind: 'item', name: 'Longsword' },
      { ...row(901), kind: 'item', name: 'Longsword +1' },
      { ...row(902), kind: 'item', name: 'Longsword Ward' },
      { ...row(903), kind: 'item', name: 'Dagger', publication: 'Longsword' },
      { ...row(904), kind: 'item', name: 'Longsword', publication: 'HIDDEN' },
    ];
    await cache.stage(imported); await cache.put(imported.id, records);
    const allowed = (record: ContentRecord) => record.publication !== 'HIDDEN';
    const first = await cache.searchCategory(imported.id, ['class', 'item'], ' Longsword ', 0, 2, allowed);
    const second = await cache.searchCategory(imported.id, ['class', 'item'], 'longsword', 2, 2, allowed);
    const all = await cache.searchCategory(imported.id, ['class', 'item'], 'longsword', 0, 100, allowed);
    expect(first.total).toBe(69); expect(second.total).toBe(69);
    expect(first.records.map(record => record.name)).toEqual(['Longsword', 'Longsword +1']);
    expect(second.records[0].name).toBe('Longsword Ward');
    expect([...first.records, ...second.records]).toEqual(all.records.slice(0, 4));
    expect(all.records.at(-1)!.name).toBe('Dagger');
    expect(await cache.searchCategory(imported.id, ['class', 'item'], 'longsword', 0, 0, allowed)).toEqual({ records: [], total: 69 });
    const browse = await cache.searchCategory(imported.id, ['class', 'item'], '', 0, 2, allowed);
    expect(browse.records.map(record => record.key)).toEqual([row(0).key, row(1).key]);
  });
  function lockManager(): LockManager {
    const held = new Set<string>();
    return { request: async (name: string, _options: LockOptions, callback: (lock: Lock | null) => Promise<unknown>) => {
      if (held.has(name)) return callback(null);
      held.add(name);
      try { return await callback({ name, mode: 'exclusive' } as Lock); }
      finally { held.delete(name); }
    } } as unknown as LockManager;
  }
  it('recovers abandoned staging across cache instances without deleting ready or other-account content', async () => {
    const locks = lockManager(); const cache = new IndexedDbContentCache(locks);
    const active = revision('recover'); const retained = revision('recover'); const orphan = revision('recover'); const other = revision('recover-other');
    for (const r of [retained, active, orphan, other]) { await cache.stage(r); await cache.put(r.id, [row(1)]); }
    await cache.activate(retained); await cache.activate(active);
    const reopened = new IndexedDbContentCache(locks);
    expect(await reopened.recover('recover')).toBe(1);
    expect(await reopened.get(orphan.id, row(1).key)).toBeUndefined();
    expect(await reopened.get(retained.id, row(1).key)).toBeDefined();
    expect(await reopened.get(other.id, row(1).key)).toBeDefined();
    expect((await reopened.active('recover', DEFAULT_CONTENT_SOURCE))?.id).toBe(active.id);
    expect(await reopened.recover('recover')).toBe(0);
  });
  it('refuses cleanup/deletion/another import while the account importer holds its lock', async () => {
    const locks = lockManager(); const importer = new IndexedDbContentCache(locks); const otherTab = new IndexedDbContentCache(locks);
    const r = revision('live-lock');
    let release!: () => void; let started!: () => void;
    const entered = new Promise<void>(resolve => { started = resolve; });
    const held = new Promise<void>(resolve => { release = resolve; });
    const importing = importer.withImport('live-lock', async () => { await importer.stage(r); await importer.put(r.id, [row(2)]); started(); await held; });
    await entered;
    try {
      await expect(otherTab.recover('live-lock')).rejects.toThrow('another tab');
      await expect(otherTab.deleteRevision('live-lock', r.id)).rejects.toThrow('another tab');
      await expect(otherTab.withImport('live-lock', async () => {})).rejects.toThrow('another tab');
      expect(await otherTab.get(r.id, row(2).key)).toBeDefined();
      expect(await otherTab.recover('different-account')).toBe(0);
    } finally { release(); await importing; }
    expect(await otherTab.recover('live-lock')).toBe(1);
  });
  it('deletes only inactive owned content and guards active revisions for every source', async () => {
    const cache = new IndexedDbContentCache(lockManager());
    const old = revision('manage'); const active = revision('manage'); const branch = revision('manage');
    branch.source = { ...DEFAULT_CONTENT_SOURCE, branch: 'custom' };
    branch.sourceIdentity = sourceIdentity(branch.source);
    for (const r of [old, active, branch]) { await cache.stage(r); await cache.put(r.id, [row(3)]); await cache.activate(r); }
    const entries = await cache.revisions('manage');
    expect(entries.filter(e => e.active).map(e => e.revision.id).sort()).toEqual([active.id, branch.id].sort());
    expect(entries.every(e => e.storedRecords === 1)).toBe(true);
    await expect(cache.deleteRevision('manage-other', old.id)).rejects.toThrow('this account');
    await expect(cache.deleteRevision('manage', active.id)).rejects.toThrow('inactive');
    await expect(cache.discard(branch.id)).rejects.toThrow('inactive');
    await expect(cache.discard(old.id)).rejects.toThrow('staging');
    await cache.deleteRevision('manage', old.id);
    expect(await cache.get(old.id, row(3).key)).toBeUndefined();
    expect((await cache.revisions('manage')).length).toBe(2);
    expect(await cache.get(active.id, row(3).key)).toBeDefined();
  });
  it('recovers staging before the next import and releases its lock after failures', async () => {
    const cache = new IndexedDbContentCache(lockManager()); const orphan = revision('retry-lock'); await cache.stage(orphan);
    await expect(cache.withImport('retry-lock', async () => {
      expect(await cache.revisions('retry-lock')).toEqual([]); throw new Error('Synthetic failure');
    })).rejects.toThrow('Synthetic failure');
    expect(await cache.withImport('retry-lock', async () => 'retried')).toBe('retried');
  });
  it('fails safely when exclusive locking is unavailable', async () => {
    const cache = new IndexedDbContentCache(undefined); const r = revision('no-locks'); await cache.stage(r);
    await expect(cache.recover('no-locks')).rejects.toThrow('Web Locks');
    expect((await cache.revisions('no-locks'))[0].revision.id).toBe(r.id);
  });
  it('keeps staging private to its revision and switches the pointer atomically', async () => {
    const cache = new IndexedDbContentCache();
    const old = revision('atomic'); await cache.stage(old); await cache.activate(old);
    const staging = revision('atomic'); await cache.stage(staging); await cache.put(staging.id, [row(1)]);
    expect((await cache.active('atomic', DEFAULT_CONTENT_SOURCE))?.id).toBe(old.id);
    await cache.activate(staging);
    expect((await cache.active('atomic', DEFAULT_CONTENT_SOURCE))?.id).toBe(staging.id);
    expect((await cache.get(staging.id, row(1).key))?.name).toBe('Synthetic 1');
  });
  it('does not change the active pointer when activation is cancelled', async () => {
    const cache = new IndexedDbContentCache(); const old = revision('cancel');
    await cache.stage(old); await cache.activate(old);
    const staging = revision('cancel'); await cache.stage(staging);
    const controller = new AbortController(); controller.abort();
    await expect(cache.activate(staging, controller.signal)).rejects.toThrow();
    await cache.discard(staging.id);
    expect((await cache.active('cancel', DEFAULT_CONTENT_SOURCE))?.id).toBe(old.id);
  });
  it('isolates source preferences and active revisions by namespace', async () => {
    const cache = new IndexedDbContentCache(); const one = revision('alice'); const two = revision('bob');
    await cache.stage(one); await cache.stage(two); await cache.activate(one); await cache.activate(two);
    const custom = { ...DEFAULT_CONTENT_SOURCE, branch: 'custom' };
    await cache.saveSource('alice', custom); await cache.saveSource('bob', DEFAULT_CONTENT_SOURCE);
    expect((await cache.savedSource('alice'))?.branch).toBe('custom');
    expect((await cache.savedSource('bob'))?.branch).toBe('main');
    expect((await cache.active('alice', DEFAULT_CONTENT_SOURCE))?.id).toBe(one.id);
    expect((await cache.active('bob', DEFAULT_CONTENT_SOURCE))?.id).toBe(two.id);
  });
  it('visits more than one page while records are updated and discards only the requested revision', async () => {
    const cache = new IndexedDbContentCache(); const a = revision('pages'); const b = revision('pages');
    await cache.stage(a); await cache.stage(b);
    await cache.put(a.id, Array.from({ length: 270 }, (_, i) => row(i)));
    await cache.put(b.id, [row(999)]);
    let visited = 0;
    await cache.visit(a.id, async record => { visited++; await cache.put(a.id, [{ ...record, links: [{ role: 'test', target: 'synthetic' }] }]); });
    expect(visited).toBe(270);
    expect((await cache.category(a.id, 'class', 300))).toHaveLength(270);
    await cache.discard(a.id);
    expect(await cache.get(a.id, row(0).key)).toBeUndefined();
    expect(await cache.get(b.id, row(999).key)).toBeDefined();
  });
});
