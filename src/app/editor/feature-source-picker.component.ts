import { SourceStatsComponent } from '../sheet/source-stats.component';
import { HorizontalRowDirective } from '../sheet/horizontal-row.directive';
import { Component, inject, input, output } from '@angular/core';
import { NgClass } from '@angular/common';
import { ExportedCharacter, FeatureSource } from '../models/character.model';
import { CharacterHelpersService } from '../sheet/character-helpers.service';
import { featureSourceStats } from './feature-source-stats';
import { SearchableSelectComponent } from './searchable-select.component';
import { UiIconComponent } from '../ui-icon.component';
import { SpellSourceCount } from './spell-selection';

/** One source selector: cards for list filtering, compact searchable dropdowns for assignment. */
@Component({
  selector: 'app-feature-source-picker',
  imports: [HorizontalRowDirective, NgClass, SearchableSelectComponent, SourceStatsComponent, UiIconComponent],
  styleUrl: './editor.css',
  template: `
    <div class="source-picker" [class.selector-panel]="!compact()" [class.mb-3]="mode() === 'cards'" [attr.data-tone]="tone()">
      @if (compact() && mode() === 'dropdown') {
        <span class="field-label compact-source-heading">{{ heading() }}</span>
      } @else {
      <div class="flex justify-between items-center gap-2 mb-2">
        <span class="selector-heading text-sm font-semibold" [class.field-label]="mode() === 'dropdown'">{{ heading() }}</span>
        @if (mode() === 'cards' && showManage()) {
          <button type="button" class="secondary-button compact-button" (click)="manageSources.emit()">Feature Sources</button>
        }
      </div>
      }
      @if (mode() === 'dropdown') {
        <app-searchable-select [label]="heading()" placeholder="Select a Source" [options]="options"
          [value]="value()" [disabled]="disabled()" [compact]="compact()" (selected)="selected.emit($event)" />
      } @else {
      <div appHorizontalRow class="flex flex-wrap items-stretch gap-2">
        @for (option of options; track option.source ?? option.value) {
          <button type="button" class="max-w-full border-2 rounded-lg px-3 py-2 text-center text-sm break-words transition-colors max-sm:w-max"
            [ngClass]="value() === option.value ? activeClasses : 'border-outline-variant bg-surface-container'"
            [attr.aria-pressed]="value() === option.value" (click)="selected.emit(option.value)">
            <span class="font-semibold">{{ option.label }}</span>
            @if (showStats()) {
              @if (option.source; as source) { <app-source-stats [stats]="stats(source)" /> }
            }
            @if (spellCounts(); as counts) {
              @if (counts[option.value]; as count) {
                <span class="mt-1 flex items-center justify-center gap-3 text-xs">
                  <span class="inline-flex items-center gap-1" role="img" [attr.aria-label]="count.preparedCantrips + ' prepared cantrips'" title="Prepared cantrips"><app-ui-icon name="copyright" /><span class="font-semibold">{{ count.preparedCantrips }}</span></span>
                  <span class="inline-flex items-center gap-1" role="img" [attr.aria-label]="count.prepared + ' prepared spells'" title="Prepared spells (level 1+)"><app-ui-icon name="clipboard-check" /><span class="font-semibold">{{ count.prepared }}</span></span>
                  @if (count.spellbook !== undefined) {
                    <span class="inline-flex items-center gap-1" role="img" [attr.aria-label]="count.spellbook + ' spells in spellbook'" title="Spellbook"><app-ui-icon name="book" /><span class="font-semibold">{{ count.spellbook }}</span></span>
                  }
                </span>
              }
            }
          </button>
        }
      </div>
      }
    </div>
  `,
  styles: [`
    .compact-source-heading { margin-bottom: .25rem; }
    .source-picker { --selector-accent: var(--md-extended-color-custom-color3-color); }
    .source-picker[data-tone=spells] { --selector-accent: var(--md-extended-color-custom-color5-color); }
  `],
})
export class FeatureSourcePickerComponent {
  readonly character = input.required<NonNullable<ExportedCharacter['character']>>();
  readonly sources = input.required<FeatureSource[]>();
  readonly orphanNames = input<string[]>([]);
  readonly mode = input<'cards' | 'dropdown'>('cards');
  readonly compact = input(false);
  readonly showManage = input(true);
  readonly allowUnassigned = input(false);
  readonly disabled = input(false);
  readonly disabledValues = input<string[]>([]);
  readonly value = input('');
  readonly heading = input('Source');
  readonly tone = input<'features' | 'spells'>('features');
  readonly spellCounts = input<Record<string, SpellSourceCount> | null>(null);
  readonly showStats = input(true);
  readonly selected = output<string>();
  readonly manageSources = output<void>();
  private readonly helpers = inject(CharacterHelpersService);

  get activeClasses() {
    return this.tone() === 'features'
      ? 'bg-blue-container border-blue text-on-blue-container'
      : 'bg-purple-container border-purple text-on-purple-container';
  }

  get options(): { value: string; label: string; source?: FeatureSource; disabled?: boolean }[] {
    const options = [
      ...(this.mode() === 'cards' ? [{ value: 'ALL', label: 'All' }] : []),
      ...(this.allowUnassigned() ? [{ value: '', label: 'Unassigned' }] : []),
      ...this.sources().filter(source => !!source.name).map(source => ({
        value: source.name!, label: source.name!, source,
      })),
      ...this.orphanNames().filter(name => !this.sources().some(source => source.name === name)).map(name => ({ value: name, label: name || 'Unassigned' })),
    ];
    // Keep legacy/missing sources visible when editing an existing assignment.
    if (this.mode() === 'dropdown' && this.value() && !options.some(option => option.value === this.value())) {
      options.push({ value: this.value(), label: this.value() });
    }
    return options.map(option => ({ ...option, disabled: this.disabledValues().includes(option.value) }));
  }

  stats(source: FeatureSource) { return featureSourceStats(source, this.character(), this.helpers, this.tone() === 'spells' ? 'spellcasting' : 'features'); }
  displayDc(dc: number | undefined) { return dc != null && Number.isFinite(dc) ? dc : '—'; }
}
