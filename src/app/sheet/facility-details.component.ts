import { Component, input } from '@angular/core';
import type { FacilityEntry } from '../models/bastion';
import { EntryRendererComponent } from '../entries/entry-renderer.component';
import { PrerequisiteDetailsComponent } from './prerequisite-details.component';
import { facilityTypeLabel } from '../models/bastion';
import { FacilityInformationComponent } from './facility-information.component';

@Component({
  selector: 'app-facility-details',
  imports: [EntryRendererComponent, PrerequisiteDetailsComponent, FacilityInformationComponent],
  host: { class: 'block min-w-0' },
  template: `
    @if (showMetadata()) {
    <div class="mb-3 flex flex-wrap gap-1 text-xs text-on-surface-variant">
      <span>{{ typeLabel(facility().entity) }}</span>
      @if (facility().entity.level != null) { <span>· Level {{ facility().entity.level }}</span> }
      @if (facility().source) { <span>· {{ facility().source }}</span> }
    </div>
    }
    <app-prerequisite-details [prerequisites]="facility().entity.prerequisite" />
    <app-facility-information [definition]="facility().entity" />
    <app-entry-renderer [entries]="facility().entity.entries" />
  `,
})
export class FacilityDetailsComponent {
  readonly facility = input.required<FacilityEntry>();
  readonly showMetadata = input(true);
  readonly typeLabel = facilityTypeLabel;
}
