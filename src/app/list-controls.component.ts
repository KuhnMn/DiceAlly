import { Component, computed, input, model, output, signal } from '@angular/core';
import { UiIconComponent } from './ui-icon.component';

/** Compact list search with optional, mounted filters so closing keeps their state. */
@Component({
  selector: 'app-list-controls',
  imports: [UiIconComponent],
  host: { class: 'mb-3 block min-w-0' },
  template: `
    <div class="flex min-w-0 items-center gap-2">
      <label class="relative min-w-0 flex-1">
        <span class="sr-only">{{ label() }}</span>
        <app-ui-icon name="search" class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant" />
        <input type="search" [disabled]="disabled()" [attr.name]="searchName() || null" [value]="query()" (input)="query.set($any($event.target).value)"
          [placeholder]="label()" class="min-h-11 w-full min-w-0 rounded-lg border border-outline-variant bg-surface-container py-2 pl-9 pr-2 text-base text-on-surface sm:text-sm" />
      </label>
      <ng-content select="[list-toolbar-action]" />
      @if (hasFilters()) {
        <button type="button" [disabled]="disabled()" [attr.aria-expanded]="filtersOpen()" [attr.aria-controls]="filtersId()" (click)="filtersOpen.set(!filtersOpen())"
          [class.bg-primary-container]="filtersOpen() || filterCount() > 0" [class.text-on-primary-container]="filtersOpen() || filterCount() > 0"
          class="inline-flex min-h-11 shrink-0 items-center gap-1 rounded-lg border border-outline-variant px-2 text-sm focus-visible:outline-2 focus-visible:outline-primary">
          <app-ui-icon name="filter" /> <span>Filters</span>
          @if (filterCount()) { <span class="font-bold tabular-nums">({{ filterCount() }})</span> }
        </button>
      }
      @if (query() || filterCount()) {
        <button type="button" [disabled]="disabled()" aria-label="Clear filters and search" title="Clear filters and search" (click)="query.set(''); cleared.emit()"
          class="flex h-11 w-8 shrink-0 items-center justify-center rounded-lg text-on-surface-variant hover:bg-surface-container-high focus-visible:outline-2 focus-visible:outline-primary"><app-ui-icon name="close" /></button>
      }
    </div>
    <div [id]="filtersId()" [hidden]="!filtersOpen() || !hasFilters()" class="mt-2 min-w-0 rounded-lg border border-outline-variant bg-surface-container-low p-2">
      <ng-content />
    </div>
  `,
})
export class ListControlsComponent {
  readonly label = input.required<string>();
  readonly searchName = input('');
  readonly query = model('');
  readonly hasFilters = input(true);
  readonly filterCount = input(0);
  readonly disabled = input(false);
  readonly filtersId = computed(() => (this.searchName() || this.label().toLowerCase().replaceAll(' ', '-')) + '-filters');
  readonly filtersOpen = signal(false);
  readonly cleared = output<void>();
}
