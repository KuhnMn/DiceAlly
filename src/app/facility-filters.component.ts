import { Component, input, output } from '@angular/core';
import { FACILITY_ORDERS, FacilityFilters } from './models/bastion';

/** Same compact filter controls in the saved list, creator catalog and viewer. */
@Component({
  selector: 'app-facility-filters',
  host: { class: 'block min-w-0' },
  template: `
    <div class="grid grid-cols-2 gap-2 sm:grid-cols-3">
      <label class="min-w-0 text-xs font-semibold text-on-surface-variant">Type
        <select aria-label="Facility type" [value]="value().type" (change)="change('type', $any($event.target).value)" class="mt-1 min-h-11 w-full rounded-lg border border-outline-variant bg-surface-container px-2 text-base text-on-surface sm:text-sm"><option value="ALL">All Types</option><option value="basic">Basic</option><option value="special">Special</option></select>
      </label>
      <label class="min-w-0 text-xs font-semibold text-on-surface-variant">Level
        <select aria-label="Facility level" [value]="value().level" (change)="change('level', $any($event.target).value)" class="mt-1 min-h-11 w-full rounded-lg border border-outline-variant bg-surface-container px-2 text-base text-on-surface sm:text-sm"><option value="">All Levels</option>@for (level of levels(); track level) { <option [value]="level">Level {{ level }}</option> }</select>
      </label>
      <label class="min-w-0 text-xs font-semibold text-on-surface-variant">Order
        <select aria-label="Facility order" [value]="value().order" (change)="change('order', $any($event.target).value)" class="mt-1 min-h-11 w-full rounded-lg border border-outline-variant bg-surface-container px-2 text-base text-on-surface sm:text-sm"><option value="">All Orders</option>@for (order of orders; track order.value) { <option [value]="order.value">{{ order.label }}</option> }</select>
      </label>
    </div>
  `,
})
export class FacilityFiltersComponent {
  readonly value = input.required<FacilityFilters>();
  readonly levels = input<readonly number[]>([]);
  readonly changed = output<FacilityFilters>();
  readonly orders = FACILITY_ORDERS;
  change(key: keyof FacilityFilters, value: string) { this.changed.emit({ ...this.value(), [key]: value }); }
}
