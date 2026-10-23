import { Injectable, OnDestroy, inject, signal } from '@angular/core';
import { normalizeCharacterEditorIdentity } from '../editor/editor-identity';
import { characterDescription } from '../character-description';
import { CHARACTER_REPOSITORY, CharacterRecord } from './character-repository';
import { ExportedCharacter } from '../models/character.model';
import { APP_RUNTIME_CONFIG } from '../app.tokens';
import { CharacterStorageService, SavedCharacterMetadata, StorageError } from '../services/character-storage.service';

export interface CharacterSummary extends SavedCharacterMetadata { version: number; }
export interface CharacterImportResult { success: boolean; characterId?: string; error?: StorageError; }

/** Shared library operations; UI screens depend on this service, not a browser storage mechanism. */
@Injectable({ providedIn: 'root' })
export class CharacterLibraryService implements OnDestroy {
  private readonly repository = inject(CHARACTER_REPOSITORY);
  private readonly legacy = inject(CharacterStorageService);
  private readonly cloudConfigured = !!inject(APP_RUNTIME_CONFIG, { optional: true })?.firebase;
  readonly changed = signal(0);
  readonly showSyncConflicts = signal(false);
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
  notifyStoredChange() { this.notify(); }

  /** Copy legacy viewer saves once per ID. Originals remain as a backup; canonical rows/tombstones win. */
  private ready(): Promise<void> {
    // Account migration must be explicit; never assign a shared device's old saves to every login.
    if (this.cloudConfigured) return Promise.resolve();
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
      description: characterDescription(record.sheet),
      lastModified: Date.parse(record.updatedAt),
    }));
  }
  async get(id: string): Promise<CharacterRecord | undefined> {
    await this.ready();
    if (typeof indexedDB === 'undefined') return;
    const record = await this.repository.get(id);
    if (!record || record.deletedAt) return undefined;
    const sheet = normalizeCharacterEditorIdentity(record.sheet);
    await this.fillReferences(sheet);
    return { ...record, sheet };
  }
  async save(sheet: ExportedCharacter, expectedVersion: number): Promise<number> {
    const snapshot = normalizeCharacterEditorIdentity(sheet);
    await this.fillReferences(snapshot);
    await this.ready();
    const version = await this.repository.save(snapshot, expectedVersion);
    this.notify(); return version;
  }
  /** Reference enrichment loads only when needed and cannot block offline character saves. */
  private async fillReferences(sheet: ExportedCharacter): Promise<void> {
    try {
      const { fillInstalledReferenceDescriptions } = await import('../content/character-reference-descriptions');
      await fillInstalledReferenceDescriptions(sheet);
    } catch { /* An unavailable optional chunk/library must not prevent local persistence. */ }
  }
  async delete(id: string, expectedVersion: number): Promise<void> {
    await this.ready();
    await this.repository.delete(id, expectedVersion);
    this.notify();
  }

  /** Normal imports retain portable JSON without applying old-app conversion. */
  async importCharacterFromJson(json: string, overrideExisting = false): Promise<CharacterImportResult> {
    return this.importJson(json, overrideExisting, false);
  }

  async importLegacyCharacterFromJson(json: string, overrideExisting = false): Promise<CharacterImportResult> {
    return this.importJson(json, overrideExisting, true);
  }

  private async importJson(json: string, overrideExisting: boolean, convertLegacy: boolean): Promise<CharacterImportResult> {
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
      const imported = convertLegacy
        ? await (await import('./legacy-character-import')).migrateLegacyCharacterExport(sheet)
        : sheet;
      await this.repository.save(normalizeCharacterEditorIdentity(imported), existing?.version ?? 0);
      this.notify(); return { success: true, characterId: id };
    } catch (error) {
      return { success: false, error: { code: 'INVALID_FORMAT', message: String(error) } };
    }
  }
}
