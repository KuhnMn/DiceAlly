import { Component, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ExportedCharacter, SpellSlot } from '../models/character.model';

export const SLOT_RECOVERY = [
  { value: 'SHORT_REST', label: 'Short Rest' }, { value: 'SHORT_REST_ONE', label: 'Short Rest +1' },
  { value: 'LONG_REST', label: 'Long Rest' }, { value: 'MANUAL', label: 'Manual Only' },
] as const;

@Component({
  selector: 'app-editor-spell-slots', imports: [FormsModule],
  templateUrl: './spell-slots.component.html', styleUrl: './local-editor.component.css',
})
export class SpellSlotsComponent {
  readonly sheet = input.required<ExportedCharacter>();
  readonly edited = output<void>();
  readonly recoveryOptions = SLOT_RECOVERY;
  selectedSource = '';
  level: number | null = 1;
  total: number | null = 1;
  recovery = 'LONG_REST';
  error = '';
  get character() { return this.sheet().character!; }
  get sources() { return (this.character.featureSources ?? []).filter(source => source.isSpellcastingSource && source.name?.trim()); }
  slots(source: string): SpellSlot[] { return this.character.spellSlots?.[source] ?? []; }
  change() { this.error = ''; this.edited.emit(); }
  add() {
    const source = this.selectedSource || this.sources[0]?.name;
    if (!source || !this.sources.some(value => value.name === source)) { this.error = 'Choose a spellcasting source.'; return; }
    if (!Number.isSafeInteger(this.level) || this.level! < 1 || this.level! > 9 || !Number.isSafeInteger(this.total) || this.total! < 1) {
      this.error = 'Choose spell level 1–9 and a positive whole-number total.'; return;
    }
    const existing = this.slots(source).find(slot => slot.level === this.level);
    if (existing && (existing.regainCondition ?? 'LONG_REST') !== this.recovery) {
      this.error = 'This source already has slots at this level. Edit their recovery setting below before adding more.'; return;
    }
    const slots = this.character.spellSlots ??= {};
    if (!Object.hasOwn(slots, source)) Object.defineProperty(slots, source, { value: [], enumerable: true, writable: true, configurable: true });
    if (existing) existing.total += this.total!;
    else slots[source].push({ level: this.level!, total: this.total!, used: 0, regainCondition: this.recovery, userAdded: true });
    slots[source].sort((a, b) => a.level - b.level);
    this.total = 1; this.change();
  }
  adjust(slot: SpellSlot, amount: number) { slot.total = Math.max(0, slot.total + amount); this.change(); }
  remove(source: string, index: number) { this.character.spellSlots![source].splice(index, 1); this.change(); }
  move(from: string, index: number, event: Event) {
    const field = event.target as HTMLSelectElement; const to = field.value;
    if (from === to) return;
    const slot = this.slots(from)[index];
    if (!this.sources.some(source => source.name === to) || this.slots(to).some(other => other.level === slot.level)) {
      field.value = from; this.error = 'The target source already has slots at this level. Choose another source.'; return;
    }
    const groups = this.character.spellSlots!;
    if (!Object.hasOwn(groups, to)) Object.defineProperty(groups, to, { value: [], enumerable: true, writable: true, configurable: true });
    groups[from].splice(index, 1); groups[to].push(slot); groups[to].sort((a, b) => a.level - b.level); this.change();
  }
  get retainedSources() { return Object.keys(this.character.spellSlots ?? {}).filter(name => !this.sources.some(source => source.name === name) && this.slots(name).length > 0); }
}
