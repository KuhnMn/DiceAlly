import { itemTypeCode } from './item.model';
import { compareSearchMatches } from '../search-ranking';
import { ContentRecord, ContentSource, ImportRevision, sourceIdentity } from './content.model';
import type { ContentBrowseSummary } from './content-browse-summary';

export interface ContentCache {
  stage(revision: ImportRevision): Promise<void>;
  put(revisionId: string, records: ContentRecord[]): Promise<void>;
  get(revisionId: string, key: string): Promise<ContentRecord | undefined>;
  visit(revisionId: string, visitor: (record: ContentRecord) => Promise<void>): Promise<void>;
  activate(revision: ImportRevision, signal?: AbortSignal): Promise<void>;
  discard(revisionId: string): Promise<void>;
  getBrowseSummary?(revisionId: string): Promise<ContentBrowseSummary | undefined>;
  saveBrowseSummary?(revisionId: string, summary: ContentBrowseSummary): Promise<void>;
}
export interface RevisionRemovalProgress {
  phase: 'checking' | 'deleting' | 'complete';
  records: number;
}
function request<T>(value: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    value.onsuccess = () => resolve(value.result);
    value.onerror = () => reject(value.error ?? new Error('IndexedDB request failed.'));
  });
}
function complete(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onabort = tx.onerror = () => reject(tx.error ?? new Error('Local cache transaction failed.'));
  });
}
export class IndexedDbContentCache implements ContentCache {
  constructor(private readonly locks = globalThis.navigator?.locks) {}
  /** One import/cleanup per account across tabs and workers; browser releases locks on termination. */
  private async exclusive<T>(namespace: string, work: () => Promise<T>): Promise<T> {
    if (!this.locks) throw new Error('This browser requires Web Locks for safe content imports and cleanup.');
    return this.locks.request(`ally-content:${namespace}`, { mode: 'exclusive', ifAvailable: true }, async lock => {
      if (!lock) throw new Error('Content is being imported or managed in another tab. Try again when it finishes.');
      return work();
    });
  }
  async withImport<T>(namespace: string, work: () => Promise<T>): Promise<T> {
    return this.exclusive(namespace, async () => { await this.recoverUnlocked(namespace); return work(); });
  }
  async recover(namespace: string): Promise<number> {
    return this.exclusive(namespace, () => this.recoverUnlocked(namespace));
  }
  private async recoverUnlocked(namespace: string): Promise<number> {
    const abandoned = (await this.revisions(namespace)).filter(r => r.revision.status === 'staging' && !r.active);
    for (const entry of abandoned) await this.remove(entry.revision.id, namespace, true);
    return abandoned.length;
  }
  async revisions(namespace: string): Promise<{ revision: ImportRevision; active: boolean; storedRecords: number }[]> {
    const db = await this.db();
    const tx = db.transaction(['revisions', 'active']);
    const [revisions, pointers] = await Promise.all([
      request<ImportRevision[]>(tx.objectStore('revisions').getAll()),
      request<{ revisionId: string }[]>(tx.objectStore('active').getAll()),
    ]);
    const active = new Set(pointers.map(p => p.revisionId));
    return Promise.all(revisions.filter(r => r.namespace === namespace).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map(async revision => ({
      revision, active: active.has(revision.id),
      storedRecords: await request<number>(db.transaction('records').objectStore('records').index('revision').count(revision.id)),
    })));
  }
  async deleteRevision(namespace: string, revisionId: string, progress?: (value: RevisionRemovalProgress) => void): Promise<void> {
    await this.exclusive(namespace, () => this.remove(revisionId, namespace, false, progress));
  }
  private connection?: Promise<IDBDatabase>;
  private db(): Promise<IDBDatabase> {
    return this.connection ??= new Promise((resolve, reject) => {
      // Retire pre-lock connections before recovery can remove their staging data.
      const opening = indexedDB.open('ally-content-v1', 4);
      opening.onupgradeneeded = () => {
        const db = opening.result;
        if (!db.objectStoreNames.contains('records')) {
          const records = db.createObjectStore('records', { keyPath: ['revisionId', 'key'] });
          records.createIndex('revision', 'revisionId');
          records.createIndex('category', ['revisionId', 'kind']);
          db.createObjectStore('revisions', { keyPath: 'id' });
          db.createObjectStore('active', { keyPath: 'key' });
        }
        if (!db.objectStoreNames.contains('settings')) db.createObjectStore('settings', { keyPath: 'namespace' });
        if (!db.objectStoreNames.contains('browse-summaries')) db.createObjectStore('browse-summaries', { keyPath: 'revisionId' });
      };
      opening.onsuccess = () => {
        opening.result.onversionchange = () => { opening.result.close(); this.connection = undefined; };
        resolve(opening.result);
      };
      opening.onerror = () => { this.connection = undefined; reject(opening.error); };
      opening.onblocked = () => reject(new Error('Close other Ally tabs to upgrade the content cache.'));
    });
  }
  async stage(revision: ImportRevision): Promise<void> {
    const tx = (await this.db()).transaction('revisions', 'readwrite');
    const done = complete(tx);
    tx.objectStore('revisions').add(revision);
    await done;
  }
  async put(revisionId: string, records: ContentRecord[]): Promise<void> {
    const tx = (await this.db()).transaction(['records', 'browse-summaries'], 'readwrite');
    const done = complete(tx);
    for (const record of records) tx.objectStore('records').put({ ...record, revisionId });
    // Keep summaries correct for explicit record replacements as well as new imports.
    tx.objectStore('browse-summaries').delete(revisionId);
    await done;
  }
  async getBrowseSummary(revisionId: string): Promise<ContentBrowseSummary | undefined> {
    const tx = (await this.db()).transaction('browse-summaries');
    return request(tx.objectStore('browse-summaries').get(revisionId));
  }
  async saveBrowseSummary(revisionId: string, summary: ContentBrowseSummary): Promise<void> {
    const tx = (await this.db()).transaction(['revisions', 'browse-summaries'], 'readwrite');
    const done = complete(tx);
    // Cleanup may have removed a legacy revision while its background scan was running.
    const revision = await request<ImportRevision | undefined>(tx.objectStore('revisions').get(revisionId));
    if (revision) tx.objectStore('browse-summaries').put({ ...summary, revisionId });
    await done;
  }
  async get(revisionId: string, key: string): Promise<ContentRecord | undefined> {
    const tx = (await this.db()).transaction('records');
    return request(tx.objectStore('records').get([revisionId, key]));
  }
  async visit(revisionId: string, visitor: (record: ContentRecord) => Promise<void>): Promise<void> {
    // Page by primary key. Do not hold an IndexedDB cursor transaction open across async linking.
    let after: string | undefined;
    for (;;) {
      const tx = (await this.db()).transaction('records');
      const range = IDBKeyRange.bound([revisionId, after ?? ''], [revisionId, '\uffff'], after !== undefined);
      const page = await request<ContentRecord[]>(tx.objectStore('records').getAll(range, 128));
      if (!page.length) return;
      for (const record of page) await visitor(record);
      after = page[page.length - 1].key;
    }
  }
  async activate(revision: ImportRevision, signal?: AbortSignal): Promise<void> {
    const db = await this.db();
    signal?.throwIfAborted();
    const tx = db.transaction(['revisions', 'active'], 'readwrite');
    const done = complete(tx);
    const abort = () => tx.abort();
    signal?.addEventListener('abort', abort, { once: true });
    tx.objectStore('revisions').put({ ...revision, status: 'ready' });
    tx.objectStore('active').put({ key: this.activeKey(revision.namespace, revision.source), revisionId: revision.id });
    try { await done; } finally { signal?.removeEventListener('abort', abort); }
  }
  private activeKey(namespace: string, source: ContentSource): string {
    return JSON.stringify([namespace, sourceIdentity(source), source.branch]);
  }
  async active(namespace: string, source: ContentSource): Promise<ImportRevision | undefined> {
    const db = await this.db();
    const pointer = await request<{ revisionId: string } | undefined>(db.transaction('active').objectStore('active').get(this.activeKey(namespace, source)));
    return pointer ? request(db.transaction('revisions').objectStore('revisions').get(pointer.revisionId)) : undefined;
  }
  async category(revisionId: string, kind: string, limit = 100): Promise<ContentRecord[]> {
    const tx = (await this.db()).transaction('records');
    return request(tx.objectStore('records').index('category').getAll([revisionId, kind], limit));
  }
  /** Rank before paging, retaining at most offset + limit candidates for a search. */
  async searchCategory(revisionId: string, kinds: readonly string[], search: string, offset = 0, limit = 30, matches?: (record: ContentRecord) => boolean, order?: (a: ContentRecord, b: ContentRecord) => number): Promise<{ records: ContentRecord[]; total: number }> {
    const db = await this.db();
    const query = search.trim().toLowerCase();
    const retained = Math.max(0, offset + limit);
    const compare = (a: ContentRecord, b: ContentRecord) => compareSearchMatches(a.name, b.name, query)
      || (order?.(a, b) ?? 0) || a.name.localeCompare(b.name) || a.publication.localeCompare(b.publication) || a.key.localeCompare(b.key);
    return new Promise((resolve, reject) => {
      const tx = db.transaction('records');
      const records: ContentRecord[] = []; let total = 0;
      const next = (position: number) => {
        if (position >= kinds.length) return;
        const cursor = tx.objectStore('records').index('category').openCursor(IDBKeyRange.only([revisionId, kinds[position]]));
        cursor.onsuccess = () => {
          const row = cursor.result;
          if (!row) { next(position + 1); return; }
          const record = row.value as ContentRecord;
          // Activated library records were validated at import; search reads their explicit index fields.
          const definition = record.classDefinition;
          const text = [record.name, record.publication, definition?.parent?.name, definition?.subclass?.shortName,
            definition?.level, record.characterOption?.featureTypes].join(' ').toLowerCase();
          if (query.split(/\s+/).every(term => text.includes(term)) && (!matches || matches(record))) {
            if ((query || order) && limit > 0) {
              // Keep the best candidates across the entire corpus, not just this cursor page.
              let low = 0, high = records.length;
              while (low < high) {
                const middle = (low + high) >>> 1;
                if (compare(records[middle], record) <= 0) low = middle + 1;
                else high = middle;
              }
              if (low < retained) {
                records.splice(low, 0, record);
                if (records.length > retained) records.pop();
              }
            } else if (!query && total >= offset && records.length < limit) records.push(record);
            total++;
          }
          row.continue();
        };
      };
      next(0);
      tx.oncomplete = () => resolve({ records: query || order ? records.slice(offset, offset + limit) : records, total });
      tx.onabort = tx.onerror = () => reject(tx.error ?? new Error('Could not search content.'));
    });
  }
  /** Filter the item index as a cursor, retaining only tools instead of loading the item corpus. */
  async tools(revisionId: string): Promise<ContentRecord[]> {
    const db = await this.db();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('records');
      const result: ContentRecord[] = [];
      const cursor = tx.objectStore('records').index('category').openCursor(IDBKeyRange.only([revisionId, 'item']));
      cursor.onsuccess = () => {
        const row = cursor.result;
        if (!row) return;
        const record = row.value as ContentRecord;
        if (['T', 'AT', 'GS', 'INS'].includes(itemTypeCode(record))) result.push(record);
        row.continue();
      };
      tx.oncomplete = () => resolve(result.sort((a, b) => a.name.localeCompare(b.name) || a.publication.localeCompare(b.publication)));
      tx.onabort = tx.onerror = () => reject(tx.error ?? new Error('Could not read tools.'));
    });
  }
  async saveSource(namespace: string, source: ContentSource): Promise<void> {
    const tx = (await this.db()).transaction('settings', 'readwrite');
    const done = complete(tx);
    tx.objectStore('settings').put({ namespace, source });
    await done;
  }
  async savedSource(namespace: string): Promise<ContentSource | undefined> {
    const tx = (await this.db()).transaction('settings');
    const result = await request<{ source: ContentSource } | undefined>(tx.objectStore('settings').get(namespace));
    return result?.source;
  }
  async discard(revisionId: string): Promise<void> {
    await this.remove(revisionId, undefined, true);
  }
  private async remove(revisionId: string, namespace?: string, stagingOnly = false, progress?: (value: RevisionRemovalProgress) => void): Promise<void> {
    progress?.({ phase: 'checking', records: 0 });
    const tx = (await this.db()).transaction(['records', 'revisions', 'active', 'browse-summaries'], 'readwrite');
    const done = complete(tx);
    const [revision, pointers] = await Promise.all([
      request<ImportRevision | undefined>(tx.objectStore('revisions').get(revisionId)),
      request<{ revisionId: string }[]>(tx.objectStore('active').getAll()),
    ]);
    if (!revision) { await done; return; }
    if ((namespace !== undefined && revision.namespace !== namespace) || pointers.some(p => p.revisionId === revisionId)
      || (stagingOnly && revision.status !== 'staging')) {
      tx.abort(); await done.catch(() => {});
      throw new Error('Only inactive content revisions in this account can be removed; discard requires staging content.');
    }
    const records = tx.objectStore('records');
    const count = progress ? await request<number>(records.index('revision').count(revisionId)) : 0;
    progress?.({ phase: 'deleting', records: count });
    // Primary keys are [revisionId, string key]. An array sorts after every string,
    // so this range includes the whole revision without loading any record bodies.
    records.delete(IDBKeyRange.bound([revisionId], [revisionId, []], false, true));
    tx.objectStore('revisions').delete(revisionId);
    tx.objectStore('browse-summaries').delete(revisionId);
    await done;
    progress?.({ phase: 'complete', records: count });
  }
}
