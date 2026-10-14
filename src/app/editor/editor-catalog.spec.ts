import { vi } from 'vitest';
import { IndexedDbContentCache } from '../content/content-cache';
import { ContentRecord, ImportRevision } from '../content/content.model';
import { CatalogQuery, EditorCatalog } from './editor-catalog';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
}

const query: CatalogQuery = { kinds: ['spell'], search: '', includes: () => true };
type SearchPage = Awaited<ReturnType<IndexedDbContentCache['searchCategory']>>;

describe('Shared editor catalog', () => {
  afterEach(() => vi.useRealTimers());

  it('ignores older search results without clearing the newer results or loading state', async () => {
    const cache = new IndexedDbContentCache();
    const catalog = new EditorCatalog(cache);
    catalog.revision.set({ id: 'revision' } as ImportRevision);
    const old = deferred<SearchPage>(); const latest = deferred<SearchPage>();
    vi.spyOn(cache, 'searchCategory').mockReturnValueOnce(old.promise).mockReturnValueOnce(latest.promise);
    const first = catalog.search(query);
    const second = catalog.search({ ...query, search: 'Light' });
    old.resolve({ records: [], total: 99 }); await first;
    expect(catalog.total()).toBe(0); expect(catalog.loading()).toBe(true);
    latest.resolve({ records: [{ name: 'Light' } as ContentRecord], total: 1 }); await second;
    expect(catalog.results()[0].name).toBe('Light');
    expect(catalog.total()).toBe(1); expect(catalog.loading()).toBe(false);
  });

  it('debounces typing and pages the current query with one shared page size', async () => {
    vi.useFakeTimers();
    const cache = new IndexedDbContentCache(); const catalog = new EditorCatalog(cache);
    catalog.revision.set({ id: 'revision' } as ImportRevision);
    const search = vi.spyOn(cache, 'searchCategory').mockResolvedValue({ records: [], total: 0 });
    catalog.offset = 60;
    catalog.scheduleSearch(() => ({ ...query, search: 'L' }));
    catalog.scheduleSearch(() => ({ ...query, search: 'Light' }));
    await vi.advanceTimersByTimeAsync(200);
    expect(search).toHaveBeenCalledTimes(1);
    expect(search.mock.calls[0].slice(2, 5)).toEqual(['Light', 0, 30]);
    await catalog.nextPage(1, query);
    expect(search.mock.calls[1].slice(3, 5)).toEqual([30, 30]);
    catalog.dispose();
  });

  it('does not publish a refresh response after the editor has been destroyed', async () => {
    const cache = new IndexedDbContentCache(); const catalog = new EditorCatalog(cache);
    const source = deferred<undefined>();
    vi.spyOn(cache, 'savedSource').mockReturnValue(source.promise);
    vi.spyOn(cache, 'revisions').mockResolvedValue([]);
    const refresh = catalog.refresh('No import', () => query);
    catalog.dispose(); source.resolve(undefined); await refresh;
    expect(catalog.message()).toBe(''); expect(catalog.revision()).toBeNull();
  });
});
