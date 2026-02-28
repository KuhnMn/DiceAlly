/* import { Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-share-modal',
  imports: [CommonModule],
  template: `
    <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" (click)="close.emit()">
      <div class="bg-surface-container-highest rounded-lg p-6 max-w-md w-full max-h-[90vh] overflow-y-auto" (click)="$event.stopPropagation()">
        <div class="flex justify-between items-center mb-4">
          <h2 class="text-2xl font-bold text-on-surface">Share Character</h2>
          <button
            (click)="close.emit()"
            class="text-on-surface-variant hover:text-on-surface text-2xl leading-none"
          >
            ✕
          </button>
        </div>

        <p class="text-on-surface-variant mb-4">
          Your character has been uploaded to tmpfiles.org. Share the link below:
        </p>

        <div class="mb-4 p-4 bg-surface-container rounded-lg border-2 border-outline-variant">
          <p class="text-xs text-on-surface-variant font-semibold mb-2">Share Link</p>
          <p class="text-sm font-mono text-primary break-all">{{ shareUrl() }}</p>
        </div>

        <div class="space-y-2 mb-4">
          <p class="text-xs text-on-surface-variant">
            <span class="font-semibold">Note:</span> Files expire after 60 minutes.
          </p>
        </div>

        <div class="flex flex-col gap-2">
          <button
            (click)="copyToClipboard()"
            class="flex-1 px-4 py-2 bg-primary text-on-primary font-medium rounded-lg hover:bg-primary-container transition-colors"
          >
            📋 Copy Link
          </button>
<!--           <button
            (click)="copyJsonToClipboard()"
            class="flex-1 px-4 py-2 bg-secondary-container text-on-secondary-container font-medium rounded-lg hover:bg-secondary transition-colors"
          >
            📄 Copy JSON (Backup)
          </button> -->
          <button
            (click)="close.emit()"
            class="flex-1 px-4 py-2 bg-surface-container text-on-surface font-medium rounded-lg hover:bg-surface-container-high transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  `,
})
export class ShareModalComponent {
  shareUrl = input.required<string>();
  character = input<any>(null);
  close = output<void>();

  async copyToClipboard() {
    const url = this.shareUrl();
    try {
      await navigator.clipboard.writeText(url);
      alert('✅ Share link copied to clipboard!');
    } catch (error) {
      const fallbackUrl = prompt('Copy the link below:', url);
    }
  }

  async copyJsonToClipboard() {
    const char = this.character();
    if (!char) {
      alert('Character data not available');
      return;
    }

    try {
      const json = JSON.stringify(char);
      await navigator.clipboard.writeText(json);
      alert('✅ JSON copied to clipboard! Paste it in the "Or Paste JSON" section to import.');
    } catch (error) {
      alert('Failed to copy JSON to clipboard. Try the share link instead.');
    }
  }
}
 */