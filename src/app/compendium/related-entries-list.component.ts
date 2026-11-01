import { Component, input, output } from '@angular/core';
import { ContentRecord } from '../content/content.model';
import { kindLabel } from './compendium-catalog';

@Component({
  selector: 'app-related-entries-list',
  template: `
    @if (entries().length) {
      <section class="mt-5 border-t border-outline-variant pt-3"><h3 class="mb-2 font-semibold">Related Entries</h3>
        <div class="grid gap-1">
          @for (entry of entries(); track entry.key) {
            <button type="button" (click)="opened.emit(entry)" class="min-h-11 rounded-lg bg-surface-container px-3 py-2 text-left text-sm text-primary hover:bg-surface-container-high">
              {{ entry.name }} <span class="text-xs text-on-surface-variant">· {{ kindLabel(entry.kind) }} · {{ entry.publication }}</span>
            </button>
          }
        </div>
      </section>
    }
  `,
})
export class RelatedEntriesListComponent {
  readonly entries = input<ContentRecord[]>([]);
  readonly opened = output<ContentRecord>();
  readonly kindLabel = kindLabel;
}
