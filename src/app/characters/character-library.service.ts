import { Injectable, OnDestroy, inject, signal } from '@angular/core';
import { normalizeCharacterEditorIdentity } from '../editor/editor-identity';
import { CHARACTER_REPOSITORY, CharacterRecord } from './character-repository';
import { ExportedCharacter } from '../models/character.model';
import { CharacterStorageService, SavedCharacterMetadata, StorageError } from '../services/character-storage.service';

export interface CharacterSummary extends SavedCharacterMetadata { version: number; }
export interface CharacterImportResult { success: boolean; characterId?: string; error?: StorageError; }

/** Shared library operations; UI screens depend on this service, not a browser storage mechanism. */
@Injectable({ providedIn: 'root' })
export class CharacterLibraryService implements OnDestroy {
  private readonly repository = inject(CHARACTER_REPOSITORY);
  private readonly legacy = inject(CharacterStorageService);
  readonly changed = signal(0);
  readonly error = signal('');
  readonly migrationIssues = signal<string[]>([]);
  readonly storageBytes = signal(0);
  private migration?: Promise<void>;
  private channel?: BroadcastChannel;

  constructor() {
    if (typeof window !== 'undefined' && typeof BroadcastChannel !== 'undefined') {
      this.channel = new BroadcastChannel('ally-character-library');
      this.channel.onmessage = () => this.changed.update(value => value + 1);
    }
  }
  ngOnDestroy() { this.channel?.close(); this.channel = undefined; }
  private notify() {
    this.changed.update(value => value + 1);
    this.channel?.postMessage('changed');
  }

  /** Copy legacy viewer saves once per ID. Originals remain as a backup; canonical rows/tombstones win. */
  private ready(): Promise<void> {
    if (typeof indexedDB === 'undefined') return Promise.resolve();
    return this.migration ??= this.migrateLegacy().finally(() => { this.migration = undefined; });
  }
  private async migrateLegacy() {
    const issues: string[] = [];
    let imported = false;
    for (const summary of this.legacy.listCharacters()) {
      try {
        if (await this.repository.get(summary.characterId)) continue;
        const sheet = this.legacy.loadCharacter(summary.characterId);
        if (!sheet?.character) throw new Error('Invalid legacy character data.');
        sheet.character.characterUuid = summary.characterId;
        try { await this.repository.save(sheet, 0); imported = true; }
        catch (error) {
          // Another tab may have copied it first. Never overwrite that newer row.
          if (!await this.repository.get(summary.characterId)) throw error;
        }
      } catch (error) { issues.push(`${summary.name}: ${String(error)}`); }
    }
    this.migrationIssues.set(issues);
    if (imported) this.notify();
  }

  async list(): Promise<CharacterRecord[]> {
    await this.ready();
    if (typeof indexedDB === 'undefined') return [];
    const records = await this.repository.list();
    this.storageBytes.set(records.reduce((total, record) => total + new TextEncoder().encode(JSON.stringify(record.sheet)).byteLength, 0));
    // Listing needs character metadata only. Optional wizard state must never hide the library.
    return records;
  }
  async summaries(): Promise<CharacterSummary[]> {
    return (await this.list()).map(record => ({
      characterId: record.id, version: record.version,
      name: record.sheet.character?.name || 'Unnamed', level: record.sheet.character?.level ?? 1,
      description: record.sheet.character?.description ?? '', installationId: record.sheet.installationId,
      lastModified: Date.parse(record.updatedAt),
    }));
  }
  async get(id: string): Promise<CharacterRecord | undefined> {
    await this.ready();
    if (typeof indexedDB === 'undefined') return;
    const record = await this.repository.get(id);
    return !record || record.deletedAt ? undefined : { ...record, sheet: normalizeCharacterEditorIdentity(record.sheet) };
  }
  async save(sheet: ExportedCharacter, expectedVersion: number): Promise<number> {
    const snapshot = normalizeCharacterEditorIdentity(sheet);
    await this.ready();
    const version = await this.repository.save(snapshot, expectedVersion);
    this.notify(); return version;
  }
  async delete(id: string, expectedVersion: number): Promise<void> {
    await this.ready();
    await this.repository.delete(id, expectedVersion);
    this.notify();
  }

  /** Full portable JSON is persisted as-is: creator metadata, cached entities and session edits travel together. */
  async importCharacterFromJson(json: string, overrideExisting = false): Promise<CharacterImportResult> {
    try {
      const sheet = JSON.parse(json) as ExportedCharacter;
      if (!sheet || !sheet.character || typeof sheet.character !== 'object' || Array.isArray(sheet.character)) {
        throw new Error('Invalid character format: missing character data.');
      }
      sheet.character.characterUuid ||= crypto.randomUUID();
      await this.ready();
      const id = sheet.character.characterUuid;
      const existing = await this.repository.get(id);
      if (existing && !existing.deletedAt && !overrideExisting) return {
        success: false, characterId: id,
        error: { code: 'IMPORT_CONFLICT', message: `Character "${existing.sheet.character?.name}" with ID ${id} already exists.` },
      };
      if (existing && sheet.portaitUrl == null) sheet.portaitUrl = existing.sheet.portaitUrl;
      await this.repository.save(normalizeCharacterEditorIdentity(sheet), existing?.version ?? 0);
      this.notify(); return { success: true, characterId: id };
    } catch (error) {
      return { success: false, error: { code: 'INVALID_FORMAT', message: String(error) } };
    }
  }
}
