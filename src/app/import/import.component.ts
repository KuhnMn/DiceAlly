import { UiIconComponent } from '../ui-icon.component';
import { Component, inject, signal, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NavigationCancel, NavigationEnd, NavigationError, NavigationSkipped, NavigationStart, Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CharacterLibraryService, CharacterSummary, CharacterImportResult } from '../characters/character-library.service';

import { CharacterSharingService } from '../characters/character-sharing.service';

import { ThemeService, type Theme } from '../services/theme.service';
import { ExportOptionsModalComponent } from './export-options-modal.component';
import { RemoveEntryDialogComponent } from '../editor/remove-entry-dialog.component';
import { LibraryNavigationComponent } from '../library-navigation.component';

@Component({
  selector: 'app-import',
  imports: [LibraryNavigationComponent, UiIconComponent, CommonModule, FormsModule, RouterLink, ExportOptionsModalComponent, RemoveEntryDialogComponent],
  template: `
    <main class="home-screen max-w-[1000px] mx-auto my-8 p-4">
      <app-library-navigation />
      <section aria-label="Explore your library" class="library-shortcuts mb-6 grid gap-3 sm:grid-cols-2">
        <a routerLink="/compendium" class="flex min-w-0 items-start gap-3 rounded-xl border border-outline-variant bg-primary-container p-4 text-on-primary-container hover:brightness-110 focus-visible:outline-2 focus-visible:outline-primary">
          <app-ui-icon name="book" class="mt-1 shrink-0 text-2xl" />
          <div><h2 class="text-lg font-bold">Explore the Compendium</h2><p class="mt-1 text-sm">Look up classes, spells, species and rules from your library.</p><span class="mt-3 inline-flex items-center gap-1 text-sm font-semibold">Browse Categories <app-ui-icon name="right" /></span></div>
        </a>
        <a routerLink="/content" class="flex min-w-0 items-start gap-3 rounded-xl border border-outline-variant bg-surface-container p-4 hover:bg-surface-container-high focus-visible:outline-2 focus-visible:outline-primary">
          <app-ui-icon name="stack" class="mt-1 shrink-0 text-2xl text-primary" />
          <div><h2 class="text-lg font-bold">Manage Game Data</h2><p class="mt-1 text-sm text-on-surface-variant">Install or update your rules library and add homebrew files.</p><span class="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-primary">Manage Library <app-ui-icon name="right" /></span></div>
        </a>
      </section>
      @if (library.error()) { <p role="alert" class="mb-4 text-error">{{ library.error() }}</p> }
      @for (issue of library.migrationIssues(); track issue) { <p role="alert" class="text-error">{{ issue }}</p> }
      <!-- Saved Characters Section -->
      @let characters = savedCharacters();
      @if (characters.length >= 0) {
        <section class="character-library mb-12" aria-labelledby="character-library-title" [attr.aria-busy]="loadingCharacters() || !!openingCharacter()">
          <div class="library-header flex flex-col sm:flex-row justify-between items-start mb-4">
            <div class="library-heading flex flex-col items-start justify-between">
              <h2 id="character-library-title" class="text-3xl font-bold mb-2">Your Characters</h2>
              <p class="text-on-surface-variant mb-4">Saved on this device and synced with your account</p>
              @if (creatorAvailable) {
                <nav aria-label="Character library actions" class="flex flex-wrap gap-2 mb-4">
                  <a routerLink="/characters/new" class="px-4 py-2 rounded-lg bg-primary text-on-primary text-sm font-semibold hover:opacity-90 transition-opacity">Create Character</a>
                </nav>
              }
            </div>
            <div class="library-theme mb-8 flex justify-end">
              <label class="text-sm font-medium flex items-center gap-2">
                <span class="theme-caption text-on-surface-variant">Theme:</span>
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

          @if (loadingCharacters()) {
            <p role="status" class="mb-4 flex items-center gap-2 text-sm text-on-surface-variant"><app-ui-icon name="loader" class="animate-spin" />Loading characters…</p>
          }
          @if (openingCharacter()) { <p role="status" class="mb-4 flex items-center gap-2 text-sm text-on-surface-variant"><app-ui-icon name="loader" class="animate-spin" />Opening character…</p> }
          @if (characters.length > 0) {
            <ul class="character-list grid grid-cols-1 md:grid-cols-2 gap-4" aria-label="Saved characters">
              @for (char of characters; track char.characterId) {
                <li class="character-card min-w-0 bg-surface-container border-2 border-outline-variant rounded-lg p-4 hover:bg-surface-container-high transition-colors" [attr.aria-busy]="openingCharacter()?.id === char.characterId">
                  <div class="character-header flex items-start justify-between gap-2 mb-3">
                    <div class="min-w-0 flex-1">
                      <div class="character-title">
                        <h3 class="text-lg font-semibold text-on-surface [overflow-wrap:anywhere]">{{ char.name }}</h3>
                        <p class="character-level text-sm text-on-surface-variant">Level {{ char.level }}</p>
                      </div>
                      <p class="character-description text-sm text-on-surface-variant [overflow-wrap:anywhere]">{{ char.description }}</p>
                    </div>
                    <div class="character-date text-xs text-on-surface-variant">
                      {{ formatDate(char.lastModified) }}
                    </div>
                  </div>
                  <div class="character-actions grid gap-2" [class.grid-cols-3]="creatorAvailable" [class.grid-cols-2]="!creatorAvailable">
                    <button
                      (click)="loadCharacter(char.characterId)"
                      [disabled]="!!openingCharacter()"
                      class="col-span-full flex items-center justify-center gap-2 px-4 py-2 bg-primary text-on-primary font-medium rounded text-sm hover:bg-primary-container transition-colors disabled:opacity-60"
                    >
                      @if (openingCharacter()?.id === char.characterId && !openingCharacter()?.editing) { <app-ui-icon name="loader" class="animate-spin" />Opening… } @else { Load }
                    </button>
                    @if (creatorAvailable) { <a [routerLink]="openingCharacter() ? null : ['/characters', char.characterId, 'edit']" [attr.aria-disabled]="openingCharacter() ? true : null" [attr.tabindex]="openingCharacter() ? -1 : null" class="flex items-center justify-center gap-1 px-2 py-2 rounded bg-secondary-container text-on-secondary-container text-center text-sm" [class.opacity-60]="!!openingCharacter()">@if (openingCharacter()?.id === char.characterId && openingCharacter()?.editing) { <app-ui-icon name="loader" class="animate-spin" /><span class="sr-only">Opening character editor…</span> } @else { Edit }</a> }
                    <button
                      (click)="downloadCharacter(char.characterId)"
                      class="px-2 py-2 bg-secondary-container text-on-secondary-container font-medium rounded text-sm hover:bg-secondary transition-colors"
                    >
                      Export
                    </button>
                    <button
                      (click)="requestDeleteCharacter(char)"
                      [disabled]="deleting() || !!openingCharacter()"
                      class="px-2 py-2 bg-rose-container text-on-rose-container font-medium rounded text-sm hover:bg-rose transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                  <p class="character-id text-on-surface-variant text-xs pt-2 [overflow-wrap:anywhere]">Id: {{ char.characterId }}</p>
                </li>
              }
            </ul>
            <div class="mt-4 text-xs text-on-surface-variant">
              Storage used: {{ getStorageUsage() | number:'1.2-2' }} KB
            </div>
          } @else if (!loadingCharacters()) {
            <div class="bg-surface-container-low p-6 rounded-lg text-center">
              <p class="text-on-surface-variant">No saved characters yet. Import or create one below.</p>
            </div>
          }
        </section>
      }

      <!-- Import Section -->
      <section class="character-import border-t-2 border-outline pt-8" aria-labelledby="character-import-title">
        <h2 id="character-import-title" class="text-3xl font-bold mb-2">Import Character</h2>
        <p class="text-on-surface-variant mb-6">Load a character from a JSON file, Share Code, or JSON paste</p>

        <!-- URL Import -->
        <div class="share-code-import mb-6">
          <label class="block">
            <span class="block text-sm font-medium mb-3">Import Share Code</span>
            <div class="flex gap-2">
              <input
                [(ngModel)]="importUrl"
                type="text"
                (keydown.enter)="importFromUrl()"
                placeholder="XXXXXX-XXXXXX-XXXXXX-XXXXXX"
                class="min-w-0 flex-1 px-4 py-2 border-2 border-outline-variant rounded focus:ring-2 focus:ring-primary focus:border-primary outline-none bg-surface text-on-surface"
              />
              <button
                (click)="importFromUrl()"
                [disabled]="!importUrl.trim() || isLoadingUrl()"
                class="px-6 py-2 bg-primary text-on-primary font-semibold rounded hover:bg-primary-container transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                @if (isLoadingUrl()) {
                  <span class="inline-block animate-spin"><app-ui-icon name="loader" /></span>
                } @else {
                  Load
                }
              </button>
            </div>
            <p class="text-xs text-on-surface-variant mt-2">Paste a Share Code from another approved user. You will receive your own independent copy.</p>
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

        <div class="import-methods grid grid-cols-1 lg:grid-cols-2 gap-8">
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
            <div class="mt-4 border-t border-outline-variant pt-4">
              <button type="button" (click)="legacyFileInput.click()" [disabled]="isConvertingLegacy()"
                class="flex w-full items-center justify-center gap-2 rounded bg-secondary-container px-4 py-3 font-semibold text-on-secondary-container disabled:opacity-50">
                @if (isConvertingLegacy()) { <span class="inline-flex animate-spin"><app-ui-icon name="loader" /></span> }
                {{ isConvertingLegacy() ? 'Converting old export…' : 'Import old app export' }}
              </button>
              <input #legacyFileInput hidden type="file" accept=".json,application/json" (change)="onFile($event, true)" />
              <p class="mt-2 text-xs text-on-surface-variant">Converts old app JSON, merges sources, and matches entries against your installed game data.</p>
            </div>
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
            <button type="button" (click)="loadFromText(true)" [disabled]="!raw.trim() || isConvertingLegacy()"
              class="mt-2 w-full rounded border border-outline-variant px-4 py-2 text-sm font-semibold text-on-surface disabled:opacity-50">Import old JSON from text</button>
          </div>
        </div>
      </section>

      <!-- Export Options Modal -->
      @if (pendingDeletion(); as character) {
        <app-remove-entry-dialog [name]="character.name" action="Delete"
          message="This character and its notes will be removed from this device."
          (cancelled)="pendingDeletion.set(null)" (confirmed)="confirmDeleteCharacter()" />
      }
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
  protected library = inject(CharacterLibraryService);
  readonly creatorAvailable = true;
  private reloadVersion = 0;
  private sharing = inject(CharacterSharingService);
  private router = inject(Router);
  protected themeService = inject(ThemeService);

  raw = '';
  importUrl = '';
  savedCharacters = signal<CharacterSummary[]>([]);
  readonly loadingCharacters = signal(true);
  readonly openingCharacter = signal<{ id: string; editing: boolean } | null>(null);
  importError = signal<{ code: string; message: string } | null>(null);
  pendingImport = signal<{ json: string; override: boolean; legacy?: boolean } | null>(null);
  readonly isConvertingLegacy = signal(false);
  isLoadingUrl = signal<boolean>(false);
  exportingCharacterId = signal<string | null>(null);
  pendingDeletion = signal<CharacterSummary | null>(null);
  deleting = signal(false);

  constructor() {
    this.router.events.pipe(takeUntilDestroyed()).subscribe(event => {
      if (event instanceof NavigationStart) {
        const segments = this.router.parseUrl(event.url).root.children['primary']?.segments ?? [];
        if (segments[0]?.path === 'characters' && segments[1] && segments[1].path !== 'new') {
          this.openingCharacter.set({ id: segments[1].path, editing: segments[2]?.path === 'edit' });
        }
      } else if (event instanceof NavigationEnd || event instanceof NavigationCancel || event instanceof NavigationError || event instanceof NavigationSkipped) {
        this.openingCharacter.set(null);
      }
    });
    // Watch for save events and reload
    effect(() => {
      this.library.changed();
      this.reload();
    });
  }

  async reload() {
    const request = ++this.reloadVersion;
    this.loadingCharacters.set(true);
    try {
      const characters = await this.library.summaries();
      if (request === this.reloadVersion) this.savedCharacters.set(characters);
    } catch (error) { if (request === this.reloadVersion) this.library.error.set(String(error)); }
    finally { if (request === this.reloadVersion) this.loadingCharacters.set(false); }
  }

  async onFile(event: Event, legacy = false) {
    const input = event.target as HTMLInputElement;
    if (input.files?.[0]) await this.importFile(input.files[0], legacy);
    input.value = '';
  }

  async onDrop(event: DragEvent) {
    event.preventDefault();
    const file = event.dataTransfer?.files[0];
    if (file) await this.importFile(file);
  }

  private async importFile(file: File, legacy = false) {
    try { this.raw = await file.text(); await this.loadFromText(legacy); }
    catch (error) { this.importError.set({ code: 'UNKNOWN', message: String(error) }); }
  }

  async loadFromText(legacy = false) {
    if (this.isConvertingLegacy()) return;
    this.isConvertingLegacy.set(legacy);
    try {
      const result = legacy ? await this.library.importLegacyCharacterFromJson(this.raw)
        : await this.library.importCharacterFromJson(this.raw);
      this.handleImportResult(result, legacy);
    } finally { this.isConvertingLegacy.set(false); }
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

      jsonContent = JSON.stringify(await this.sharing.redeem(this.importUrl));

      this.raw = jsonContent;
      const result = await this.library.importCharacterFromJson(jsonContent);
      this.handleImportResult(result);
      this.importUrl = ''; // Clear URL on success
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.importError.set({
        code: 'UNKNOWN',
        message: `Could not import this share code: ${message}`,
      });
    } finally {
      this.isLoadingUrl.set(false);
    }
  }

  async loadCharacter(characterId: string) {
    if (this.openingCharacter()) return;
    this.openingCharacter.set({ id: characterId, editing: false });
    try { await this.router.navigate(['/characters', characterId]); }
    catch (error) { this.library.error.set(String(error)); }
    finally { this.openingCharacter.set(null); }
  }

  downloadCharacter(characterId: string) {
    this.exportingCharacterId.set(characterId);
  }

  closeExportModal() {
    this.exportingCharacterId.set(null);
  }

  requestDeleteCharacter(character: CharacterSummary) {
    if (!this.deleting()) this.pendingDeletion.set(character);
  }

  async confirmDeleteCharacter() {
    const character = this.pendingDeletion();
    if (!character || this.deleting()) return;
    this.pendingDeletion.set(null);
    this.deleting.set(true);
    this.library.error.set('');
    try { await this.library.delete(character.characterId, character.version); await this.reload(); }
    catch (error) { this.library.error.set(String(error)); }
    finally { this.deleting.set(false); }
  }

  async confirmOverride() {
    const pending = this.pendingImport();
    if (!pending || this.isConvertingLegacy()) return;
    this.isConvertingLegacy.set(!!pending.legacy);
    try {
      const result = pending.legacy ? await this.library.importLegacyCharacterFromJson(pending.json, true)
        : await this.library.importCharacterFromJson(pending.json, true);
      this.handleImportResult(result, !!pending.legacy);
    } finally { this.isConvertingLegacy.set(false); }
  }

  clearImportError() {
    this.importError.set(null);
    this.pendingImport.set(null);
  }

  private handleImportResult(result: CharacterImportResult, legacy = false) {
    if (result.success) {
      this.importError.set(null);
      this.raw = '';
      this.pendingImport.set(null);
      this.loadCharacter(result.characterId!);
    } else if (result.error?.code === 'IMPORT_CONFLICT') {
      this.pendingImport.set({ json: this.raw, override: false, legacy });
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
    return this.library.storageBytes() / 1024; // Convert to KB
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
