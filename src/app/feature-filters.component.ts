import { Component, input, model } from '@angular/core';
import { HorizontalRowDirective } from './sheet/horizontal-row.directive';
import { FeatureType, featureCategoryLabel } from './editor/feature-selection';

@Component({
  selector: 'app-feature-filters',
  imports: [HorizontalRowDirective],
  host: { class: 'mt-2 block min-w-0 space-y-2' },
  template: `
    @if (kind() === 'CLASS_FEATURE') {
    @if (showClasses()) {
    <div appHorizontalRow role="group" aria-label="Feature class filters" class="flex flex-wrap items-center gap-2">
      <span class="text-sm font-semibold">Class:</span>
      <button type="button" (click)="selectedClasses.set([])" [attr.aria-pressed]="!selectedClasses().length" [class.bg-blue-container]="!selectedClasses().length" class="min-h-11 rounded-full border border-outline-variant px-3 py-1 text-sm">All</button>
      @for (name of classes(); track name) {
        <button type="button" (click)="toggleClass(name)" [attr.aria-pressed]="selectedClasses().includes(name)" [class.bg-blue-container]="selectedClasses().includes(name)" class="min-h-11 rounded-full border border-outline-variant px-3 py-1 text-sm">{{ name }}</button>
      }
    </div>
    }
    <div appHorizontalRow role="group" aria-label="Feature level filters" class="flex flex-wrap items-center gap-2">
      <span class="text-sm font-semibold">Level:</span>
      <button type="button" (click)="selectedLevels.set([])" [attr.aria-pressed]="!selectedLevels().length" [class.bg-blue-container]="!selectedLevels().length" class="min-h-11 rounded-full border border-outline-variant px-3 py-1 text-sm">All</button>
      @for (level of levels(); track level) {
        <button type="button" (click)="toggleLevel(level)" [attr.aria-pressed]="selectedLevels().includes(level)" [class.bg-blue-container]="selectedLevels().includes(level)" class="min-h-11 rounded-full border border-outline-variant px-3 py-1 text-sm">{{ level }}</button>
      }
    </div>
    } @else {
      <div appHorizontalRow role="group" aria-label="Feature category filters" class="flex flex-wrap items-center gap-2">
        <span class="text-sm font-semibold">Type:</span>
        <button type="button" (click)="selectedCategories.set([])" [attr.aria-pressed]="!selectedCategories().length" [class.bg-blue-container]="!selectedCategories().length" class="min-h-11 rounded-full border border-outline-variant px-3 py-1 text-sm">All</button>
        @for (category of categories(); track category) {
          <button type="button" (click)="toggleCategory(category)" [attr.aria-pressed]="selectedCategories().includes(category)" [class.bg-blue-container]="selectedCategories().includes(category)" class="min-h-11 rounded-full border border-outline-variant px-3 py-1 text-sm">{{ categoryLabel(category) }}</button>
        }
      </div>
    }
  `,
})
export class FeatureFiltersComponent {
  readonly kind = input<FeatureType>('CLASS_FEATURE');
  readonly showClasses = input(true);
  readonly categories = input<string[]>([]);
  readonly selectedCategories = model<string[]>([]);
  readonly categoryLabel = featureCategoryLabel;
  readonly classes = input<string[]>([]);
  readonly levels = input<number[]>([]);
  readonly selectedClasses = model<string[]>([]);
  readonly selectedLevels = model<number[]>([]);
  toggleClass(name: string) { this.selectedClasses.update(values => values.includes(name) ? values.filter(value => value !== name) : [...values, name]); }
  toggleLevel(level: number) { this.selectedLevels.update(values => values.includes(level) ? values.filter(value => value !== level) : [...values, level]); }
  toggleCategory(category: string) { this.selectedCategories.update(values => values.includes(category) ? values.filter(value => value !== category) : [...values, category]); }
}
