import { Component, computed, input } from '@angular/core';
import { SpellCastingStats, SpellEffectFields, spellEffectSummary } from '../content/spell-effects';

/** One wrapping reference strip, rather than additional stat cards or repeated casting metadata. */
@Component({
  selector: 'app-spell-effect-summary',
  host: { '[style.display]': "rows().length ? null : 'none'" },
  template: `
    @if (rows().length) {
      <dl class="flex flex-wrap gap-x-4 gap-y-1 text-xs" aria-label="Spell effects">
        @for (row of rows(); track row.label) { <div class="min-w-0"><dt class="inline font-semibold text-on-surface-variant">{{ row.label }}: </dt><dd class="inline">{{ row.text }}</dd></div> }
      </dl>
    }
  `,
})
export class SpellEffectSummaryComponent {
  readonly spell = input<SpellEffectFields | null | undefined>();
  readonly castingStats = input<SpellCastingStats>();
  readonly rows = computed(() => spellEffectSummary(this.spell(), this.castingStats()));
}
