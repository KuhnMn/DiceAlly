import { Component, inject, signal, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { CharacterStore } from '../stores/character.store';
import { CharacterStorageService, SavedCharacterMetadata } from '../services/character-storage.service';
import { TmpfilesService } from '../services/tmpfiles.service';
import { UnsavedChangesGuard } from '../guards/unsaved-changes.guard';
import { ThemeService, type Theme } from '../services/theme.service';
import { ExportOptionsModalComponent } from './export-options-modal.component';
import type { ExportedCharacter } from '../models/character.model';

@Component({
  selector: 'app-import',
  imports: [CommonModule, FormsModule, ExportOptionsModalComponent],
  template: `
    <main class="max-w-[1000px] mx-auto my-8 p-4">
      <!-- Saved Characters Section -->
      @let characters = savedCharacters();
      @if (characters.length >= 0) {
        <section class="mb-12">
          <div class="flex flex-row justify-between items-start mb-4">
            <div class="flex flex-col items-start justify-between">
              <h2 class="text-3xl font-bold mb-2">Your Characters</h2>
              <p class="text-on-surface-variant mb-6">Saved locally on this device</p>
            </div>
            <div class="mb-8 flex justify-end">
              <label class="text-sm font-medium flex items-center gap-2">
                <span class="text-on-surface-variant">Theme:</span>
                <select
                  [value]="themeService.currentTheme()"
                  (change)="onThemeChange($event)"
                  class="px-3 py-2 text-sm font-medium transition-colors rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface border border-outline-variant cursor-pointer"
                  title="Select color theme"
                  aria-label="Select color theme"
                >
                  <option value="light-mc">☀️ Light (Monte Carlo)</option>
                  <option value="dark-mc">🌙 Dark (Monte Carlo)</option>
                  <option value="light-royal">✨ Light (Royal)</option>
                  <option value="dark-royal">👑 Dark (Royal)</option>
                  <option value="light-ethereal">🌌 Light (Ethereal)</option>
                  <option value="dark-ethereal">💜 Dark (Ethereal)</option>
                  <option value="light-forge">🔥 Light (Forge)</option>
                  <option value="dark-forge">⚒️ Dark (Forge)</option>
                  <option value="light-glade">🌿 Light (Glade)</option>
                  <option value="dark-glade">🍃 Dark (Glade)</option>
                </select>
              </label>
            </div>
          </div>

          @if (characters.length > 0) {
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              @for (char of characters; track char.characterId) {
                <div class="bg-surface-container border-2 border-outline-variant rounded-lg p-4 hover:bg-surface-container-high transition-colors">
                  <div class="flex items-start justify-between mb-3">
                    <div>
                      <h3 class="text-lg font-semibold text-on-surface">{{ char.name }}</h3>
                      <p class="text-sm text-on-surface-variant">Level {{ char.level }}</p>
                      <p class="text-sm text-on-surface-variant">{{ char.description }}</p>
                    </div>
                    <div class="text-xs text-on-surface-variant">
                      {{ formatDate(char.lastModified) }}
                    </div>
                  </div>
                  <div class="flex gap-2">
                    <button
                      (click)="loadCharacter(char.characterId)"
                      class="flex-1 px-4 py-2 bg-primary text-on-primary font-medium rounded text-sm hover:bg-primary-container transition-colors"
                    >
                      Load
                    </button>
                    <button
                      (click)="downloadCharacter(char.characterId)"
                      class="flex-1 px-4 py-2 bg-secondary-container text-on-secondary-container font-medium rounded text-sm hover:bg-secondary transition-colors"
                    >
                      Export
                    </button>
                    <button
                      (click)="deleteCharacter(char.characterId)"
                      class="flex-1 px-4 py-2 bg-rose-container text-on-rose-container font-medium rounded text-sm hover:bg-rose transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                  <p class="text-on-surface-variant text-xs pt-2">Id: {{ char.characterId }}</p>
                  <p class="text-on-surface-variant text-xs pt-2">Installation: {{ char.installationId }}</p>
                </div>
              }
            </div>
            <div class="mt-4 text-xs text-on-surface-variant">
              Storage used: {{ getStorageUsage() | number:'1.2-2' }} KB
            </div>
          } @else {
            <div class="bg-surface-container-low p-6 rounded-lg text-center">
              <p class="text-on-surface-variant">No saved characters yet. Import or create one below.</p>
            </div>
          }
        </section>
      }

      <!-- Import Section -->
      <section class="border-t-2 border-outline pt-8">
        <h2 class="text-3xl font-bold mb-2">Import Character</h2>
        <p class="text-on-surface-variant mb-6">Load a character from a JSON file, temporary share link, or JSON paste</p>

        <!-- URL Import -->
        <div class="mb-6">
          <label class="block">
            <span class="block text-sm font-medium mb-3">Import from URL or File ID</span>
            <div class="flex gap-2">
              <input
                [(ngModel)]="importUrl"
                type="text"
                (keydown.enter)="importFromUrl()"
                placeholder="URL or 6-digit share ID"
                class="flex-1 px-4 py-2 border-2 border-outline-variant rounded focus:ring-2 focus:ring-primary focus:border-primary outline-none bg-surface text-on-surface"
              />
              <button
                (click)="importFromUrl()"
                [disabled]="!importUrl.trim() || isLoadingUrl()"
                class="px-6 py-2 bg-primary text-on-primary font-semibold rounded hover:bg-primary-container transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                @if (isLoadingUrl()) {
                  <span class="inline-block animate-spin">⟳</span>
                } @else {
                  Load
                }
              </button>
            </div>
            <p class="text-xs text-on-surface-variant mt-2">Paste a full share link, or just the short share ID from the link</p>
          </label>
        </div>

        @if (importError(); as error) {
          <div class="mb-6 p-4 bg-error-container text-on-error-container rounded-lg">
            <p class="font-semibold mb-2">{{ error.message }}</p>
            @if (error.code === 'IMPORT_CONFLICT') {
              <div class="flex flex-row gap-2">
                              <button
                (click)="confirmOverride()"
                class="mt-2 px-4 py-2 bg-rose-container text-on-rose-container font-medium rounded text-sm hover:opacity-90 transition-opacity"
              >
                Override and Load
              </button>
                <button
                (click)="clearImportError()"
                class="mt-2 px-4 py-2 bg-rose text-on-rose font-medium rounded text-sm hover:opacity-90 transition-opacity"
              >
                Cancel
              </button>
              </div>

            }
          </div>
        }

        <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <!-- File Upload -->
          <div>
            <label class="block">
              <span class="block text-sm font-medium mb-3">Upload File</span>
              <div
                class="upload-desktop border-2 border-dashed border-outline-variant rounded-lg p-8 text-center cursor-pointer hover:bg-surface-container transition-colors"
                (click)="fileInput.click()"
                (drop)="onDrop($event)"
                (dragover)="$event.preventDefault()"
              >
                <p class="text-on-surface-variant">Drop a JSON file here or click to browse</p>
              </div>
              <button
                type="button"
                class="upload-mobile w-full px-4 py-3 bg-secondary-container text-on-secondary-container font-semibold rounded hover:bg-secondary transition-colors"
                (click)="fileInput.click()"
              >
                Choose JSON File
              </button>
              <input
                #fileInput
                hidden
                type="file"
                accept="application/json"
                (change)="onFile($event)"
              />
            </label>
          </div>

          <!-- Paste JSON -->
          <div>
            <label class="block">
              <span class="block text-sm font-medium mb-3">Or Paste JSON</span>
              <textarea 
                [(ngModel)]="raw" 
                class="w-full h-48 font-mono text-sm p-3 border-2 border-outline-variant rounded focus:ring-2 focus:ring-primary focus:border-primary outline-none bg-surface text-on-surface"
                placeholder="Paste your character JSON here..."
              ></textarea>
            </label>
            <button 
              (click)="loadFromText()"
              class="mt-3 px-6 py-2 bg-primary text-on-primary font-semibold rounded hover:bg-primary-container transition-colors disabled:bg-surface-variant disabled:cursor-not-allowed w-full"
              [disabled]="!raw.trim()"
            >
              Load from Text
            </button>
          </div>
        </div>
      </section>

      <!-- Export Options Modal -->
      @if (exportingCharacterId()) {
        <app-export-options-modal
          [characterId]="exportingCharacterId()!"
          (close)="closeExportModal()"
        />
      }
    </main>
  `,
  styleUrl: './import.component.css',
})
export class ImportComponent {
  private store = inject(CharacterStore);
  private storage = inject(CharacterStorageService);
  private tmpfiles = inject(TmpfilesService);
  private router = inject(Router);
  private unsavedChangesGuard = inject(UnsavedChangesGuard);
  protected themeService = inject(ThemeService);

  raw = '';
  importUrl = '';
  savedCharacters = signal<SavedCharacterMetadata[]>([]);
  importError = signal<{ code: string; message: string } | null>(null);
  pendingImport = signal<{ json: string; override: boolean } | null>(null);
  isLoadingUrl = signal<boolean>(false);
  exportingCharacterId = signal<string | null>(null);

  constructor() {
    // Reload saved characters list
    this.reload();
    // Watch for save events and reload
    effect(() => {
      this.storage.characterSaved();
      this.reload();
    });
  }

  reload() {
    this.savedCharacters.set(this.storage.listCharacters());
  }

  onFile(event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;
    const file = input.files[0];
    const reader = new FileReader();
    reader.onload = () => {
      const json = reader.result as string;
      this.raw = json; // Store in raw so it's available for override
      this.storage.importCharacterFromFile(file).then((result) => {
        this.handleImportResult(result);
      });
    };
    reader.readAsText(file);
  }

  onDrop(event: DragEvent) {
    event.preventDefault();
    const files = event.dataTransfer?.files;
    if (!files || files.length === 0) return;
    const file = files[0];
    if (file.type === 'application/json') {
      const reader = new FileReader();
      reader.onload = () => {
        const json = reader.result as string;
        this.raw = json; // Store in raw so it's available for override
        this.storage.importCharacterFromFile(file).then((result) => {
          this.handleImportResult(result);
        });
      };
      reader.readAsText(file);
    }
  }

  loadFromText() {
    const result = this.storage.importCharacterFromJson(this.raw);
    this.handleImportResult(result);
  }

  onThemeChange(event: Event) {
    const select = event.target as HTMLSelectElement | null;
    if (!select) return;
    this.themeService.setTheme(select.value as Theme);
  }

  async importFromUrl() {
    if (!this.importUrl.trim()) return;

    this.isLoadingUrl.set(true);
    try {
      let jsonContent: string;

      // Check if this is a worker-backed temporary share URL.
      if (this.tmpfiles.isTmpfilesUrl(this.importUrl)) {
        const result = await this.tmpfiles.downloadCharacter(this.importUrl);
        if (!result.success) {
          throw new Error(result.error || 'Failed to download from temporary share storage');
        }
        jsonContent = JSON.stringify(result.character);
      } else {
        // Standard URL import
        const response = await fetch(this.importUrl);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        jsonContent = await response.text();
      }

      this.raw = jsonContent;
      const result = this.storage.importCharacterFromJson(jsonContent);
      this.handleImportResult(result);
      this.importUrl = ''; // Clear URL on success
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      const isTmpfiles = this.tmpfiles.isTmpfilesUrl(this.importUrl);
      this.importError.set({
        code: 'UNKNOWN',
        message: isTmpfiles
          ? `Failed to import from share link: ${message}\n\n💡 Backup option: Click "Copy JSON (Backup)" in the Share modal and paste it below.`
          : `Failed to download from URL: ${message}. Make sure the URL is correct and accessible.`,
      });
    } finally {
      this.isLoadingUrl.set(false);
    }
  }

  loadCharacter(characterId: string) {
    const character = this.storage.loadCharacter(characterId);
    if (character) {
      this.store.setCharacter(character);
      // Mark the loaded character as "saved" so no warning on navigation
      this.unsavedChangesGuard.setLastSavedState(character);
      this.router.navigate(['/sheet']);
    }
  }

  downloadCharacter(characterId: string) {
    this.exportingCharacterId.set(characterId);
  }

  closeExportModal() {
    this.exportingCharacterId.set(null);
  }

  deleteCharacter(characterId: string) {
    if (confirm('Are you sure you want to delete this character?')) {
      this.storage.deleteCharacter(characterId);
      this.reload();
    }
  }

  confirmOverride() {
    const pending = this.pendingImport();
    if (pending) {
      const json = pending.json;
      const result = this.storage.importCharacterFromJson(json, {
        overrideExisting: true,
      });
      this.handleImportResult(result);
    }
  }

  clearImportError() {
    this.importError.set(null);
    this.pendingImport.set(null);
  }

  private handleImportResult(result: { success: boolean; characterId?: string; error?: any }) {
    if (result.success) {
      this.importError.set(null);
      this.raw = '';
      this.pendingImport.set(null);
      const character = this.storage.loadCharacter(result.characterId!);
      if (character) {
        this.store.setCharacter(character);
        // Mark the loaded character as "saved" so no warning on navigation
        this.unsavedChangesGuard.setLastSavedState(character);
        this.router.navigate(['/sheet']);
      }
    } else if (result.error?.code === 'IMPORT_CONFLICT') {
      this.pendingImport.set({ json: this.raw, override: false });
      this.importError.set({
        code: 'IMPORT_CONFLICT',
        message: result.error.message,
      });
    } else {
      this.importError.set({
        code: result.error?.code || 'UNKNOWN',
        message: result.error?.message || 'Failed to import character',
      });
    }
  }

  getStorageUsage(): number {
    return this.storage.getStorageUsage() / 1024; // Convert to KB
  }

  formatDate(timestamp: number): string {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;

    return date.toLocaleDateString();
  }
}
