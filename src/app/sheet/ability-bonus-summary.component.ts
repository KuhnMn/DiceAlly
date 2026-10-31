import { UiIconComponent } from '../ui-icon.component';
import { FeatureNotesComponent } from './feature-notes.component';
import { Component, input } from '@angular/core';
import { ExportedCharacter } from '../models/character.model';
import { BONUS_ABILITIES, calculateAbilityBonuses, abilityBonusSources, resolveAbilityBonus } from '../models/ability-score-bonuses';

@Component({
  selector: 'app-ability-bonus-summary',
  imports: [FeatureNotesComponent, UiIconComponent],
  host: { class: 'block min-w-0', '[style.display]': 'visible ? (indicator() ? "inline-flex" : null) : "none"' },
  template: `
    @if (visible) {
      @if (indicator()) {
        <span role="img" [attr.aria-label]="'Stat bonuses: ' + indicatorDescription" [title]="'Stat bonuses: ' + indicatorDescription" class="inline-flex items-center text-primary"><app-ui-icon name="plus" /></span>
      } @else if (sourceId()) {
        @if (source; as value) {
          @if (value.options.length || value.error) {
            @if (card()) {
              <app-feature-notes [notes]="[{ tag: 'Ability Bonuses', notes: sourceSummary.split(' · '), isEditable: false }]" />
            } @else {
              <p class="text-xs text-primary [overflow-wrap:anywhere]">{{ sourceSummary }}</p>
            }
          }
        }
      } @else {
        <details class="text-xs" aria-label="Applied ability bonuses">
          <summary class="min-h-8 cursor-pointer py-1 text-primary">Ability bonuses <span class="text-on-surface-variant">· {{ result.sources.length }} sources</span></summary>
          <dl class="grid grid-cols-2 gap-x-3 gap-y-1 py-2 sm:grid-cols-3">
            @for (ability of abilities; track ability.key) {
              <div><dt class="inline font-semibold">{{ ability.key.toUpperCase() }}: </dt><dd class="inline">{{ result.base[ability.field] ?? '—' }} → {{ result.effective[ability.field] ?? '—' }}</dd></div>
            }
          </dl>
          <ul class="space-y-1">
            @for (row of rows; track row.id) { <li class="[overflow-wrap:anywhere]"><span class="font-semibold">{{ row.name }}:</span> {{ row.text }}</li> }
          </ul>
        </details>
      }
    }
  `,
})
export class AbilityBonusSummaryComponent {
  readonly sheet = input<ExportedCharacter | null | undefined>();
  readonly sourceId = input('');
  readonly card = input(false);
  readonly indicator = input(false);
  readonly abilities = BONUS_ABILITIES;
  get visible() { return !!this.sheet()?.abilityBonuses?.enabled && (!this.sourceId() || !!(this.indicator() ? this.indicatorDescription : this.sourceSummary)); }
  get result() { return calculateAbilityBonuses(this.sheet() ?? {}); }
  get source() { return abilityBonusSources(this.sheet() ?? {}).find(source => source.id === this.sourceId()); }
  get sourceSummary() {
    if (!this.source) return '';
    const resolved = resolveAbilityBonus(this.source, this.sheet()?.abilityBonuses?.choices[this.sourceId()]);
    if (!resolved.ready || resolved.status === 'Not applied') return '';
    const contributions = this.result.contributions.filter(entry => entry.sourceId === this.sourceId());
    return contributions.map(entry => `${entry.applied >= 0 ? '+' : ''}${entry.applied} ${entry.ability.toUpperCase()}${entry.applied !== entry.requested ? ' (capped)' : ''}`).join(' · ') || 'No increase';
  }
  get indicatorDescription() {
    const source = this.source;
    if (!source?.options.length) return '';
    const resolved = resolveAbilityBonus(source, this.sheet()?.abilityBonuses?.choices[this.sourceId()]);
    return resolved.status === 'Not applied' ? '' : this.sourceSummary || resolved.status;
  }
  get rows() {
    const result = this.result;
    return result.sources.map(source => ({ id: source.source.id, name: source.source.name,
      text: !source.ready || source.status === 'Not applied' ? source.status : result.contributions.filter(entry => entry.sourceId === source.source.id)
        .map(entry => `${entry.applied >= 0 ? '+' : ''}${entry.applied} ${entry.ability.toUpperCase()}${entry.applied !== entry.requested ? ' (capped)' : ''}`).join(' · ') || 'No increase' }));
  }
}
