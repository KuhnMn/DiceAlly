import { Component, computed, input } from '@angular/core';
import { ItemVehicleDefinition } from '../content/item.model';
import { vehicleItemStatistics } from './vehicle-item-presentation';

@Component({
  selector: 'app-vehicle-item-details',
  host: { class: 'block' },
  template: `
    @if (statistics().length) {
      <section aria-label="Vehicle statistics" class="rounded-lg border border-outline-variant bg-surface-container p-3">
        <h4 class="mb-2 text-sm font-semibold">Vehicle Statistics</h4>
        <dl class="grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-3">
          @for (stat of statistics(); track stat.label) {
            <div class="min-w-0"><dt class="text-xs text-on-surface-variant">{{ stat.label }}</dt><dd class="font-semibold [overflow-wrap:anywhere]">{{ stat.value }}</dd></div>
          }
        </dl>
      </section>
    }
  `,
})
export class VehicleItemDetailsComponent {
  readonly item = input<ItemVehicleDefinition | null>();
  readonly showCost = input(false);
  readonly statistics = computed(() => vehicleItemStatistics(this.item(), this.showCost()));
}
