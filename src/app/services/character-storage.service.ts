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
  // Signal to track when character data changes
  characterSaved = signal<{ characterId: string; timestamp: number } | null>(null);

  private get isBrowser(): boolean {
    return isPlatformBrowser(this.platformId);
  }

  private generateCharacterId(): string {
    return `char_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
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

}
