import { CharacterDocument, canonicalDocument, validateCharacterDocument } from '../rules/character-document';

export interface LocalCharacterEntry {
  id: string;
  document: CharacterDocument;
  draft?: CharacterDocument;
  version: number;
  updatedAt: string;
  previous?: CharacterDocument;
}

/** Native saves have their own database. Legacy localStorage is never migrated or overwritten. */
export class LocalCharacterRepository {
  private connection?: Promise<IDBDatabase>;

  private db(): Promise<IDBDatabase> {
    return this.connection ??= new Promise((resolve, reject) => {
      const request = indexedDB.open('ally-local-characters-v1', 1);
      request.onupgradeneeded = () => request.result.createObjectStore('characters', { keyPath: 'id' });
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async list(): Promise<LocalCharacterEntry[]> {
    const db = await this.db();
    return new Promise((resolve, reject) => {
      const request = db.transaction('characters').objectStore('characters').getAll();
      request.onsuccess = () => resolve(request.result.sort((a: LocalCharacterEntry, b: LocalCharacterEntry) => b.updatedAt.localeCompare(a.updatedAt)));
      request.onerror = () => reject(request.error);
    });
  }

  async save(document: CharacterDocument, expectedVersion: number, draft = false): Promise<number> {
    // Drafts may have incomplete class selections, but must remain portable and bounded.
    const copy = draft ? JSON.parse(canonicalDocument(document)) as CharacterDocument : validateCharacterDocument(document);
    const db = await this.db();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('characters', 'readwrite');
      const store = tx.objectStore('characters');
      const request = store.get(copy.id);
      let version = expectedVersion;
      let error: Error | undefined;
      request.onsuccess = () => {
        const old = request.result as LocalCharacterEntry | undefined;
        if ((old?.version ?? 0) !== expectedVersion) {
          error = new Error('This character changed in another tab. Reopen it before saving; export your current draft first.');
          tx.abort();
          return;
        }
        version++;
        store.put({ id: copy.id, document: draft ? old?.document ?? copy : copy,
          ...(draft ? { draft: copy } : {}), previous: draft ? old?.previous : old?.document,
          version, updatedAt: new Date().toISOString() } satisfies LocalCharacterEntry);
      };
      tx.oncomplete = () => resolve(version);
      tx.onabort = tx.onerror = () => reject(error ?? tx.error ?? new Error('Character save failed.'));
    });
  }

  async remove(id: string, expectedVersion: number): Promise<void> {
    const db = await this.db();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('characters', 'readwrite');
      const store = tx.objectStore('characters'); const request = store.get(id);
      let error: Error | undefined;
      request.onsuccess = () => {
        if (request.result?.version !== expectedVersion) { error = new Error('Character changed. Refresh the library before deleting.'); tx.abort(); }
        else store.delete(id);
      };
      tx.oncomplete = () => resolve();
      tx.onabort = tx.onerror = () => reject(error ?? tx.error);
    });
  }
}
