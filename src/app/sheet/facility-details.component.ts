import { Component, input } from '@angular/core';
import type { FacilityEntry } from '../models/bastion';
import { EntryRendererComponent } from '../entries/entry-renderer.component';
import { PrerequisiteDetailsComponent } from './prerequisite-details.component';
import { facilityTypeLabel } from '../models/bastion';

@Component({
  selector: 'app-facility-details',
  imports: [EntryRendererComponent, PrerequisiteDetailsComponent],
  host: { class: 'block min-w-0' },
  template: `
    <div class="mb-3 flex flex-wrap gap-1 text-xs text-on-surface-variant">
      <span>{{ typeLabel(facility().entity) }}</span>
      @if (facility().entity.level != null) { <span>· Level {{ facility().entity.level }}</span> }
      @if (facility().source) { <span>· {{ facility().source }}</span> }
    </div>
    <app-prerequisite-details [prerequisites]="facility().entity.prerequisite" />
    <app-entry-renderer [entries]="facility().entity.entries" />
  `,
})
export class FacilityDetailsComponent {
  readonly facility = input.required<FacilityEntry>();
  readonly typeLabel = facilityTypeLabel;
}
