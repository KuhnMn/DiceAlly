import 'fake-indexeddb/auto';
import { vi } from 'vitest';
import { IndexedDbContentCache } from './content-cache';
import { BrowseSummaryBuilder, ensureBrowseSummary } from './content-browse-summary';
import { mapContent } from './content-adapter';
import { DEFAULT_CONTENT_SOURCE, ImportRevision, sourceIdentity } from './content.model';
import { finalizeContentImport } from './content-finalizer';

function revision(): ImportRevision {
  return { id: crypto.randomUUID(), namespace: 'summary-tests', source: DEFAULT_CONTENT_SOURCE,
    sourceIdentity: sourceIdentity(DEFAULT_CONTENT_SOURCE), commit: 'a'.repeat(40), adapterVersion: 1,
    createdAt: new Date().toISOString(), status: 'staging', files: [], diagnostics: [],
    metrics: { bytes: 0, records: 0, elapsedMs: 0, mappedBytes: 0 } };
}
const records = () => mapContent({ spell: [
  { name: 'Light', source: 'XPHB', level: 0, school: 'V', entries: ['Light.'] },
  { name: 'Shield', source: 'PHB', level: 1, school: 'A', entries: ['Shield.'] },
], subclass: [{ name: 'School of Magic', shortName: 'Magic', source: 'TCE', className: 'Wizard', classSource: 'PHB' }],
baseitem: [{ name: 'Rope', source: 'PHB', type: 'G' }] }, 'fixtures.json').records;

describe('Compendium browsing summaries', () => {
  afterEach(() => vi.restoreAllMocks());
  it('summarizes facets, base items and subclass sources without storing descriptions', () => {
    const builder = new BrowseSummaryBuilder('revision'); records().forEach(record => builder.add(record));
    const summary = builder.build();
    expect(summary.counts).toEqual({ spell: 2, subclass: 1, baseitem: 1 });
    expect(summary.sources).toEqual(['PHB', 'TCE', 'XPHB']);
    expect(summary.facets['spell']).toMatchObject({ source: ['PHB', 'XPHB'], level: ['0', '1'], school: ['A', 'V'] });
    expect(Object.values(summary.subclassSources)).toEqual([['TCE']]);
    expect(JSON.stringify(summary)).not.toContain('Shield.');
  });
  it('shares a legacy backfill and reuses persisted metadata across cache instances', async () => {
    const cache = new IndexedDbContentCache(), imported = revision();
    await cache.stage(imported); await cache.put(imported.id, records());
    const visit = vi.spyOn(IndexedDbContentCache.prototype, 'visit');
    const [first, second] = await Promise.all([ensureBrowseSummary(cache, imported.id), ensureBrowseSummary(new IndexedDbContentCache(), imported.id)]);
    expect(first).toEqual(second); expect(visit).toHaveBeenCalledTimes(1);
    expect(await ensureBrowseSummary(new IndexedDbContentCache(), imported.id)).toEqual(first);
    expect(visit).toHaveBeenCalledTimes(1);
    const other = revision(); await cache.stage(other);
    expect((await ensureBrowseSummary(cache, other.id)).counts).toEqual({});
    await cache.put(imported.id, mapContent({ feat: [{ name: 'Alert', source: 'HB', entries: ['Alert.'] }] }, 'homebrew/test.json').records);
    expect(await cache.getBrowseSummary(imported.id)).toBeUndefined();
    expect((await ensureBrowseSummary(cache, imported.id)).sources).toContain('HB');
    await cache.discard(imported.id);
    expect(await cache.getBrowseSummary(imported.id)).toBeUndefined();
  });
  it('can retry a failed backfill', async () => {
    const cache = new IndexedDbContentCache(), imported = revision(); await cache.stage(imported);
    const visit = vi.spyOn(cache, 'visit').mockRejectedValueOnce(new Error('Read failed'));
    await expect(ensureBrowseSummary(cache, imported.id)).rejects.toThrow('Read failed');
    expect((await ensureBrowseSummary(cache, imported.id)).counts).toEqual({});
    expect(visit).toHaveBeenCalledTimes(2);
  });
  it('builds metadata during import finalization, before the first compendium visit', async () => {
    const cache = new IndexedDbContentCache(), imported = revision();
    await cache.stage(imported);
    await cache.put(imported.id, records().filter(record => record.kind === 'spell'));
    await finalizeContentImport(cache, imported, { bytes: 0, started: performance.now() });
    const visit = vi.spyOn(cache, 'visit');
    expect((await ensureBrowseSummary(cache, imported.id)).counts).toEqual({ spell: 2 });
    expect(visit).not.toHaveBeenCalled();
  });
});
