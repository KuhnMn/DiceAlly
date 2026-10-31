import { Component, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ExportedCharacter } from '../models/character.model';
import { SpeciesAbility } from '../content/species.model';
import { UiIconComponent } from '../ui-icon.component';
import { AbilityBonusSelection, abilityBonusSources, resolveAbilityBonus, abilityBonusOptionLabel, asiBonusOptions, BONUS_ABILITIES } from '../models/ability-score-bonuses';

/** One source editor, shared by Ability Scores and the owning feature/background. */
@Component({
  selector: 'app-ability-bonus-editor',
  imports: [FormsModule, UiIconComponent],
  host: { class: 'block min-w-0', '[style.display]': 'sheet().abilityBonuses?.enabled ? null : "none"' },
  styleUrl: './editor.css',
  template: `
    @if (sheet().abilityBonuses?.enabled && source; as value) {
      <section class="min-w-0 overflow-hidden rounded-lg border-2 border-outline-variant bg-surface-container-low text-sm" [attr.aria-label]="value.name + ' ability bonuses'">
        <header class="flex flex-wrap items-center justify-between gap-2 border-b border-outline-variant bg-surface-container-high px-3 py-2">
          <div class="flex min-w-0 flex-1 flex-wrap items-center gap-2">
            <span class="min-w-0 font-semibold [overflow-wrap:anywhere]">{{ value.name }}</span>
            <span class="rounded border border-outline-variant bg-surface-container px-1.5 py-0.5 text-xs text-on-surface-variant">{{ value.kind }}</span>
          </div>
          @if (value.options.length || value.error) {
            <label class="flex min-h-11 shrink-0 cursor-pointer items-center gap-2 rounded-lg border border-outline-variant bg-surface px-2 text-xs"><input type="checkbox" [ngModel]="!selection.disabled" [ngModelOptions]="{standalone: true}" (ngModelChange)="setEnabled($event)" />Use Bonus</label>
          }
        </header>
        <div class="space-y-3 p-3">
        @if (!value.options.length && !value.error) {
          <button type="button" class="secondary-button inline-flex items-center gap-2" (click)="setPreset('one')"><app-ui-icon name="plus" />Add Stat Bonus</button>
        } @else {
          @if (!selection.disabled) {
            <div class="space-y-3">
              @if (value.options.length > 1) {
                <label class="block"><span class="field-label">Bonus Alternative</span>
                  <select class="editor-input" [ngModel]="selection.optionIndex ?? ''" [ngModelOptions]="{standalone: true}" (ngModelChange)="setAlternative($event)">
                    <option value="">Choose an alternative</option>
                    @for (option of value.options; track $index) { <option [ngValue]="$index">{{ optionLabel(option) }}</option> }
                  </select>
                </label>
              } @else if (value.options.length === 1) { <p class="rounded-lg border border-outline-variant bg-surface-container-high px-2.5 py-2 text-xs font-medium text-on-surface-variant">{{ optionLabel(value.options[0]) }}</p> }
              @if (choiceDefinition; as choice) {
                  <div class="grid grid-cols-1 gap-2 sm:grid-cols-2" role="group" aria-label="Ability allocation">
                    @for (amount of choiceWeights; track $index; let position = $index) {
                      <label class="block min-w-0 rounded-lg border border-outline-variant bg-surface-container p-2"><span class="field-label">{{ amount >= 0 ? '+' : '' }}{{ amount }} Ability Bonus</span>
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
                <div class="grid grid-cols-3 gap-2 rounded-lg border border-outline-variant bg-surface-container p-2 sm:grid-cols-6" role="group" aria-label="Fixed ability bonuses">
                  @for (ability of abilities; track ability.key) {
                    <label><span class="field-label">{{ ability.key.toUpperCase() }}</span><input type="number" min="-30" max="30" step="1" class="editor-input" [ngModel]="value.options[0].fixed[ability.key] ?? 0" [ngModelOptions]="{standalone: true}" (ngModelChange)="setFixed(ability.key, $event)" /></label>
                  }
                </div>
                <label class="flex items-center justify-between gap-2 rounded-lg border border-outline-variant bg-surface-container px-2 py-1.5 text-xs"><span class="font-semibold">Maximum Score</span><input type="number" min="1" max="30" step="1" class="editor-input !w-20" [ngModel]="value.options[0].maximum" [ngModelOptions]="{standalone: true}" (ngModelChange)="setMaximum($event)" /></label>
              }
              @if (!resolved.ready) { <p role="status" class="rounded-lg border border-outline-variant bg-surface-container-high px-2.5 py-2 text-xs text-on-surface-variant">{{ resolved.status }}</p> }
            </div>
          }
          <details class="overflow-hidden rounded-lg border border-outline-variant text-xs"><summary class="flex min-h-11 cursor-pointer items-center justify-between gap-2 bg-surface-container-high px-2.5 font-semibold text-primary">Configure Bonus <app-ui-icon name="chevron-down" /></summary>
            <label class="block border-t border-outline-variant p-2"><span class="field-label">Bonus Type</span><select class="editor-input" [ngModel]="preset" [ngModelOptions]="{standalone: true}" (ngModelChange)="setPreset($event)">
              <option value="content">From Content</option><option value="one">+2 to one ability</option><option value="two">+1 to two abilities</option><option value="fixed">Custom fixed bonuses</option>
            </select></label>
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
    const custom = this.sheet().abilityBonuses?.custom[this.sourceId()];
    return !custom ? 'content' : !custom[0]?.choice ? 'fixed' : custom[0].choice.kind === 'uniform' && custom[0].choice.count === 2 ? 'two' : 'one';
  }
  private change(value: Partial<AbilityBonusSelection>) {
    const state = this.sheet().abilityBonuses!;
    state.choices[this.sourceId()] = { ...this.selection, ...value }; this.edited.emit();
  }
  setEnabled(enabled: boolean) { this.change({ disabled: !enabled }); }
  setAlternative(index: number | '') { this.change({ optionIndex: index === '' ? undefined : Number(index), chosen: [] }); }
  setAbility(position: number, key: SpeciesAbility | '') {
    const chosen = [...this.selection.chosen ?? []]; chosen[position] = key as SpeciesAbility;
    this.change({ chosen });
  }
  alreadyChosen(key: SpeciesAbility, position: number) { return this.selection.chosen?.some((chosen, index) => index !== position && chosen === key) ?? false; }
  setPreset(preset: string) {
    const state = this.sheet().abilityBonuses!;
    if (preset === 'content') delete state.custom[this.sourceId()];
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
