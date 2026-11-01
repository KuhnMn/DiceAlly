import { Component, input, output } from '@angular/core';
import { ContentRecord } from '../content/content.model';
import { kindLabel } from './compendium-catalog';
import { UiIconComponent } from '../ui-icon.component';

@Component({
  selector: 'app-related-entries-list',
  imports: [UiIconComponent],
  template: `
    @if (entries().length) {
      <details [open]="initiallyExpanded()" class="group mt-5 border-t border-outline-variant pt-3">
        <summary class="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 rounded font-semibold focus-visible:outline-2 focus-visible:outline-primary">
          <h3>Related Entries</h3><app-ui-icon name="chevron" class="transition-transform group-open:rotate-90" />
        </summary>
        <div class="mt-2 grid gap-1">
          @for (entry of entries(); track entry.key) {
            <button type="button" (click)="opened.emit(entry)" class="min-h-11 rounded-lg bg-surface-container px-3 py-2 text-left text-sm text-primary hover:bg-surface-container-high">
              {{ entry.name }} <span class="text-xs text-on-surface-variant">· {{ kindLabel(entry.kind) }} · {{ entry.publication }}</span>
            </button>
          }
        </div>
      </details>
    }
  `,
})
export class RelatedEntriesListComponent {
  readonly entries = input<ContentRecord[]>([]);
  readonly initiallyExpanded = input(true);
  readonly opened = output<ContentRecord>();
  readonly kindLabel = kindLabel;
}
