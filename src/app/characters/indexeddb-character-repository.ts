import type { CharacterRecord, CharacterRepository } from './character-repository';
import { ExportedCharacter } from '../models/character.model';
import { canonicalDocument } from '../rules/canonical-document';
import { portableCharacter } from './portable-character';
import { validateSpeciesEntity } from '../content/species-compatibility';

/** Uses the existing creator database, so previously saved creator characters need no conversion. */
export class IndexedDbCharacterRepository implements CharacterRepository {
  constructor(private readonly databaseName = 'ally-character-editor-v1') {}
  private connection?: Promise<IDBDatabase>;

  private db(): Promise<IDBDatabase> {
    return this.connection ??= new Promise((resolve, reject) => {
      const request = indexedDB.open(this.databaseName, 1);
      request.onupgradeneeded = () => request.result.createObjectStore('characters', { keyPath: 'id' });
      request.onsuccess = () => {
        request.result.onversionchange = () => { request.result.close(); this.connection = undefined; };
        resolve(request.result);
      };
      request.onerror = () => { this.connection = undefined; reject(request.error); };
      request.onblocked = () => { this.connection = undefined; reject(new Error('Close other character tabs and try again.')); };
    });
  }

  async list(): Promise<CharacterRecord[]> {
    return (await this.listAll()).filter(record => !record.deletedAt);
  }

  /** Tombstones and unsent changes live in the same durable rows as their character snapshots. */
  async listAll(): Promise<CharacterRecord[]> {
    const db = await this.db();
    return new Promise((resolve, reject) => {
      const request = db.transaction('characters').objectStore('characters').getAll();
      request.onsuccess = () => {
        try {
          const records = request.result as CharacterRecord[];
          records.forEach(record => validateSpeciesEntity(record.sheet.species?.entity));
          resolve(records.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)));
        } catch (error) { reject(error); }
      };
      request.onerror = () => reject(request.error);
    });
  }

  /** Includes deletion tombstones so migration and explicit restore can distinguish them from new IDs. */
  async get(id: string): Promise<CharacterRecord | undefined> {
    const db = await this.db();
    return new Promise((resolve, reject) => {
      const request = db.transaction('characters').objectStore('characters').get(id);
      request.onsuccess = () => {
        try { validateSpeciesEntity((request.result as CharacterRecord | undefined)?.sheet.species?.entity); resolve(request.result); }
        catch (error) { reject(error); }
      };
      request.onerror = () => reject(request.error);
    });
  }

  async save(sheet: ExportedCharacter, expectedVersion: number): Promise<number> {
    canonicalDocument(sheet);
    const id = sheet.character?.characterUuid;
    if (!id || typeof id !== 'string') throw new Error('Character identity is missing.');
    const copy = portableCharacter(sheet);
    return this.write(id, expectedVersion, existing => ({
      ...existing, deletedAt: undefined,
      id, sheet: copy, version: expectedVersion + 1, updatedAt: new Date().toISOString(),
    }));
  }

  async replaceFromCloud(record: CharacterRecord, expectedVersion: number) {
    canonicalDocument(record.sheet);
    return this.write(record.id, expectedVersion, () => ({ ...record, sheet: portableCharacter(record.sheet), version: expectedVersion + 1, syncedVersion: expectedVersion + 1 }));
  }

  /** Acknowledgements must not increment the edit version or erase edits made during an upload. */
  async updateSync(id: string, update: (record: CharacterRecord) => CharacterRecord): Promise<void> {
    const db = await this.db();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('characters', 'readwrite');
      const store = tx.objectStore('characters');
      const request = store.get(id);
      request.onsuccess = () => { if (request.result) store.put(update(request.result)); };
      tx.oncomplete = () => resolve();
      tx.onabort = tx.onerror = () => reject(tx.error);
    });
  }

  async delete(id: string, expectedVersion: number): Promise<void> {
    await this.write(id, expectedVersion, existing => {
      if (!existing) throw new Error('Character not found.');
      return { ...existing, version: expectedVersion + 1, deletedAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    });
  }

  /** Read/version-check/write is one transaction; a stale editor cannot overwrite session changes. */
  private async write(id: string, expectedVersion: number, update: (existing?: CharacterRecord) => CharacterRecord): Promise<number> {
    const db = await this.db();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('characters', 'readwrite');
      const store = tx.objectStore('characters');
      const request = store.get(id);
      let error: Error | undefined;
      request.onsuccess = () => {
        try {
          if ((request.result?.version ?? 0) !== expectedVersion) {
            throw new Error('This character changed in another tab. Reopen it before saving your changes.');
          }
          store.put(update(request.result));
        } catch (cause) { error = cause as Error; tx.abort(); }
      };
      tx.oncomplete = () => resolve(expectedVersion + 1);
      tx.onabort = tx.onerror = () => reject(error ?? tx.error ?? new Error('Could not save character.'));
    });
  }
}
