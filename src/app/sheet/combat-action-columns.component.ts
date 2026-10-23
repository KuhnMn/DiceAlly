import { Component } from '@angular/core';

/** Match the spacing and column widths of the combat action's statistics row. */
@Component({
  selector: 'app-combat-action-columns',
  host: {
    class: 'grid min-w-0 grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,2fr)] gap-2 px-2.5 py-0.5 text-[10px] font-semibold leading-3 text-on-surface-variant sm:py-1 sm:text-xs sm:leading-4',
    'aria-label': 'Combat action columns',
  },
  template: `<span>Range</span><span class="text-center">Hit/DC</span><span class="text-right">Damage/Heal</span>`,
})
export class CombatActionColumnsComponent {}
