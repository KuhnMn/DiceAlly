import { Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ExportedCharacter } from '../models/character.model';
import { CharacterStorageService } from '../services/character-storage.service';

@Component({
  selector: 'app-qr-code-modal',
  imports: [CommonModule],
  template: `
    <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" (click)="close.emit()">
      <div class="bg-surface-container-highest rounded-lg p-6 max-w-md w-full max-h-[90vh] overflow-y-auto" (click)="$event.stopPropagation()">
        <div class="flex justify-between items-center mb-4">
          <h2 class="text-2xl font-bold text-on-surface">Export QR Code</h2>
          <button
            (click)="close.emit()"
            class="text-on-surface-variant hover:text-on-surface text-2xl leading-none"
          >
            ✕
          </button>
        </div>

        <p class="text-on-surface-variant mb-4">
          Scan this with your Android device to sync character data.
        </p>

        @if (qrCodeUrl()) {
          <div class="flex justify-center mb-4">
            <div class="bg-white p-4 rounded-lg">
              <img [src]="qrCodeUrl()" [alt]="character()?.character?.name" class="w-64 h-64" />
            </div>
          </div>

          <div class="space-y-2 mb-4">
            <p class="text-xs text-on-surface-variant">
              <strong>Character:</strong> {{ character()?.character?.name }}
            </p>
            <p class="text-xs text-on-surface-variant">
              <strong>Level:</strong> {{ character()?.character?.level }}
            </p>
            <p class="text-xs text-on-surface-variant">
              <strong>Size:</strong> {{ jsonSize() }} bytes
            </p>
          </div>

          <button
            (click)="downloadJson()"
            class="w-full px-4 py-2 bg-secondary-container text-on-secondary-container font-medium rounded-lg hover:bg-secondary transition-colors mb-2"
          >
            Download JSON
          </button>
        } @else {
          <div class="flex justify-center mb-4">
            <div class="animate-spin text-4xl">⟳</div>
          </div>
          <p class="text-center text-on-surface-variant">Generating QR code...</p>
        }

        <button
          (click)="close.emit()"
          class="w-full px-4 py-2 bg-surface-container text-on-surface font-medium rounded-lg hover:bg-surface-container-high transition-colors"
        >
          Close
        </button>
      </div>
    </div>
  `,
})
export class QRCodeModalComponent {
  character = input.required<ExportedCharacter | null>();
  close = output<void>();

  private storage = new CharacterStorageService();

  qrCodeUrl = input.required<string | null>();
  jsonSize = input.required<number>();

  downloadJson() {
    const character = this.character();
    if (!character?.character?.characterId) return;

    const jsonString = this.storage.getMinimalExportJson(character);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${character.character.name}_sync.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}
