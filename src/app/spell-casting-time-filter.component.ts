import { Component, model } from '@angular/core';
import { SPELL_CASTING_TIMES, SpellCastingTime } from './editor/spell-selection';
import { HorizontalRowDirective } from './sheet/horizontal-row.directive';

@Component({
  selector: 'app-spell-casting-time-filter',
  imports: [HorizontalRowDirective],
  host: { class: 'mb-2 block min-w-0' },
  template: `
    <div appHorizontalRow role="group" aria-label="Casting time filters" class="flex flex-wrap items-center gap-2">
      <span class="text-sm font-semibold">Casting Time:</span>
      <button type="button" (click)="selected.set([])" [attr.aria-pressed]="!selected().length"
        [class.bg-purple]="!selected().length" [class.text-on-purple]="!selected().length"
        class="min-h-11 rounded-full border border-outline-variant px-3 py-1 text-sm">All</button>
      @for (time of times; track time.value) {
        <button type="button" (click)="toggle(time.value)" [attr.aria-pressed]="selected().includes(time.value)"
          [class.bg-purple]="selected().includes(time.value)" [class.text-on-purple]="selected().includes(time.value)"
          class="min-h-11 rounded-full border border-outline-variant px-3 py-1 text-sm">{{ time.label }}</button>
      }
    </div>
  `,
})
export class SpellCastingTimeFilterComponent {
  readonly selected = model<SpellCastingTime[]>([]);
  readonly times = SPELL_CASTING_TIMES;
  toggle(time: SpellCastingTime) {
    this.selected.update(selected => selected.includes(time) ? selected.filter(value => value !== time) : [...selected, time]);
  }
}
