import { Component, computed, inject, input } from '@angular/core';
import { SpellEntity } from '../models/character.model';
import { CharacterHelpersService } from './character-helpers.service';
import { EntryRendererComponent } from '../entries/entry-renderer.component';
import { prepareSpellDetails, spellDurationText } from './spell-presentation';
import { SpellEffectSummaryComponent } from './spell-effect-summary.component';
import type { SpellCastingStats } from '../content/spell-effects';

/** Reference information wraps freely in the detail dialog, including material components. */
@Component({
  selector: 'app-spell-details',
  imports: [EntryRendererComponent, SpellEffectSummaryComponent],
  host: { class: 'block min-w-0' },
  styles: [`
    :host { container-type: inline-size; }
    .spell-metadata { grid-template-columns: minmax(0, 1fr); }
    .spell-metadata > div { min-width: 0; overflow-wrap: anywhere; }
    @container (min-width: 18rem) {
      .spell-metadata { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    }
  `],
  template: `
    @if (details(); as value) {
      <dl class="spell-metadata grid gap-3 rounded-lg bg-surface-container p-3 text-sm">
        @if (value.castingTimes.length) {
          <div><dt class="font-semibold text-on-surface-variant">Casting Time</dt><dd class="space-y-1">
            @for (time of value.castingTimes; track $index) {
              @if (!$first) { <p class="text-xs text-on-surface-variant">or</p> }
              <div>
                <p>{{ time.durationText }}</p>
                @if (time.conditionText) { <app-entry-renderer [entry]="{text: time.conditionText}" [compact]="true" /> }
                @if (time.noteText) { <app-entry-renderer [entry]="{text: time.noteText}" [compact]="true" /> }
              </div>
            }
          </dd></div>
        }
        @if (spell()?.range; as range) { <div><dt class="font-semibold text-on-surface-variant">Range</dt><dd>{{ helpers.spellRangeLabel(range) }}</dd></div> }
        @if (value.components; as components) {
          <div><dt class="font-semibold text-on-surface-variant">Components</dt><dd><app-entry-renderer [entry]="{text: components.summaryText}" [compact]="true" /></dd></div>
        }
        @if (value.durations.length) {
          <div><dt class="font-semibold text-on-surface-variant">Duration</dt><dd class="space-y-1">
            @for (duration of value.durations; track $index) {
              @if (!$first) { <p class="text-xs text-on-surface-variant">or</p> }
              <app-entry-renderer [entry]="{text: durationText(duration)}" [compact]="true" />
            }
          </dd></div>
        }
      </dl>
      <app-spell-effect-summary class="mt-2 block" [spell]="spell()" [castingStats]="castingStats()" />
    }
  `,
})
export class SpellDetailsComponent {
  readonly spell = input<Partial<SpellEntity> | null | undefined>();
  readonly castingStats = input<SpellCastingStats>();
  readonly details = computed(() => {
    const spell = this.spell();
    return spell ? prepareSpellDetails(spell) : null;
  });
  readonly durationText = spellDurationText;
  readonly helpers = inject(CharacterHelpersService);
}
