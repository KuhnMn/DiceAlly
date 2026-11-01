import { Component, input, output } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ExportedCharacter } from '../models/character.model';
import { SpeciesAbility } from '../content/species.model';
import { UiIconComponent } from '../ui-icon.component';
import { AbilityBonusSelection, abilityBonusSources, resolveAbilityBonus, abilityBonusOptionLabel, asiBonusOptions, backgroundBonusOptions, BONUS_ABILITIES } from '../models/ability-score-bonuses';

/** One source editor, shared by Ability Scores and the owning feature/background. */
@Component({
  selector: 'app-ability-bonus-editor',
  imports: [FormsModule, UiIconComponent, NgTemplateOutlet],
  host: { class: 'block min-w-0', '[style.display]': 'sheet().abilityBonuses?.enabled ? null : "none"' },
  styleUrls: ['./editor.css', './ability-bonus-editor.component.css'],
  template: `
    @if (sheet().abilityBonuses?.enabled && source; as value) {
      <section class="bonus-editor" [class.bonus-editor-standalone]="showSource()" [attr.aria-label]="value.name + ' ability bonuses'">
        @if (showSource()) {
          <header class="flex flex-wrap items-center justify-between gap-2 border-b border-outline-variant bg-surface-container-high px-3 py-2">
            <div class="flex min-w-0 flex-1 flex-wrap items-center gap-2">
              <span class="min-w-0 font-semibold [overflow-wrap:anywhere]">{{ value.name }}</span>
              <span class="rounded border border-outline-variant bg-surface-container px-1.5 py-0.5 text-xs text-on-surface-variant">{{ value.kind }}</span>
            </div>
          </header>
        }
        <ng-template #configuration>
          <label class="bonus-config-field" [class.bonus-config-inline]="inlineConfiguration()">
            <span class="field-label">Bonus Type</span>
            <select class="editor-input" [ngModel]="preset" [ngModelOptions]="{standalone: true}" (ngModelChange)="setPreset($event)">
              <option value="none">No bonus</option>
              @if (value.hasContent) { <option value="content">From Content</option> }
              <option value="one">+2 to one ability</option>
              <option value="two">+1 to two abilities</option>
              @if (value.kind === 'Background') {
                <option value="three">+1 to three abilities</option>
                <option value="two-one">+2 and +1 to two abilities</option>
              }
              <option value="fixed">Custom fixed bonuses</option>
            </select>
          </label>
        </ng-template>
        <div class="bonus-controls">
          @if (inlineConfiguration()) { <ng-container [ngTemplateOutlet]="configuration" /> }
          @if (preset !== 'none') {
            <div class="bonus-controls">
              @if (value.options.length > 1) {
                <label class="block"><span class="sr-only">Bonus Alternative</span>
                  <select class="editor-input" [ngModel]="selection.optionIndex ?? ''" [ngModelOptions]="{standalone: true}" (ngModelChange)="setAlternative($event)">
                    <option value="">Choose an alternative</option>
                    @for (option of value.options; track $index) { <option [ngValue]="$index">{{ optionLabel(option) }}</option> }
                  </select>
                </label>
              } @else if (value.options.length === 1) { <p class="bonus-note">{{ optionLabel(value.options[0]) }}</p> }
              @if (choiceDefinition; as choice) {
                  <div class="bonus-allocation" role="group" aria-label="Ability allocation">
                    @for (amount of choiceWeights; track $index; let position = $index) {
                      <label class="bonus-ability"><span class="bonus-amount">{{ amount >= 0 ? '+' : '' }}{{ amount }}<span class="sr-only"> Ability Bonus</span></span>
                        <select class="editor-input" [ngModel]="selection.chosen?.[position] ?? ''" [ngModelOptions]="{standalone: true}" (ngModelChange)="setAbility(position, $event)">
                          <option value="">Choose ability</option>
                          @for (ability of abilities; track ability.key) {
                            @if (choice.from.includes(ability.key)) { <option [value]="ability.key" [disabled]="alreadyChosen(ability.key, position)">{{ ability.label }}</option> }
                          }
                        </select>
                      </label>
                    }
                  </div>
              }
              @if (preset === 'fixed') {
                <div class="bonus-fixed" role="group" aria-label="Fixed ability bonuses">
                  @for (ability of abilities; track ability.key) {
                    <label><span class="field-label">{{ ability.key.toUpperCase() }}</span><input type="number" min="-30" max="30" step="1" class="editor-input" [ngModel]="value.options[0].fixed[ability.key] ?? 0" [ngModelOptions]="{standalone: true}" (ngModelChange)="setFixed(ability.key, $event)" /></label>
                  }
                </div>
                <label class="bonus-maximum"><span class="font-semibold">Maximum Score</span><input type="number" min="1" max="30" step="1" class="editor-input !w-20" [ngModel]="value.options[0].maximum" [ngModelOptions]="{standalone: true}" (ngModelChange)="setMaximum($event)" /></label>
              }
              @if (!resolved.ready && !resolved.status.startsWith('Choose ')) { <p role="status" class="bonus-note">{{ resolved.status }}</p> }
            </div>
          }
          @if (!inlineConfiguration()) {
            <details class="bonus-config">
              <summary class="bonus-button text-primary">Configure Bonus <app-ui-icon name="chevron-down" /></summary>
              <ng-container [ngTemplateOutlet]="configuration" />
            </details>
          }
        </div>
      </section>
    }
  `,
})
export class AbilityBonusEditorComponent {
  readonly sheet = input.required<ExportedCharacter>();
  readonly sourceId = input.required<string>();
  readonly showSource = input(true);
  readonly inlineConfiguration = input(false);
  readonly edited = output<void>();
  readonly abilities = BONUS_ABILITIES;
  readonly optionLabel = abilityBonusOptionLabel;
  get source() { return abilityBonusSources(this.sheet()).find(source => source.id === this.sourceId()); }
  get selection() { return this.sheet().abilityBonuses?.choices[this.sourceId()] ?? {}; }
  get resolved() { return resolveAbilityBonus(this.source!, this.selection); }
  get choiceDefinition() {
    const choice = this.resolved.selected?.choice;
    return choice && choice.kind !== 'unavailable' && Array.isArray(choice.from) ? choice : undefined;
  }
  get choiceWeights(): number[] {
    const choice = this.resolved.selected?.choice;
    return choice?.kind === 'weighted' ? choice.weights : choice?.kind === 'uniform' ? Array.from({ length: Math.max(0, Math.min(6, choice.count)) }, () => choice.amount) : [];
  }
  get preset() {
    if (this.selection.disabled || !this.source?.options.length && !this.source?.error) return 'none';
    const custom = this.sheet().abilityBonuses?.custom[this.sourceId()];
    if (!custom) return 'content';
    const choice = custom[0]?.choice;
    if (!choice) return 'fixed';
    if (choice.kind === 'weighted' && choice.weights.length === 2 && choice.weights[0] === 2 && choice.weights[1] === 1) return 'two-one';
    return choice.kind === 'uniform' && choice.count === 3 ? 'three' : choice.kind === 'uniform' && choice.count === 2 ? 'two' : 'one';
  }
  private change(value: Partial<AbilityBonusSelection>) {
    const state = this.sheet().abilityBonuses!;
    state.choices[this.sourceId()] = { ...this.selection, ...value }; this.edited.emit();
  }
  setAlternative(index: number | '') { this.change({ optionIndex: index === '' ? undefined : Number(index), chosen: [] }); }
  setAbility(position: number, key: SpeciesAbility | '') {
    const chosen = [...this.selection.chosen ?? []]; chosen[position] = key as SpeciesAbility;
    this.change({ chosen });
  }
  alreadyChosen(key: SpeciesAbility, position: number) { return this.selection.chosen?.some((chosen, index) => index !== position && chosen === key) ?? false; }
  setPreset(preset: string) {
    const state = this.sheet().abilityBonuses!;
    if (preset === 'none') {
      const hasContent = this.source?.hasContent || !!this.source?.error;
      delete state.custom[this.sourceId()];
      delete state.choices[this.sourceId()];
      // Suppress structured content without modifying the saved library definition.
      if (hasContent) state.choices[this.sourceId()] = { disabled: true };
      this.edited.emit();
      return;
    }
    if (preset === 'content') delete state.custom[this.sourceId()];
    else if (preset === 'three' || preset === 'two-one') state.custom[this.sourceId()] = [backgroundBonusOptions()[preset === 'three' ? 0 : 1]];
    else state.custom[this.sourceId()] = preset === 'fixed' ? [{ fixed: {}, maximum: 20, hidden: false }] : [asiBonusOptions()[preset === 'two' ? 1 : 0]];
    this.change({ optionIndex: undefined, chosen: [], disabled: false });
  }
  setFixed(ability: SpeciesAbility, value: number) {
    if (!Number.isSafeInteger(value) || Math.abs(value) > 30) return;
    this.sheet().abilityBonuses!.custom[this.sourceId()][0].fixed[ability] = value; this.edited.emit();
  }
  setMaximum(value: number) {
    if (!Number.isSafeInteger(value) || value < 1 || value > 30) return;
    this.sheet().abilityBonuses!.custom[this.sourceId()][0].maximum = value; this.edited.emit();
  }
}
