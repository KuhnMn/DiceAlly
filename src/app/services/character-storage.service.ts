import { Injectable, inject, PLATFORM_ID } from '@angular/core';
import { signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { ExportedCharacter } from '../models/character.model';

export interface SavedCharacterMetadata {
  characterId: string;
  name: string;
  level: number;
  description?: string;
  installationId?: string;
  lastModified: number;
}

export interface StorageError {
  code: 'QUOTA_EXCEEDED' | 'IMPORT_CONFLICT' | 'NOT_FOUND' | 'INVALID_FORMAT' | 'UNKNOWN';
  message: string;
}

@Injectable({
  providedIn: 'root',
})
export class CharacterStorageService {
  private readonly STORAGE_KEY_PREFIX = 'ally_character_';
  private readonly STORAGE_METADATA_KEY = 'ally_character_metadata';
  private platformId = inject(PLATFORM_ID);
  private qrDepsPromise?: Promise<{
    Encoder: typeof import('@nuintun/qrcode').Encoder;
    Byte: typeof import('@nuintun/qrcode').Byte;
    deflate: typeof import('pako').deflate;
  }>;

  // Signal to track when character data changes
  characterSaved = signal<{ characterId: string; timestamp: number } | null>(null);

  private get isBrowser(): boolean {
    return isPlatformBrowser(this.platformId);
  }

  private generateCharacterId(): string {
    return `char_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private loadQrDeps(): Promise<{
    Encoder: typeof import('@nuintun/qrcode').Encoder;
    Byte: typeof import('@nuintun/qrcode').Byte;
    deflate: typeof import('pako').deflate;
  }> {
    if (!this.qrDepsPromise) {
      this.qrDepsPromise = Promise.all([
        import('@nuintun/qrcode'),
        import('pako')
      ]).then(([qrcode, pako]) => ({
        Encoder: qrcode.Encoder,
        Byte: qrcode.Byte,
        deflate: pako.deflate
      }));
    }

    return this.qrDepsPromise;
  }

  /**
   * Save a complete character to localStorage
   */
  saveCharacter(character: ExportedCharacter): { success: boolean; characterId: string; error?: StorageError } {
    if (!this.isBrowser) {
      return {
        success: false,
        characterId: '',
        error: {
          code: 'UNKNOWN',
          message: 'Cannot save character during server-side rendering',
        },
      };
    }

    try {
      // Ensure character has an ID
      if (!character.character?.characterUuid) {
        character.character = character.character || {};
        character.character.characterUuid = this.generateCharacterId();
      }

      const characterId = character.character.characterUuid;
      const storageKey = `${this.STORAGE_KEY_PREFIX}${characterId}`;

      // Check storage quota
      const serialized = JSON.stringify(character);
      if (serialized.length > 5 * 1024 * 1024) {
        return {
          success: false,
          characterId: characterId,
          error: {
            code: 'QUOTA_EXCEEDED',
            message: 'Character data exceeds 5MB limit',
          },
        };
      }

      // Save the character
      localStorage.setItem(storageKey, serialized);

      // Update metadata
      this.updateMetadata(characterId, character.character.name || 'Unnamed', character.character.level || 1, character.character?.description || "", character.installationId);

      this.characterSaved.set({ characterId, timestamp: Date.now() });

      return { success: true, characterId };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return {
        success: false,
        characterId: '',
        error: {
          code: message.includes('QuotaExceeded') ? 'QUOTA_EXCEEDED' : 'UNKNOWN',
          message: `Failed to save character: ${message}`,
        },
      };
    }
  }

  /**
   * Load a character by ID
   */
  loadCharacter(characterId: string): ExportedCharacter | null {
    if (!this.isBrowser) {
      return null;
    }

    try {
      const storageKey = `${this.STORAGE_KEY_PREFIX}${characterId}`;
      const data = localStorage.getItem(storageKey);

      if (!data) {
        return null;
      }

      return JSON.parse(data) as ExportedCharacter;
    } catch (error) {
      console.error(`Failed to load character ${characterId}:`, error);
      return null;
    }
  }

  /**
   * Get all saved characters metadata (name, level, last modified)
   */
  listCharacters(): SavedCharacterMetadata[] {
    if (!this.isBrowser) {
      return [];
    }

    try {
      const metadata = localStorage.getItem(this.STORAGE_METADATA_KEY);
      if (!metadata) {
        return [];
      }

      const metadataMap = JSON.parse(metadata) as Record<string, SavedCharacterMetadata>;
      return Object.values(metadataMap).sort((a, b) => b.lastModified - a.lastModified);
    } catch (error) {
      console.error('Failed to list characters:', error);
      return [];
    }
  }

  /**
   * Delete a character by ID
   */
  deleteCharacter(characterId: string): boolean {
    if (!this.isBrowser) {
      return false;
    }

    try {
      const storageKey = `${this.STORAGE_KEY_PREFIX}${characterId}`;
      localStorage.removeItem(storageKey);

      // Remove from metadata
      const metadata = localStorage.getItem(this.STORAGE_METADATA_KEY);
      if (metadata) {
        const metadataMap = JSON.parse(metadata) as Record<string, SavedCharacterMetadata>;
        delete metadataMap[characterId];
        localStorage.setItem(this.STORAGE_METADATA_KEY, JSON.stringify(metadataMap));
      }

      return true;
    } catch (error) {
      console.error(`Failed to delete character ${characterId}:`, error);
      return false;
    }
  }

  /**
   * Export character as JSON string
   */
  exportCharacterAsJson(characterId: string): string | null {
    const character = this.loadCharacter(characterId);
    if (!character) {
      return null;
    }

    return JSON.stringify(character, null, 2);
  }

  /**
   * Export character as a downloadable file
   */
  downloadCharacterAsFile(characterId: string): boolean {
    const json = this.exportCharacterAsJson(characterId);
    if (!json) {
      return false;
    }

    const character = this.loadCharacter(characterId);
    const filename = `${character?.character?.name || 'character'}_${characterId}.json`;

    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);

    return true;
  }

  /**
   * Import character from JSON string
   * If characterId exists in local storage, allows override decision
   */
  importCharacterFromJson(
    json: string,
    options?: { overrideExisting?: boolean }
  ): { success: boolean; characterId?: string; error?: StorageError } {
    try {
      const imported = JSON.parse(json) as ExportedCharacter;

      // Validate basic structure
      if (!imported.character) {
        return {
          success: false,
          error: {
            code: 'INVALID_FORMAT',
            message: 'Invalid character format: missing character data',
          },
        };
      }

      // Ensure characterId exists
      if (!imported.character.characterUuid) {
        imported.character.characterUuid = this.generateCharacterId();
      }

      const characterId = imported.character.characterUuid;
      const existing = this.loadCharacter(characterId);

      // Check if character exists and override not allowed
      if (existing && !options?.overrideExisting) {
        return {
          success: false,
          characterId,
          error: {
            code: 'IMPORT_CONFLICT',
            message: `Character "${existing.character?.name}" with ID ${characterId} already exists.`,
          },
        };
      }

      if (existing && options?.overrideExisting && existing.portaitUrl &&  imported.portaitUrl == null) {
        imported.portaitUrl = existing.portaitUrl;
      }

      // Save the imported character
      const result = this.saveCharacter(imported);

      return {
        success: result.success,
        characterId: result.characterId,
        error: result.error,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return {
        success: false,
        error: {
          code: 'INVALID_FORMAT',
          message: `Failed to parse JSON: ${message}`,
        },
      };
    }
  }

  /**
   * Import from file input
   */
  importCharacterFromFile(
    file: File,
    options?: { overrideExisting?: boolean }
  ): Promise<{ success: boolean; characterId?: string; error?: StorageError }> {
    return new Promise((resolve) => {
      const reader = new FileReader();

      reader.onload = (event) => {
        try {
          const json = event.target?.result as string;
          resolve(this.importCharacterFromJson(json, options));
        } catch (error) {
          resolve({
            success: false,
            error: {
              code: 'INVALID_FORMAT',
              message: 'Failed to read file',
            },
          });
        }
      };

      reader.onerror = () => {
        resolve({
          success: false,
          error: {
            code: 'UNKNOWN',
            message: 'Failed to read file',
          },
        });
      };

      reader.readAsText(file);
    });
  }

  /**
   * Get total storage size used (in bytes)
   */
  getStorageUsage(): number {
    if (!this.isBrowser) {
      return 0;
    }

    let total = 0;
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(this.STORAGE_KEY_PREFIX)) {
        const value = localStorage.getItem(key);
        if (value) {
          total += value.length;
        }
      }
    }
    return total;
  }

  /**
   * Clear all saved characters (use with caution!)
   */
  clearAllCharacters(): boolean {
    if (!this.isBrowser) {
      return false;
    }

    try {
      const keys: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith(this.STORAGE_KEY_PREFIX)) {
          keys.push(key);
        }
      }

      keys.forEach((key) => localStorage.removeItem(key));
      localStorage.removeItem(this.STORAGE_METADATA_KEY);

      return true;
    } catch (error) {
      console.error('Failed to clear characters:', error);
      return false;
    }
  }

  /**
   * Auto-save character (call this periodically or on changes)
   */
  autoSaveCharacter(character: ExportedCharacter): void {
    const result = this.saveCharacter(character);
    if (!result.success) {
      console.warn('Auto-save failed:', result.error);
    }
  }

  private updateMetadata(characterId: string, name: string, level: number, description?: string, installationId?: string): void {
    if (!this.isBrowser) {
      return;
    }

    try {
      const metadata = localStorage.getItem(this.STORAGE_METADATA_KEY);
      const metadataMap = metadata ? (JSON.parse(metadata) as Record<string, SavedCharacterMetadata>) : {};

      metadataMap[characterId] = {
        characterId,
        name,
        level,
        lastModified: Date.now(),
        description: description || undefined,
        installationId: installationId || undefined,
      };

      localStorage.setItem(this.STORAGE_METADATA_KEY, JSON.stringify(metadataMap));
    } catch (error) {
      console.error('Failed to update metadata:', error);
    }
  }

  /**
   * Create a minimal character export without entity definitions
   * Returns a full ExportedCharacter with only essential state data
   * Only includes spells and features that have uses (to reduce size)
   * combatActions, conditions, notes, and monsters are empty arrays for compatibility
   */
  createMinimalExport(character: ExportedCharacter): ExportedCharacter {
    // Helper to convert FeatureUses to MinimalUses
    // Always include tag (empty string when missing) to avoid exporting empty objects.
    const toMinimalUses = (uses: any): any => {
      if (!uses) return undefined;
      const minimal: any = {};
      // Keep tag always present for stable minimal payload decoding.
      const tag = typeof uses.tag === 'string' ? uses.tag : '';
      if (tag !== '') minimal.tag = tag;
      minimal.t = uses.totalFreeUses ?? 1;
      const used = uses.usedFreeUses ?? 0;
      if (used !== 0) minimal.u = used;
      if (uses.freeUsesRegainCondition && uses.freeUsesRegainCondition !== "LONG_REST") minimal.r = uses.freeUsesRegainCondition;
      return Object.keys(minimal).length > 0 ? minimal : undefined;
    };

      const toMinimalNotes = (notes: any): any => {
      if (!notes || notes.isEditable === false) return undefined;
      const noteList = notes.notes ?? [];
      if (noteList.length === 0) return undefined;
      const minimal: any = {};
      if (notes.tag) minimal.tag = notes.tag;
      if (noteList.length > 0) minimal.n = noteList;
      return Object.keys(minimal).length > 0 ? minimal : undefined;
    };

    // Helper to convert FeatureUses[] to MinimalUses[]
    const toMinimalUsesList = (usesList?: any[]): any[] | undefined => {
      if (!usesList || usesList.length === 0) return undefined;
      const minimalUses = usesList.map(toMinimalUses).filter((u) => u !== undefined);
      return minimalUses.length > 0 ? minimalUses : undefined;
    };

    const toMinimalNotesList = (notesList?: any[]): any[] | undefined => {
      if (!notesList || notesList.length === 0) return undefined;
      const minimalNotes = notesList.map(toMinimalNotes).filter((n) => n !== undefined);
      return minimalNotes.length > 0 ? minimalNotes : undefined;
    };

    // Helper to convert HitDieEntry to MinimalHitDice
    const toMinimalHitDice = (hitDie: any): any => {
      if (!hitDie) return undefined;
      return {
        t: hitDie.total,
        u: hitDie.used,
        dieType: hitDie.dieType,
      };
    };

    // Helper to convert HitDieEntry[] to MinimalHitDice[]
    const toMinimalHitDiceList = (hitDice?: any): any[] | undefined => {
      if (!hitDice || !Array.isArray(hitDice) || hitDice.length === 0) return undefined;
      return hitDice.map(toMinimalHitDice);
    };

    // Helper to convert SpellSlot to MinimalSpellSlotInfo (omitting default values)
    const toMinimalSpellSlot = (slot: any): any => {
      if (!slot) return undefined;
      const minimal: any = {
        l: slot.level,
        t: slot.total,
      };
      // Only include 'u' if not 0 (default), and 'r' if present
      if (slot.used !== 0 && slot.used !== undefined) minimal.u = slot.used;
      if (slot.regainCondition && slot.regainCondition !== "LONG_REST") minimal.r = slot.regainCondition;
      return minimal;
    };

    // Helper to convert SpellSlot[] to MinimalSpellSlotInfo[]
    const toMinimalSpellSlotList = (slots?: any[]): any[] | undefined => {
      if (!slots || slots.length === 0) return undefined;
      return slots.map(toMinimalSpellSlot);
    };

    // Helper to convert Record<string, SpellSlot[]> to Record<string, MinimalSpellSlotInfo[]>
    const convertSpellSlotsRecord = (spellSlotsRecord?: Record<string, any[]>): Record<string, any[]> | undefined => {
      if (!spellSlotsRecord) return undefined;
      const result: Record<string, any[]> = {};
      Object.entries(spellSlotsRecord).forEach(([source, slots]) => {
        if (Array.isArray(slots) && slots.length > 0) {
          const minimalSlots = toMinimalSpellSlotList(slots);
          if (minimalSlots && minimalSlots.length > 0) {
            result[source] = minimalSlots;
          }
        }
      });
      return Object.keys(result).length > 0 ? result : undefined;
    };

    // Only include essential character state
    const minimalCharacter: any = {};
    if (character.character?.characterUuid) minimalCharacter.uuid = character.character.characterUuid;
    if (character.character?.currentHp !== undefined) minimalCharacter.cHp = character.character.currentHp;
    if (character.character?.tempHp !== undefined) minimalCharacter.tempHp = character.character.tempHp;
    if (character.character?.maxHpOverride !== undefined) minimalCharacter.maxHpO = character.character.maxHpOverride;
    if (character.character?.armorClassOverride !== undefined) minimalCharacter.acO = character.character.armorClassOverride;
    minimalCharacter.rt = character.character?.roundTracker ?? 0;
    
    // Convert hitDice to minimal format
    if (character.character?.hitDice && Array.isArray(character.character.hitDice)) {
      const minimalHitDice = toMinimalHitDiceList(character.character.hitDice);
      if (minimalHitDice) minimalCharacter.hitDice = minimalHitDice;
    }
    
    if (character.character?.currency) minimalCharacter.currency = character.character.currency;
    
    // Convert spellSlots to minimal format (preserve source grouping)
    if (character.character?.spellSlots) {
      const minimalSpellSlots = convertSpellSlotsRecord(character.character.spellSlots);
      if (minimalSpellSlots) minimalCharacter.spellSlots = minimalSpellSlots;
    }
    
    if (character.character?.deathSavesSuccesses !== undefined) minimalCharacter.dSS = character.character.deathSavesSuccesses;
    if (character.character?.deathSavesFailures !== undefined) minimalCharacter.dSF = character.character.deathSavesFailures;
    minimalCharacter.insp = character.character?.hasInspiration;

    // Helper to remove null/undefined from objects
    const cleanObject = (obj: any) => {
      const cleaned: any = {};
      Object.keys(obj).forEach(key => {
        if (obj[key] !== undefined && obj[key] !== null) {
          cleaned[key] = obj[key];
        }
      });
      return cleaned;
    };

    const result: any = {
      character: minimalCharacter,
    };

    // Include conditions if present
    if (character.conditions && character.conditions.length > 0) {
      result.conditions = character.conditions;
    }

    // Only add arrays if they have content
    if (character.species) {
      const minimalUses = toMinimalUsesList(character.species.uses);
      const minimalNotes = toMinimalNotesList(character.species.notes);
      result.species = cleanObject({
        name: character.species.name,
        source: character.species.source,
        uses: minimalUses,
        notes: minimalNotes,
        entity: null,
      });
    }

    const spells = character.spells
      ?.filter((spell) => (spell.listType === "PREPARED" && (spell.uses && spell.uses.length > 0) || (spell.notes && spell.notes.length > 0)))
      .map((spell) => {
        const minimalUses = toMinimalUsesList(spell.uses);
        const minimalNotes = toMinimalNotesList(spell.notes);
        return cleanObject({
          name: spell.name,
          source: spell.source,
          uses: minimalUses,
          notes: minimalNotes,
          cSN: spell.castingSourceName,
          entity: null,
        });
      });
    if (spells && spells.length > 0) {
      result.spells = spells;
    }

    const features = character.features
      ?.filter((feature) => (feature.uses && feature.uses.length > 0) || (feature.notes && feature.notes.length > 0))
      .map((feature) => {
        const minimalUses = toMinimalUsesList(feature.uses);
        const minimalNotes = toMinimalNotesList(feature.notes);
        return cleanObject({
          name: feature.name,
          source: feature.source,
          uses: minimalUses,
          notes: minimalNotes,
          featureEntity: null,
          featEntity: null,
          optionalFeatureEntity: null,
          fSN: feature.featureSourceName,
          fT: feature.featureType,
        });
      });
    if (features && features.length > 0) {
      result.features = features;
    }

    console.log('Monsters before filtering:', character.monsters);
    const monsters = character.monsters
    ?.filter((monster) => monster.hpEnabled)
    .map((monster) => cleanObject({
        name: monster.name,
        source: monster.source,
        mCHP: monster.monsterCurrentHP ?? monster.monsterMaxHP ?? 0,
        mTHP: monster.monsterTempHP ?? 0,
        mMHPO: monster.monsterMaxHpOverride,
    }));
    if (monsters && monsters.length > 0) {
      result.monsters = monsters;
    }

    const inventory = character.inventory?.filter((item) => (item.uses && item.uses.length > 0) || (item.notes && item.notes.length > 0) || item.allowMultiples || item.isDummy).map((item) => {
      const minimalUses = toMinimalUsesList(item.uses);
      const minimalNotes = toMinimalNotesList(item.notes);
      return cleanObject({
        name: item.name,
        source: item.source,
        aM: item.allowMultiples,
        count: item.count,
        iE: item.isEquipped,
        iA: item.isAttuned,
        uses: minimalUses,
        notes: minimalNotes,
        isDummy: item.isDummy,
        entity: null,
      });
    });
    if (inventory && inventory.length > 0) {
      result.inventory = inventory;
    }

    return result;
  }

  /**
   * Generate a QR code image from the character's minimal export
   * Uses gzip compression to fit larger character data
   */
  async generateQRCode(character: ExportedCharacter, errorCorrectionLevel: 'L' | 'M' | 'Q' | 'H' = 'L'): Promise<string> {
    if (!this.isBrowser) {
      throw new Error('QR code generation is only available in the browser');
    }

    const minimalExport = this.createMinimalExport(character);
    const jsonString = JSON.stringify(minimalExport);

    console.log('Original JSON size:', jsonString.length, 'bytes');

    try {
      const { Encoder, Byte, deflate } = await this.loadQrDeps();

      // Compress the JSON using gzip (deflate)
      const compressed = deflate(jsonString, { level: 9 });

      // Convert Uint8Array to base64
      const base64 = btoa(String.fromCharCode.apply(null, Array.from(compressed)));

      console.log('Compressed size:', base64.length, 'bytes', `(${Math.round((base64.length / jsonString.length) * 100)}% of original)`);

      const encoder = new Encoder({ level: errorCorrectionLevel });
      const qrCode = encoder.encode(new Byte(base64));
      const moduleSize = Math.max(2, Math.floor(300 / qrCode.size));

      return qrCode.toDataURL(moduleSize, { margin: 1 });
    } catch (error) {
      console.error('Failed to generate QR code:', error);
      // Provide detailed error message for debugging
      console.error('Character data that failed to encode:', minimalExport);
      const msg = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to generate QR code: ${msg} (Original: ${jsonString.length} bytes)`);
    }
  }

  /**
   * Get the JSON string that would be encoded in the QR code (for debugging)
   */
  getMinimalExportJson(character: ExportedCharacter): string {
    const minimalExport = this.createMinimalExport(character);
    return JSON.stringify(minimalExport);
  }
}
