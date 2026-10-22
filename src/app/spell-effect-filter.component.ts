import { Component, input, model } from '@angular/core';
import { SPELL_EFFECT_FILTER_GROUPS, SpellEffectFilter } from './content/spell-effects';
import { HorizontalRowDirective } from './sheet/horizontal-row.directive';

@Component({
  selector: 'app-spell-effect-filter',
  imports: [HorizontalRowDirective],
  host: { class: 'mb-2 block min-w-0' },
  template: `
    <div class="space-y-1" aria-label="Spell effect filters">
      @for (group of groups; track group.key) {
        <details class="rounded-lg border border-outline-variant px-3 py-1">
          <summary class="min-h-8 cursor-pointer content-center text-sm font-semibold">{{ group.label }}@if (selected()[group.key]?.length) { <span class="ml-2 rounded bg-purple-container px-1.5 text-xs text-on-purple-container">{{ selected()[group.key]!.length }}</span> }</summary>
          <div appHorizontalRow role="group" [attr.aria-label]="group.label + ' filters'" class="flex flex-wrap gap-2 py-2">
            <button type="button" [disabled]="disabled()" (click)="clear(group.key)" [attr.aria-pressed]="!selected()[group.key]?.length" [class.bg-purple]="!selected()[group.key]?.length" [class.text-on-purple]="!selected()[group.key]?.length" class="min-h-11 rounded-full border border-outline-variant px-3 py-1 text-sm disabled:opacity-60">All</button>
            @for (option of group.options; track option.value) {
              <button type="button" [disabled]="disabled()" (click)="toggle(group.key, option.value)" [attr.aria-pressed]="selected()[group.key]?.includes(option.value) ?? false" [class.bg-purple]="selected()[group.key]?.includes(option.value)" [class.text-on-purple]="selected()[group.key]?.includes(option.value)" class="min-h-11 rounded-full border border-outline-variant px-3 py-1 text-sm disabled:opacity-60">{{ option.label }}</button>
            }
          </div>
        </details>
      }
    </div>
  `,
})
export class SpellEffectFilterComponent {
  readonly selected = model<SpellEffectFilter>({});
  readonly disabled = input(false);
  readonly groups = SPELL_EFFECT_FILTER_GROUPS;
  clear(key: keyof SpellEffectFilter) { this.selected.update(filter => ({ ...filter, [key]: [] })); }
  toggle(key: keyof SpellEffectFilter, value: string) {
    this.selected.update(filter => { const values = filter[key] ?? []; return { ...filter, [key]: values.includes(value) ? values.filter(entry => entry !== value) : [...values, value] }; });
  }
}
