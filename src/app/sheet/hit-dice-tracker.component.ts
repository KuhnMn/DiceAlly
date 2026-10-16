import { Component, inject, input } from '@angular/core';
import { CharacterData, HitDieEntry } from '../models/character.model';
import { CharacterHelpersService } from './character-helpers.service';
import { UiIconComponent } from '../ui-icon.component';

@Component({
  selector: 'app-hit-dice-tracker',
  imports: [UiIconComponent],
  template: `
    <section class="my-4 space-y-2 border-t border-outline-variant pt-4" aria-label="Hit dice">
      <h3 class="font-semibold">Hit Dice</h3>
      <p class="text-xs text-on-surface-variant">Spend a die, then heal using your roll. Spending a die does not change HP automatically.</p>
      @for (die of dice(); track $index) {
        <div class="flex items-center justify-between gap-2 rounded-lg bg-surface-container p-3">
          <div><strong class="uppercase">{{ die.dieType }}</strong><p class="text-xs">Heal: 1{{ die.dieType }} {{ helpers.modifier(character().abilityScores?.constitution) || '+0' }}</p></div>
          <div class="flex items-center gap-1">
            <button type="button" (click)="adjust(die, -1)" [disabled]="remaining(die) === 0" [attr.aria-label]="'Spend one ' + die.dieType + ' hit die'" class="flex min-h-11 min-w-11 items-center justify-center rounded-lg bg-primary-container text-on-primary-container disabled:opacity-40"><app-ui-icon name="down" /></button>
            <output class="min-w-12 text-center tabular-nums" aria-live="polite">{{ remaining(die) }}/{{ die.total }}</output>
            <button type="button" (click)="adjust(die, 1)" [disabled]="remaining(die) === die.total" [attr.aria-label]="'Restore one ' + die.dieType + ' hit die'" class="flex min-h-11 min-w-11 items-center justify-center rounded-lg bg-primary-container text-on-primary-container disabled:opacity-40"><app-ui-icon name="up" /></button>
          </div>
        </div>
      } @empty { <p class="text-sm text-on-surface-variant">{{ legacyDescription() }}</p> }
    </section>
  `,
})
export class HitDiceTrackerComponent {
  readonly character = input.required<CharacterData>();
  readonly helpers = inject(CharacterHelpersService);
  dice(): HitDieEntry[] { const value = this.character().hitDice; return Array.isArray(value) ? value : []; }
  legacyDescription() { const value = this.character().hitDice; return typeof value === 'string' && value.trim() ? value : 'No hit dice configured.'; }
  remaining(die: HitDieEntry) { return Math.max(0, Math.min(die.total, die.total - (die.used ?? 0))); }
  adjust(die: HitDieEntry, change: number) { die.used = die.total - Math.max(0, Math.min(die.total, this.remaining(die) + change)); }
}
