import { Component, computed, input } from '@angular/core';
import type { Prerequisite } from '../models/character.model';
import { EntryRendererComponent } from '../entries/entry-renderer.component';
import { preparePrerequisites } from './prerequisite-presentation';

/** The same reference information in catalog summaries and saved feature details. */
@Component({
  selector: 'app-prerequisite-details',
  imports: [EntryRendererComponent],
  template: `
    @if (prepared().detailText || prepared().notes.length) {
      @if (compact()) {
        <div class="text-xs leading-relaxed text-on-surface-variant [overflow-wrap:anywhere]">
          <span class="font-semibold">Prerequisites: </span><app-entry-renderer [entry]="{text: prepared().summaryText || 'See notes'}" [inline]="true" />
        </div>
      } @else {
        <section aria-label="Prerequisites" class="rounded-lg bg-surface-container-low p-3">
          <h4 class="mb-1 text-xs font-semibold uppercase text-on-surface-variant">Prerequisites</h4>
          @if (prepared().detailText) { <app-entry-renderer [entry]="{text: prepared().detailText}" /> }
          @for (note of prepared().notes; track note) {
            <div class="mt-2 border-l-2 border-outline-variant pl-2 text-on-surface-variant"><app-entry-renderer [entry]="{text: note}" /></div>
          }
        </section>
      }
    }
  `,
})
export class PrerequisiteDetailsComponent {
  readonly prerequisites = input<readonly Prerequisite[] | null | undefined>();
  readonly compact = input(false);
  readonly prepared = computed(() => preparePrerequisites(this.prerequisites()));
}
