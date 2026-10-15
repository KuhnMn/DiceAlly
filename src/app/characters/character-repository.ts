import { InjectionToken } from '@angular/core';
import { ExportedCharacter } from '../models/character.model';
import { IndexedDbCharacterRepository } from './indexeddb-character-repository';

export interface CharacterRecord {
  id: string;
  sheet: ExportedCharacter;
  version: number;
  updatedAt: string;
  /** Retained deletion intent can be synchronized later; legacy copies must not resurrect it. */
  deletedAt?: string;
  /** Last acknowledged cloud revision. Local versions count browser saves independently. */
  cloudRevision?: number;
  cloudHash?: string;
  syncedVersion?: number;
  conflict?: CharacterCloudConflict;
}

export interface CharacterCloudConflict {
  revision: number;
  hash: string;
  updatedAt: string;
  deleted: boolean;
  sheet: ExportedCharacter;
}

/** Async persistence boundary shared by editing and play. A future sync adapter can wrap local writes. */
export interface CharacterRepository {
  list(): Promise<CharacterRecord[]>;
  get(id: string): Promise<CharacterRecord | undefined>;
  save(sheet: ExportedCharacter, expectedVersion: number): Promise<number>;
  delete(id: string, expectedVersion: number): Promise<void>;
}

export const CHARACTER_REPOSITORY = new InjectionToken<CharacterRepository>('CharacterRepository', {
  providedIn: 'root', factory: () => new IndexedDbCharacterRepository(),
});
