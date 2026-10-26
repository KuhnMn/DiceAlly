import { Component, computed, input } from '@angular/core';
import { BastionDefinition } from '../content/bastion.model';
import { facilityHirelingOptions, facilityOrderLabel, facilitySpaceLabel } from '../models/bastion';

@Component({
  selector: 'app-facility-information',
  host: { class: 'mb-3 block min-w-0' },
  template: `
    <dl class="grid grid-cols-1 gap-3 rounded-lg bg-surface-container-low p-3 text-sm sm:grid-cols-3" aria-label="Facility information">
      <div class="min-w-0"><dt class="text-xs font-semibold text-on-surface-variant">Orders</dt><dd class="mt-1 flex flex-wrap gap-1">
        @for (order of definition().orders ?? []; track order) { <span class="rounded bg-secondary-container px-1.5 py-0.5 text-xs text-on-secondary-container">{{ orderLabel(order) }}</span> }
        @if (!definition().orders?.length) { <span class="text-on-surface-variant">Not Listed</span> }
      </dd></div>
      <div class="min-w-0"><dt class="text-xs font-semibold text-on-surface-variant">Space</dt><dd class="mt-1 font-medium">
        @for (space of definition().space ?? []; track space) { @if (!$first) { <span class="text-xs font-normal text-on-surface-variant"> or </span> }{{ spaceLabel(space) }} }
        @if (!definition().space?.length) { <span class="font-normal text-on-surface-variant">Not Listed</span> }
      </dd></div>
      <div class="min-w-0"><dt class="text-xs font-semibold text-on-surface-variant">Hirelings</dt><dd class="mt-1 space-y-1">
        @for (option of hirelings(); track $index) {
          @if (!$first) { <p class="text-xs text-on-surface-variant">Or</p> }
          <p class="font-medium">{{ option.value }}</p>
          @if (option.note) { <p class="border-l-2 border-outline-variant pl-2 text-xs text-on-surface-variant">{{ option.note }}</p> }
        }
        @if (!hirelings().length) { <span class="text-on-surface-variant">Not Listed</span> }
      </dd></div>
    </dl>
  `,
})
export class FacilityInformationComponent {
  readonly definition = input.required<BastionDefinition>();
  readonly hirelings = computed(() => facilityHirelingOptions(this.definition()));
  readonly orderLabel = facilityOrderLabel;
  readonly spaceLabel = facilitySpaceLabel;
}
