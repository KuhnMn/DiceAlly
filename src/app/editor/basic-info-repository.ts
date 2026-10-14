import { ExportedCharacter } from '../models/character.model';
import { validateBasicInfo } from './basic-info';

export interface BasicInfoEntry {
  id: string;
  sheet: ExportedCharacter;
  version: number;
  updatedAt: string;
}

/** Freely editable sheets do not require compendium bindings or a rules-engine document. */
export class BasicInfoRepository {
  private connection?: Promise<IDBDatabase>;

  private db(): Promise<IDBDatabase> {
    return this.connection ??= new Promise((resolve, reject) => {
      const request = indexedDB.open('ally-character-editor-v1', 1);
      request.onupgradeneeded = () => request.result.createObjectStore('characters', { keyPath: 'id' });
      request.onsuccess = () => {
        request.result.onversionchange = () => { request.result.close(); this.connection = undefined; };
        resolve(request.result);
      };
      request.onerror = () => { this.connection = undefined; reject(request.error); };
      request.onblocked = () => { this.connection = undefined; reject(new Error('Close other editor tabs and try again.')); };
    });
  }

  async list(): Promise<BasicInfoEntry[]> {
    const db = await this.db();
    return new Promise((resolve, reject) => {
      const request = db.transaction('characters').objectStore('characters').getAll();
      request.onsuccess = () => resolve(request.result.sort((a: BasicInfoEntry, b: BasicInfoEntry) => b.updatedAt.localeCompare(a.updatedAt)));
      request.onerror = () => reject(request.error);
    });
  }

  async save(sheet: ExportedCharacter, expectedVersion: number): Promise<number> {
    validateBasicInfo(sheet);
    const copy = structuredClone(sheet);
    const db = await this.db();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('characters', 'readwrite');
      const store = tx.objectStore('characters');
      const request = store.get(copy.character!.characterUuid!);
      let error: Error | undefined;
      request.onsuccess = () => {
        if ((request.result?.version ?? 0) !== expectedVersion) {
          error = new Error('This character was saved in another tab. Reopen it before saving your changes.');
          tx.abort(); return;
        }
        store.put({ id: copy.character!.characterUuid!, sheet: copy, version: expectedVersion + 1, updatedAt: new Date().toISOString() } satisfies BasicInfoEntry);
      };
      tx.oncomplete = () => resolve(expectedVersion + 1);
      tx.onabort = tx.onerror = () => reject(error ?? tx.error ?? new Error('Could not save character.'));
    });
  }
}
