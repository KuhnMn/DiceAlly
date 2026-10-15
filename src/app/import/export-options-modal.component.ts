import { UiIconComponent } from '../ui-icon.component';
import { AppDialogService } from '../services/app-dialog.service';
import { Component, inject, input, output, signal, effect, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CharacterLibraryService } from '../characters/character-library.service';
import { CharacterSharingService } from '../characters/character-sharing.service';
import { ExportedCharacter } from '../models/character.model';

type ExportMode = 'select' | 'json' | 'share';

@Component({
  selector: 'app-export-options-modal',
  imports: [UiIconComponent, CommonModule],
  template: `
    <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" (click)="close.emit()">
      <div class="bg-surface-container-highest rounded-lg p-6 max-w-md w-full max-h-[90vh] overflow-y-auto" (click)="$event.stopPropagation()">
        <div class="flex justify-between items-center mb-4">
          <h2 class="text-2xl font-bold text-on-surface">
            @if (mode() === 'select') {
              Export Character
            } @else if (mode() === 'json') {
              JSON Downloaded
            } @else if (mode() === 'share') {
              @if (isUploading()) {
                Uploading...
              } @else if (shareCode()) {
                Share Code Ready
              } @else {
                Upload Failed
              }
            }
          </h2>
          <button
            (click)="close.emit()"
            class="text-on-surface-variant hover:text-on-surface text-2xl leading-none"
          >
            <app-ui-icon name="close" />
          </button>
        </div>

        @if (mode() === 'select') {
          
          <p class="text-on-surface-variant mb-6">
            Choose how you want to export <strong>{{ characterName() }}</strong>:
          </p>

          <div class="space-y-3">
            <button
              (click)="exportJson()"
              class="w-full px-6 py-4 bg-primary-container text-on-primary-container font-medium rounded-lg hover:bg-primary-container transition-colors text-left"
            >
              <div class="flex items-center">
                <span class="text-2xl mr-3"><app-ui-icon name="file" /></span>
                <div>
                  <div class="font-semibold">Download JSON</div>
                  <div class="text-sm opacity-90">Save to your device</div>
                </div>
              </div>
            </button>

            <button
              (click)="createShareCode()"
              class="w-full px-6 py-4 bg-secondary-container text-on-secondary-container font-medium rounded-lg hover:bg-secondary transition-colors text-left"
            >
              <div class="flex items-center">
                <span class="text-2xl mr-3">#</span>
                <div>
                  <div class="font-semibold">Share via Code Sync</div>
                  <div class="text-sm opacity-90">Create a code for an approved user</div>
                </div>
              </div>
            </button>

          </div>
        } @else if (mode() === 'json') {
          
          <p class="text-on-surface-variant mb-4">
            <app-ui-icon name="check" /> Your character has been downloaded as a JSON file.
          </p>
          <button
            (click)="close.emit()"
            class="w-full px-4 py-2 bg-primary text-on-primary font-medium rounded-lg hover:bg-primary-container transition-colors"
          >
            Done
          </button>
        } @else if (mode() === 'share') {
          
          @if (isUploading()) {
            <div class="flex flex-col items-center py-8">
              <div class="animate-spin text-4xl mb-4"><app-ui-icon name="loader" /></div>
              <p class="text-on-surface-variant">Creating a private share code...</p>
            </div>
          } @else if (shareCode()) {
            <p class="text-on-surface-variant mb-4">
              Your character has been uploaded. Share the Share Code below:
            </p>

            

            <div class="mb-4 p-4 bg-surface-container rounded-lg border-2 border-outline-variant">
              <p class="text-xs text-on-surface-variant font-semibold mb-2">Share Code</p>
              <p class="text-sm font-mono text-primary break-all">{{ shareCode() }}</p>
            </div>

            <div class="space-y-2 mb-4">
              <p class="text-xs text-on-surface-variant">
                <span class="font-semibold">Note:</span> Codes expire after 24 hours. Importing creates an independent copy; later edits are not linked.
              </p>
            </div>

            <div class="flex flex-col gap-2">
              
              <button
                (click)="copyCodeToClipboard()"
                class="px-4 py-2 bg-secondary-container text-on-secondary-container font-medium rounded-lg hover:bg-secondary transition-colors"
              >
                <app-ui-icon name="copy" /> Copy Share Code
              </button>
              <button (click)="revokeCode()" class="px-4 py-2 rounded-lg bg-rose-container text-on-rose-container">Revoke Code</button>
              <button
                (click)="close.emit()"
                class="px-4 py-2 bg-surface-container text-on-surface font-medium rounded-lg hover:bg-surface-container-high transition-colors"
              >
                Close
              </button>
            </div>
          } @else if (uploadError()) {
            <div class="mb-4 p-4 bg-error-container text-on-error-container rounded-lg">
              <p class="font-semibold mb-2">Upload Failed</p>
              <p class="text-sm">{{ uploadError() }}</p>
            </div>
            <div class="flex gap-2">
              <button
                (click)="createShareCode()"
                class="flex-1 px-4 py-2 bg-primary text-on-primary font-medium rounded-lg hover:bg-primary-container transition-colors"
              >
                Try Again
              </button>
              <button
                (click)="resetToSelect()"
                class="flex-1 px-4 py-2 bg-surface-container text-on-surface font-medium rounded-lg hover:bg-surface-container-high transition-colors"
              >
                Back
              </button>
            </div>
          }
        }
      </div>

      @if (snackbarMessage()) {
        <div
          class="fixed bottom-6 left-1/2 -translate-x-1/2 px-4 py-2 rounded-lg bg-surface-container text-on-surface shadow-lg border border-outline z-[60]"
          role="status"
          aria-live="polite"
        >
          {{ snackbarMessage() }}
        </div>
      }
    </div>
  `,
})
export class ExportOptionsModalComponent {
  private readonly dialogs = inject(AppDialogService);
  characterId = input.required<string>();
  close = output<void>();

