import 'fake-indexeddb/auto';
import { TestBed } from '@angular/core/testing';
import { convertToParamMap, provideRouter } from '@angular/router';
import { vi } from 'vitest';
import { IndexedDbContentCache } from '../content/content-cache';
import { ADAPTER_VERSION, ContentRecord, DEFAULT_CONTENT_SOURCE, ImportRevision, sourceIdentity } from '../content/content.model';
import { CompendiumSearchComponent } from './compendium-search.component';
import { compendiumDestination, requestedSourceBooks } from './compendium-navigation';

const record = (kind: string, name: string, source: string): ContentRecord => ({ key: JSON.stringify([kind, name, source]), kind, name, publication: source, file: 'test.json', data: {}, links: [] });

describe('Compendium-wide search', () => {
  let cache: IndexedDbContentCache, revision: ImportRevision;
  beforeEach(async () => {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    const source = { ...DEFAULT_CONTENT_SOURCE, owner: crypto.randomUUID() };
    revision = { id: crypto.randomUUID(), namespace: 'development-local', source, sourceIdentity: sourceIdentity(source), commit: 'a'.repeat(40), adapterVersion: ADAPTER_VERSION, status: 'staging', createdAt: new Date().toISOString(), files: [], diagnostics: [], metrics: { bytes: 0, records: 0, mappedBytes: 0, elapsedMs: 0 } };
    cache = new IndexedDbContentCache(); await cache.stage(revision);
  });
  afterEach(() => vi.restoreAllMocks());

  function setup(sources: string[] = [], compact = false) {
    const fixture = TestBed.createComponent(CompendiumSearchComponent);
    fixture.componentRef.setInput('revision', revision); fixture.componentRef.setInput('sources', sources); fixture.componentRef.setInput('compact', compact); fixture.detectChanges();
    return { fixture, search: fixture.componentInstance };
  }

  it('closes compact results outside the header or with Escape and restores them on focus', async () => {
    await cache.put(revision.id, [record('feat', 'Shared Feat', 'XPHB')]);
    const { fixture, search } = setup([], true);
    search.setQuery('Shared'); fixture.detectChanges(); await search.search(); fixture.detectChanges();
    const results = () => fixture.nativeElement.querySelector('[aria-label="All Compendium search results"]');
    expect(results()).not.toBeNull();
    document.body.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true })); fixture.detectChanges();
    expect(results()).toBeNull(); expect(search.query()).toBe('Shared');
    const input = fixture.nativeElement.querySelector('input') as HTMLInputElement;
    input.dispatchEvent(new Event('focus')); fixture.detectChanges(); expect(results()).not.toBeNull();
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); fixture.detectChanges(); expect(results()).toBeNull();
    fixture.destroy();
  });

  it('searches multiple categories, filters by books, and carries exact record identities in navigable result links', async () => {
    const entries = [record('spell', 'Shared Spell', 'XPHB'), record('feat', 'Shared Feat', 'XPHB'), record('table', 'Shared Table', 'XDMG'), record('spell', 'Shared Spell', 'PHB')];
    await cache.put(revision.id, entries);
    const { fixture, search } = setup(['XPHB']);
    search.query.set('Shared'); fixture.detectChanges(); await search.search(); fixture.detectChanges();
    expect(search.total()).toBe(2); expect(search.results().map(entry => entry.kind).sort()).toEqual(['feat', 'spell']);
    const links = [...fixture.nativeElement.querySelectorAll('a')] as HTMLAnchorElement[];
    expect(links).toHaveLength(2);
    for (const link of links) {
      const url = new URL(link.href);
      expect(['/compendium/feat', '/compendium/spell']).toContain(url.pathname);
      expect(JSON.parse(url.searchParams.get('books')!)).toEqual(['XPHB']);
      expect(entries.some(entry => entry.key === url.searchParams.get('entry'))).toBe(true);
    }
    fixture.componentRef.setInput('sources', []); fixture.detectChanges(); await search.search();
    expect(search.total()).toBe(4);
    const subclass = record('subclass', 'School', 'TCE'), destination = compendiumDestination(subclass, []);
    expect(destination.commands).toEqual(['/compendium', 'class']); expect(destination.queryParams.entry).toBe(subclass.key);
    expect(compendiumDestination(record('baseitem', 'Rope', 'XPHB'), []).commands).toEqual(['/compendium', 'reference']);
    expect(requestedSourceBooks(convertToParamMap(destination.queryParams))).toEqual([]);
    expect(requestedSourceBooks(convertToParamMap({ books: '{invalid' }))).toBeNull();
    expect(requestedSourceBooks(convertToParamMap({ books: '[3]' }))).toBeNull();
    fixture.destroy();
  });

  it('filters before paging and starts at the first page after source changes', async () => {
    await cache.put(revision.id, [
      ...Array.from({ length: 25 }, (_, index) => record('spell', 'Paged ' + index.toString().padStart(2, '0'), 'XPHB')),
      ...Array.from({ length: 25 }, (_, index) => record('spell', 'Paged ' + index.toString().padStart(2, '0'), 'PHB')),
    ]);
    const { fixture, search } = setup(['XPHB']);
    search.query.set('Paged'); fixture.detectChanges(); await search.search();
    expect(search.total()).toBe(25); expect(search.results()).toHaveLength(12); expect(search.results().every(entry => entry.publication === 'XPHB')).toBe(true);
    await search.turnPage(1); expect(search.offset).toBe(12); expect(search.results()[0].name).toBe('Paged 12');
    fixture.componentRef.setInput('sources', ['PHB']); fixture.detectChanges(); await search.search();
    expect(search.offset).toBe(0); expect(search.total()).toBe(25); expect(search.results().every(entry => entry.publication === 'PHB')).toBe(true);
    fixture.destroy();
  });

  it('discards stale responses after the query or source selection changes and reports read failures', async () => {
    const included = record('feat', 'New Choice', 'XPHB'); await cache.put(revision.id, [included]);
    const { fixture, search } = setup(['PHB']);
    search.query.set('Old'); fixture.detectChanges();
    let resolve!: (page: { records: ContentRecord[]; total: number }) => void;
    const reads = vi.spyOn(IndexedDbContentCache.prototype, 'searchCategory').mockImplementationOnce(() => new Promise(done => { resolve = done; }));
    const pending = search.search();
    search.query.set('New'); fixture.componentRef.setInput('sources', ['XPHB']); fixture.detectChanges(); await search.search();
    resolve({ records: [record('spell', 'Old Choice', 'PHB')], total: 99 }); await pending;
    expect(search.results()).toEqual([expect.objectContaining({ key: included.key })]); expect(search.total()).toBe(1);
    reads.mockRejectedValueOnce(new Error('Read failure')); await search.search(); fixture.detectChanges();
    expect(search.error()).toContain('Could not search'); expect(fixture.nativeElement.querySelector('[role="alert"]')).not.toBeNull();
    fixture.destroy();
  });
});
