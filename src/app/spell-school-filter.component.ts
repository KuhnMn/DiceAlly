import { Component, input, model } from '@angular/core';
import { SPELL_SCHOOLS, SpellSchool } from './models/spell-metadata';
import { HorizontalRowDirective } from './sheet/horizontal-row.directive';

/** Shared school choices for the spell catalog, editor, and playing sheet. */
@Component({
  selector: 'app-spell-school-filter',
  imports: [HorizontalRowDirective],
  host: { class: 'mb-2 block min-w-0' },
  template: `
    <div appHorizontalRow role="group" aria-label="Spell school filters" class="flex flex-wrap items-center gap-2">
      <span class="text-sm font-semibold">School:</span>
      <button type="button" [disabled]="disabled()" (click)="selected.set([])" [attr.aria-pressed]="!selected().length"
        [class.bg-purple]="!selected().length" [class.text-on-purple]="!selected().length"
        class="min-h-11 rounded-full border border-outline-variant px-3 py-1 text-sm disabled:opacity-60">All</button>
      @for (school of availableSchools(); track school.value) {
        <button type="button" [disabled]="disabled()" (click)="toggle(school.value)" [attr.aria-pressed]="selected().includes(school.value)"
          [class.bg-purple]="selected().includes(school.value)" [class.text-on-purple]="selected().includes(school.value)"
          class="min-h-11 rounded-full border border-outline-variant px-3 py-1 text-sm disabled:opacity-60">{{ school.label }}</button>
      }
    </div>
  `,
})
export class SpellSchoolFilterComponent {
  readonly selected = model<SpellSchool[]>([]);
  readonly disabled = input(false);
  readonly availableSchools = input<readonly typeof SPELL_SCHOOLS[number][]>(SPELL_SCHOOLS);
  toggle(school: SpellSchool) {
    this.selected.update(selected => selected.includes(school) ? selected.filter(value => value !== school) : [...selected, school]);
  }
}
