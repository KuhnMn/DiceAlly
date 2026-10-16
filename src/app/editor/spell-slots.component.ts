import { RecoveryIndicatorComponent } from '../recovery-indicator.component';
import { UiIconComponent } from '../ui-icon.component';
import { Component, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ExportedCharacter, SpellSlot } from '../models/character.model';

import { RECOVERY_OPTIONS } from './recovery-options';
import { FeatureSourcePickerComponent } from './feature-source-picker.component';

@Component({
  selector: 'app-editor-spell-slots', imports: [RecoveryIndicatorComponent, UiIconComponent, FormsModule, FeatureSourcePickerComponent],
  templateUrl: './spell-slots.component.html', styleUrl: './local-editor.component.css',
})
export class SpellSlotsComponent {
  readonly sheet = input.required<ExportedCharacter>();
  readonly edited = output<void>();
  readonly recoveryOptions = RECOVERY_OPTIONS;
  listVisible = true;
  newestSource = '';
  error = '';
  get character() { return this.sheet().character!; }
  get sources() { return (this.character.featureSources ?? []).filter(source => source.isSpellcastingSource && source.name?.trim()); }
  slots(source: string): SpellSlot[] {
    return [...(this.character.spellSlots?.[source] ?? [])].sort((a, b) => a.level - b.level);
  }
  change() { this.error = ''; this.edited.emit(); }
  get visibleSources() {
    return this.sources.filter(source => this.slots(source.name!).length)
      .sort((a, b) => Number(b.name === this.newestSource) - Number(a.name === this.newestSource));
  }
  hasCombination(source: string, level: number, recovery: string, except?: SpellSlot): boolean {
    return this.slots(source).some(slot => slot !== except && slot.level === level
      && (slot.regainCondition || 'LONG_REST') === recovery);
  }
  disabledSources(slot: SpellSlot): string[] {
    return this.sources.filter(source => this.hasCombination(source.name!, slot.level, slot.regainCondition || 'LONG_REST', slot))
      .map(source => source.name!);
  }
  setRecovery(source: string, slot: SpellSlot, recovery: string) {
    if (this.hasCombination(source, slot.level, recovery, slot)) {
      this.error = 'This source already has slots at this level with this recovery.'; return;
    }
    slot.regainCondition = recovery; this.change();
  }
  add() {
    const source = this.sources[0]?.name;
    if (!source) { this.error = 'Add a spellcasting source first.'; return; }
    const groups = this.character.spellSlots ??= {};
    if (!Object.hasOwn(groups, source)) Object.defineProperty(groups, source, { value: [], enumerable: true, writable: true, configurable: true });
    // Start with an unused level and zero slots so the row can be filled in safely.
    const combination = this.recoveryOptions.flatMap(recovery => Array.from({ length: 9 }, (_, i) => ({ level: i + 1, recovery: recovery.value })))
      .sort((a, b) => Number(this.slots(source).some(slot => slot.level === a.level)) - Number(this.slots(source).some(slot => slot.level === b.level))
        || Number(b.recovery === 'LONG_REST') - Number(a.recovery === 'LONG_REST'))
      .find(option => !this.hasCombination(source, option.level, option.recovery));
    if (!combination) { this.error = 'All level and recovery combinations for this source are already configured.'; return; }
    groups[source].unshift({ level: combination.level, total: 0, used: 0, regainCondition: combination.recovery, userAdded: true });
    this.newestSource = source;
    this.listVisible = true;
    this.change();
  }
  setLevel(source: string, slot: SpellSlot, value: number | null) {
    if (!Number.isInteger(value) || value! < 1 || value! > 9) {
      this.error = 'Choose a spell level from 1 to 9.'; return;
    }
    if (this.hasCombination(source, value!, slot.regainCondition || 'LONG_REST', slot)) {
      this.error = 'This source already has slots at this level.'; return;
    }
    slot.level = value!; this.change();
  }
  adjust(slot: SpellSlot, amount: number) { slot.total = Math.max(0, slot.total + amount); this.change(); }
  remove(source: string, index: number) {
    const slot = this.slots(source)[index];
    const stored = this.character.spellSlots![source];
    stored.splice(stored.indexOf(slot), 1); this.change();
  }
  move(from: string, index: number, to: string) {
    if (from === to) return;
    const slot = this.slots(from)[index];
    if (!this.sources.some(source => source.name === to) || this.hasCombination(to, slot.level, slot.regainCondition || 'LONG_REST', slot)) {
      this.error = 'The target source already has slots at this level. Choose another source.'; return;
    }
    const groups = this.character.spellSlots!;
    if (!Object.hasOwn(groups, to)) Object.defineProperty(groups, to, { value: [], enumerable: true, writable: true, configurable: true });
    groups[from].splice(groups[from].indexOf(slot), 1); groups[to].unshift(slot); this.newestSource = to; this.change();
  }
  get retainedSources() { return Object.keys(this.character.spellSlots ?? {}).filter(name => !this.sources.some(source => source.name === name) && this.slots(name).length > 0); }
}
