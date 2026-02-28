import { Component, inject, input, output, signal, effect, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CharacterStorageService } from '../services/character-storage.service';
import { TmpfilesService } from '../services/tmpfiles.service';
import { ExportedCharacter } from '../models/character.model';

type ExportMode = 'select' | 'json' | 'share' | 'qr';

@Component({
  selector: 'app-export-options-modal',
  imports: [CommonModule],
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
              } @else if (shareUrl()) {
                Share Link Ready
              } @else {
                Upload Failed
              }
            } @else if (mode() === 'qr') {
              @if (qrCodeUrl()) {
                QR Code Ready
              } @else {
                Generating QR...
              }
            }
          </h2>
          <button
            (click)="close.emit()"
            class="text-on-surface-variant hover:text-on-surface text-2xl leading-none"
          >
            ✕
          </button>
        </div>

        @if (mode() === 'select') {
          <!-- Initial selection screen -->
          <p class="text-on-surface-variant mb-6">
            Choose how you want to export <strong>{{ characterName() }}</strong>:
          </p>

          <div class="space-y-3">
            <button
              (click)="exportJson()"
              class="w-full px-6 py-4 bg-primary-container text-on-primary-container font-medium rounded-lg hover:bg-primary-container transition-colors text-left"
            >
              <div class="flex items-center">
                <span class="text-2xl mr-3">📄</span>
                <div>
                  <div class="font-semibold">Download JSON</div>
                  <div class="text-sm opacity-90">Save to your device</div>
                </div>
              </div>
            </button>

            <button
              (click)="uploadToTmpfiles()"
              class="w-full px-6 py-4 bg-secondary-container text-on-secondary-container font-medium rounded-lg hover:bg-secondary transition-colors text-left"
            >
              <div class="flex items-center">
                <span class="text-2xl mr-3">🔗</span>
                <div>
                  <div class="font-semibold">Share via Link</div>
                  <div class="text-sm opacity-90">Upload and get shareable URL</div>
                </div>
              </div>
            </button>

            <button
              (click)="generateQRCode()"
              class="w-full px-6 py-4 bg-tertiary-container text-on-tertiary-container font-medium rounded-lg hover:bg-tertiary transition-colors text-left"
            >
              <div class="flex items-center">
                <span class="text-2xl mr-3">📱</span>
                <div>
                  <div class="font-semibold">QR Code</div>
                  <div class="text-sm opacity-90">Scan with mobile device</div>
                </div>
              </div>
            </button>
          </div>
        } @else if (mode() === 'json') {
          <!-- JSON downloaded confirmation -->
          <p class="text-on-surface-variant mb-4">
            ✅ Your character has been downloaded as a JSON file.
          </p>
          <button
            (click)="close.emit()"
            class="w-full px-4 py-2 bg-primary text-on-primary font-medium rounded-lg hover:bg-primary-container transition-colors"
          >
            Done
          </button>
        } @else if (mode() === 'share') {
          <!-- Share link result -->
          @if (isUploading()) {
            <div class="flex flex-col items-center py-8">
              <div class="animate-spin text-4xl mb-4">⟳</div>
              <p class="text-on-surface-variant">Uploading to tmpfiles.org...</p>
            </div>
          } @else if (shareUrl()) {
            <p class="text-on-surface-variant mb-4">
              Your character has been uploaded. Share the link or ID below:
            </p>

            <div class="mb-4 p-4 bg-surface-container rounded-lg border-2 border-outline-variant">
              <p class="text-xs text-on-surface-variant font-semibold mb-2">Share Link</p>
              <p class="text-sm font-mono text-primary break-all">{{ shareUrl() }}</p>
            </div>

            <div class="mb-4 p-4 bg-surface-container rounded-lg border-2 border-outline-variant">
              <p class="text-xs text-on-surface-variant font-semibold mb-2">File ID (Short Form)</p>
              <p class="text-sm font-mono text-primary break-all">{{ fileId() }}</p>
            </div>

            <div class="space-y-2 mb-4">
              <p class="text-xs text-on-surface-variant">
                <span class="font-semibold">Note:</span> Files expire after 30 days.
              </p>
              <p class="text-xs text-on-surface-variant">
                <span class="font-semibold">Tip:</span> You can share just the file ID number for easier import.
              </p>
            </div>

            <div class="flex flex-col gap-2">
              <button
                (click)="copyLinkToClipboard()"
                class="px-4 py-2 bg-primary text-on-primary font-medium rounded-lg hover:bg-primary-container transition-colors"
              >
                📋 Copy Full Link
              </button>
              <button
                (click)="copyIdToClipboard()"
                class="px-4 py-2 bg-secondary-container text-on-secondary-container font-medium rounded-lg hover:bg-secondary transition-colors"
              >
                📋 Copy File ID
              </button>
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
                (click)="uploadToTmpfiles()"
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
        } @else if (mode() === 'qr') {
          <!-- QR Code display -->
          @if (qrCodeUrl()) {
            <p class="text-on-surface-variant mb-4">
              Scan this with your mobile device to import the character.
            </p>

            <div class="flex justify-center mb-4">
              <div class="bg-white p-4 rounded-lg">
                <img [src]="qrCodeUrl()" [alt]="characterName()" class="w-64 h-64" />
              </div>
            </div>

            <div class="space-y-2 mb-4">
              <p class="text-xs text-on-surface-variant">
                <strong>Character:</strong> {{ characterName() }}
              </p>
              <p class="text-xs text-on-surface-variant">
                <strong>Level:</strong> {{ characterLevel() }}
              </p>
              <p class="text-xs text-on-surface-variant">
                <strong>Size:</strong> {{ qrDataSize() }} bytes
              </p>
            </div>

            <div class="flex flex-col gap-2">
              <button
                (click)="downloadMinimalJson()"
                class="w-full px-4 py-2 bg-secondary-container text-on-secondary-container font-medium rounded-lg hover:bg-secondary transition-colors"
              >
                📄 Download Encoded JSON (Backup)
              </button>
              <button
                (click)="close.emit()"
                class="w-full px-4 py-2 bg-primary text-on-primary font-medium rounded-lg hover:bg-primary-container transition-colors"
              >
                Done
              </button>
            </div>
          } @else if (qrError()) {
            <div class="mb-4 p-4 bg-error-container text-on-error-container rounded-lg">
              <p class="font-semibold mb-2">QR Code Generation Failed</p>
              <p class="text-sm">{{ qrError() }}</p>
            </div>
            <button
              (click)="resetToSelect()"
              class="w-full px-4 py-2 bg-surface-container text-on-surface font-medium rounded-lg hover:bg-surface-container-high transition-colors"
            >
              Back
            </button>
          } @else {
            <div class="flex flex-col items-center py-8">
              <div class="animate-spin text-4xl mb-4">⟳</div>
              <p class="text-on-surface-variant">Generating QR code...</p>
            </div>
          }
        }
      </div>
    </div>
  `,
})
export class ExportOptionsModalComponent {
  characterId = input.required<string>();
  close = output<void>();

  private storage = inject(CharacterStorageService);
  private tmpfiles = inject(TmpfilesService);

  mode = signal<ExportMode>('select');
  character = signal<ExportedCharacter | null>(null);
  
  // Share mode
  isUploading = signal<boolean>(false);
  shareUrl = signal<string | null>(null);
  uploadError = signal<string | null>(null);
  
  // QR mode
  qrCodeUrl = signal<string | null>(null);
  qrDataSize = signal<number>(0);
  qrError = signal<string | null>(null);

  characterName = computed(() => this.character()?.character?.name || 'Unknown');
  characterLevel = computed(() => this.character()?.character?.level || 1);
  fileId = computed(() => {
    const url = this.shareUrl();
    if (!url) return null;
    const match = url.match(/\/dl\/(\d+)\//);
    return match ? match[1] : null;
  });

  constructor() {
    // Load character when component initializes
    effect(() => {
      const id = this.characterId();
      const char = this.storage.loadCharacter(id);
      this.character.set(char);
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

  async uploadToTmpfiles() {
    const character = this.character();
    if (!character) return;

    this.mode.set('share');
    this.isUploading.set(true);
    this.shareUrl.set(null);
    this.uploadError.set(null);

    const result = await this.tmpfiles.uploadCharacter(character);
    
    this.isUploading.set(false);
    
    if (result.success && result.url) {
      this.shareUrl.set(result.url);
    } else {
      this.uploadError.set(result.error || 'Unknown error occurred');
    }
  }

  async generateQRCode() {
    const character = this.character();
    if (!character) return;

    this.mode.set('qr');
    this.qrCodeUrl.set(null);
    this.qrError.set(null);

    try {
      const qrDataUrl = await this.storage.generateQRCode(character);
      this.qrCodeUrl.set(qrDataUrl);
      
      // Calculate the size of the minimal export
      const jsonString = this.storage.getMinimalExportJson(character);
      this.qrDataSize.set(jsonString.length);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.qrError.set(message);
    }
  }

  downloadMinimalJson() {
    const character = this.character();
    if (!character?.character?.characterUuid) return;

    const jsonString = this.storage.getMinimalExportJson(character);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${character.character.name}_qr_backup.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  async copyLinkToClipboard() {
    const url = this.shareUrl();
    if (!url) return;

    try {
      await navigator.clipboard.writeText(url);
      alert('✅ Full link copied to clipboard!');
    } catch (error) {
      prompt('Copy the link below:', url);
    }
  }

  async copyIdToClipboard() {
    const id = this.fileId();
    if (!id) return;

    try {
      await navigator.clipboard.writeText(id);
      alert('✅ File ID copied to clipboard!');
    } catch (error) {
      prompt('Copy the file ID below:', id);
    }
  }

  resetToSelect() {
    this.mode.set('select');
    this.shareUrl.set(null);
    this.uploadError.set(null);
    this.qrCodeUrl.set(null);
    this.qrError.set(null);
  }
}
