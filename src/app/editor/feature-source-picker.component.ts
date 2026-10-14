import { Component, inject, input, output } from '@angular/core';
import { NgClass } from '@angular/common';
import { ExportedCharacter, FeatureSource } from '../models/character.model';
import { CharacterHelpersService } from '../sheet/character-helpers.service';
import { featureSourceStats } from './feature-source-stats';
import { SearchableSelectComponent } from './searchable-select.component';

/** One source selector: cards for list filtering, compact searchable dropdowns for assignment. */
@Component({
  selector: 'app-feature-source-picker',
  imports: [NgClass, SearchableSelectComponent],
  styleUrl: './local-editor.component.css',
  template: `
    <div class="selector-panel source-picker" [class.mb-3]="mode() === 'cards'" [attr.data-tone]="tone()">
      <div class="flex justify-between items-center gap-2 mb-2">
        <span class="selector-heading text-sm font-semibold" [class.field-label]="mode() === 'dropdown'">{{ heading() }}</span>
        @if (mode() === 'cards') {
          <button type="button" class="secondary-button compact-button" (click)="manageSources.emit()">Feature Sources</button>
        }
      </div>
      @if (mode() === 'dropdown') {
        <app-searchable-select [label]="heading()" placeholder="Select a Source" [options]="options"
          [value]="value()" [disabled]="disabled()" (selected)="selected.emit($event)" />
      } @else {
      <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
        @for (option of options; track option.source ?? option.value) {
          <button type="button" class="border-2 rounded-lg p-2 text-center text-sm break-words transition-colors"
            [ngClass]="value() === option.value ? activeClasses : 'border-outline-variant bg-surface-container'"
            [attr.aria-pressed]="value() === option.value" (click)="selected.emit(option.value)">
            <span class="font-semibold">{{ option.label }}</span>
            @if (option.source; as source) {
              @for (stat of stats(source); track stat.ability) {
                <div class="text-xs mt-2">
                  <span class="font-semibold">{{ stat.ability }}</span>
                  <div class="flex justify-center gap-2 mt-1">
                    <div>Attack<div class="text-tertiary font-semibold">{{ stat.attack }}</div></div>
                    <div>Save DC<div class="text-primary font-semibold">{{ displayDc(stat.save) }}</div></div>
                  </div>
                </div>
              }
            }
          </button>
        }
      </div>
      }
    </div>
  `,
  styles: [`
    .source-picker { --selector-accent: var(--md-extended-color-custom-color3-color); }
    .source-picker[data-tone=spells] { --selector-accent: var(--md-extended-color-custom-color5-color); }
  `],
})
export class FeatureSourcePickerComponent {
  readonly character = input.required<NonNullable<ExportedCharacter['character']>>();
  readonly sources = input.required<FeatureSource[]>();
  readonly orphanNames = input<string[]>([]);
  readonly mode = input<'cards' | 'dropdown'>('cards');
  readonly allowUnassigned = input(false);
  readonly disabled = input(false);
  readonly value = input('');
  readonly heading = input('Source');
  readonly tone = input<'features' | 'spells'>('features');
  readonly selected = output<string>();
  readonly manageSources = output<void>();
  private readonly helpers = inject(CharacterHelpersService);

  get activeClasses() {
    return this.tone() === 'features'
      ? 'bg-blue-container border-blue text-on-blue-container'
      : 'bg-purple-container border-purple text-on-purple-container';
  }

  get options(): { value: string; label: string; source?: FeatureSource }[] {
    const options = [
      ...(this.mode() === 'cards' ? [{ value: 'ALL', label: 'All' }] : []),
      ...(this.allowUnassigned() ? [{ value: '', label: 'Unassigned' }] : []),
      ...this.sources().filter(source => !!source.name).map(source => ({
        value: source.name!, label: source.name!, source,
      })),
      ...this.orphanNames().map(name => ({ value: name, label: name || 'Unassigned' })),
    ];
    // Keep legacy/missing sources visible when editing an existing assignment.
    if (this.mode() === 'dropdown' && this.value() && !options.some(option => option.value === this.value())) {
      options.push({ value: this.value(), label: this.value() });
    }
    return options;
  }

  stats(source: FeatureSource) { return featureSourceStats(source, this.character(), this.helpers); }
  displayDc(dc: number | undefined) { return dc != null && Number.isFinite(dc) ? dc : '—'; }
}
