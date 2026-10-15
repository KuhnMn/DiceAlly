import { Component, input } from '@angular/core';
import { FeatureSourceStat } from '../editor/feature-source-stats';

/** The same compact, wrapping stat line in creator and playing-sheet source filters. */
@Component({
  selector: 'app-source-stats',
  template: `
    @for (stat of stats(); track stat.ability) {
      <div class="stat-line">
        <span class="ability" [attr.aria-label]="stat.ability + ' modifier ' + stat.modifier">{{ stat.ability }} {{ stat.modifier }}</span>
        <span class="stat" [attr.aria-label]="'Attack bonus ' + stat.attack">Atk <strong class="text-tertiary">{{ stat.attack }}</strong></span>
        <span class="stat" [attr.aria-label]="'Save DC ' + (stat.save ?? 'unavailable')">DC <strong class="text-primary">{{ stat.save ?? '—' }}</strong></span>
      </div>
    }
  `,
  styles: [`
    :host { display: block; min-width: 0; margin-top: .25rem; }
    .stat-line { display: flex; flex-wrap: wrap; justify-content: center; align-items: baseline; column-gap: .5rem; row-gap: .125rem; font-size: .75rem; line-height: 1.4; }
    .ability { font-weight: 600; }
    .ability, .stat { white-space: nowrap; }
  `],
})
export class SourceStatsComponent {
  readonly stats = input.required<FeatureSourceStat[]>();
}