  private library = inject(CharacterLibraryService);
  private sharing = inject(CharacterSharingService);

  mode = signal<ExportMode>('select');
  character = signal<ExportedCharacter | null>(null);
  
  // Share mode
  isUploading = signal<boolean>(false);
  shareCode = signal<string | null>(null);
  uploadError = signal<string | null>(null);
  
  snackbarMessage = signal<string | null>(null);

  private snackbarTimeout: ReturnType<typeof setTimeout> | null = null;

  characterName = computed(() => this.character()?.character?.name || 'Unknown');

  constructor() {
    // Load character when component initializes
    effect(onCleanup => {
      const id = this.characterId();
      let active = true;
      this.character.set(null);
      void this.library.get(id).then(record => {
        if (active) this.character.set(record?.sheet ?? null);
      }).catch(error => { if (active) this.uploadError.set(String(error)); });
      onCleanup(() => { active = false; });
    });
  }

  exportJson() {
    const character = this.character();
    if (!character?.character?.characterUuid) return;

    const jsonString = JSON.stringify(character, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${character.character.name}_export.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    this.mode.set('json');
  }

  async createShareCode() {
    const character = this.character();
    if (!character) return;

    this.mode.set('share');
    this.isUploading.set(true);
    this.shareCode.set(null);
    this.uploadError.set(null);

    try { this.shareCode.set(await this.sharing.create(character)); }
    catch (error) { this.uploadError.set(error instanceof Error ? error.message : 'Could not create a share code.'); }
    finally { this.isUploading.set(false); }
  }
  async revokeCode() {
    const code = this.shareCode();
    if (!code) return;
    this.isUploading.set(true);
    try { await this.sharing.revoke(code); this.resetToSelect(); }
    catch (error) { this.uploadError.set(String(error)); }
    finally { this.isUploading.set(false); }
  }

  async copyCodeToClipboard() {
    const id = this.shareCode();
    if (!id) return;

    try {
      await navigator.clipboard.writeText(id);
      this.showSnackbar('Share code copied to clipboard.');
    } catch (error) {
      await this.dialogs.showCopy('Copy the Share Code below:', id);
    }
  }

  private showSnackbar(message: string) {
    this.snackbarMessage.set(message);

    if (this.snackbarTimeout) {
      clearTimeout(this.snackbarTimeout);
    }

    this.snackbarTimeout = setTimeout(() => {
      this.snackbarMessage.set(null);
      this.snackbarTimeout = null;
    }, 2500);
  }

  resetToSelect() {
    this.mode.set('select');
    this.shareCode.set(null);
    this.uploadError.set(null);
  }
}
