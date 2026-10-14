import { signal } from '@angular/core';
import { IndexedDbContentCache } from '../content/content-cache';
import { ContentRecord, ImportRevision } from '../content/content.model';
import { activeContentRevision } from './active-content-revision';

export interface CatalogQuery {
  kinds: string[];
  search: string;
  includes: (record: ContentRecord) => boolean;
}

/**
 * Shared catalog state, paging and asynchronous request handling.
 * Each editor supplies its own query and entry actions. The request counters ensure
 * that an old IndexedDB response cannot replace a newer search or a closed editor.
 */
export class EditorCatalog {
  readonly results = signal<ContentRecord[]>([]);
  readonly revision = signal<ImportRevision | null>(null);
  readonly total = signal(0);
  readonly loading = signal(false);
  readonly message = signal('');
  readonly pageSize = 30;
  offset = 0;
  private searchVersion = 0;
  private refreshVersion = 0;
  private searchInFlight = false;
  private timer?: ReturnType<typeof setTimeout>;

  constructor(private readonly cache: IndexedDbContentCache) {}

  resetSearch() {
    clearTimeout(this.timer);
    this.searchVersion++;
    this.searchInFlight = false;
    this.offset = 0;
    this.results.set([]);
    this.total.set(0);
    this.loading.set(false);
  }

  /** Delay typing-driven queries, while immediately invalidating the previous response. */
  scheduleSearch(query: () => CatalogQuery) {
    this.resetSearch();
    this.timer = setTimeout(() => void this.search(query()), 200);
  }

  async search(query: CatalogQuery) {
    clearTimeout(this.timer);
    const revision = this.revision();
    if (!revision) return;
    const version = ++this.searchVersion;
    this.searchInFlight = true;
    this.loading.set(true);
    try {
      const page = await this.cache.searchCategory(
        revision.id, query.kinds, query.search, this.offset, this.pageSize, query.includes,
      );
      if (version !== this.searchVersion) return;
      this.results.set(page.records);
      this.total.set(page.total);
      this.message.set('');
    } catch (error) {
      if (version === this.searchVersion) this.message.set(String(error));
    } finally {
      if (version === this.searchVersion) {
        this.searchInFlight = false;
        this.loading.set(false);
      }
    }
  }

  /** Optional preparation loads editor-specific metadata, such as available spell classes. */
  async refresh(
    emptyMessage: string,
    query: () => CatalogQuery,
    prepare?: (revision: ImportRevision, isCurrent: () => boolean) => Promise<void>,
  ) {
    const version = ++this.refreshVersion;
    const isCurrent = () => version === this.refreshVersion;
    this.resetSearch();
    this.loading.set(true);
    try {
      const revision = await activeContentRevision(this.cache);
      if (!isCurrent()) return;
      this.revision.set(revision ?? null);
      if (!revision) {
        this.message.set(emptyMessage);
        return;
      }
      await prepare?.(revision, isCurrent);
      if (isCurrent()) await this.search(query());
    } catch (error) {
      if (isCurrent()) this.message.set(String(error));
    } finally {
      if (isCurrent() && !this.searchInFlight) this.loading.set(false);
    }
  }

  nextPage(direction: number, query: CatalogQuery) {
    this.offset = Math.max(0, this.offset + direction * this.pageSize);
    return this.search(query);
  }

  dispose() {
    clearTimeout(this.timer);
    this.searchVersion++;
    this.refreshVersion++;
  }
}
