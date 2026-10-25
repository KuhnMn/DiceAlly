import { Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { FacilityEntry } from '../models/bastion';
import { EntryRendererComponent } from '../entries/entry-renderer.component';
import { PrerequisiteDetailsComponent } from './prerequisite-details.component';
import { facilityTypeLabel } from '../models/bastion';
import { facilityReferences } from '../content/facility-references';

@Component({
  selector: 'app-facility-details',
  imports: [RouterLink, EntryRendererComponent, PrerequisiteDetailsComponent],
  host: { class: 'block min-w-0' },
  template: `
    <div class="mb-3 flex flex-wrap gap-1 text-xs text-on-surface-variant">
      <span>{{ typeLabel(facility().entity) }}</span>
      @if (facility().entity.level != null) { <span>· Level {{ facility().entity.level }}</span> }
      @if (facility().source) { <span>· {{ facility().source }}</span> }
    </div>
    <app-prerequisite-details [prerequisites]="facility().entity.prerequisite" />
    <app-entry-renderer [entries]="facility().entity.entries" />
    @if (references().length) {
      <nav aria-label="Facility references" class="mt-4 border-t border-outline-variant pt-3">
        <h3 class="mb-1 text-sm font-semibold">References</h3>
        <div class="flex flex-wrap gap-2">
          @for (reference of references(); track $index) {
            <a [routerLink]="['/compendium', reference.category]" [queryParams]="{q: reference.name, source: reference.source}" target="_blank" rel="noopener noreferrer"
              class="inline-flex min-h-11 max-w-full items-center rounded-lg border border-outline-variant px-3 py-2 text-sm text-primary [overflow-wrap:anywhere]"
              [attr.aria-label]="reference.name + ' in Compendium (opens in a new tab)'">{{ reference.name }} · {{ reference.source }}</a>
          }
        </div>
      </nav>
    }
  `,
})
export class FacilityDetailsComponent {
  readonly facility = input.required<FacilityEntry>();
  readonly typeLabel = facilityTypeLabel;
  readonly references = computed(() => facilityReferences(this.facility().entity));
}
