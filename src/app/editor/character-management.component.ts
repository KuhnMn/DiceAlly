import { Component, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CharacterDocument } from '../rules/character-document';
import { ExportedCharacter, InventoryItem, Monster, Note, CombatAction } from '../models/character.model';
import { SKILL_ABILITIES, ProficiencyContribution } from '../rules/derived-stats';

@Component({
  selector: 'app-character-management', imports: [FormsModule],
  templateUrl: './character-management.component.html',
  styles: [`section { margin: 1rem 0; padding: 1rem; border: 1px solid #888; border-radius: .5rem; }
    label { display: block; margin: .6rem 0; } input:not([type=checkbox]), select, textarea { border: 1px solid #888; padding: .5rem; border-radius: .3rem; background: transparent; color: inherit; max-width: 100%; }
    textarea { display: block; width: 100%; min-height: 5rem; } button { border: 1px solid #888; padding: .4rem .7rem; border-radius: .3rem; margin: .3rem; }
    h3 { font-weight: bold; } article { margin: 1rem 0; padding: .75rem; border-top: 1px solid #888; } .row { display: flex; flex-wrap: wrap; gap: 1rem; }`],
})
export class CharacterManagementComponent {
  readonly document = input.required<CharacterDocument>();
  readonly edited = output<void>();
  readonly abilities = ['str', 'dex', 'con', 'int', 'wis', 'cha'];
  readonly skills = Object.keys(SKILL_ABILITIES);
  manualKind: ProficiencyContribution['kind'] = 'skill';
  manualTarget = 'perception';
  manualRank: ProficiencyContribution['rank'] = 1;
  condition = '';
  customItem = '';
  sourceName = '';
  poolName = '';

  get d() { return this.document(); }
  get sheet(): ExportedCharacter { return (this.d.presentation['sheet'] ??= {}) as ExportedCharacter; }
  get items(): InventoryItem[] { return this.sheet.inventory ??= []; }
  get monsters(): Monster[] { return this.sheet.monsters ??= []; }
  get notes(): Note[] { return this.sheet.notes ??= []; }
  get combatActions(): CombatAction[] { return this.sheet.combatActions ??= []; }
  get currency() { return (this.sheet.character ??= {}).currency ??= { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 }; }
  get conditions() { return this.sheet.conditions ??= []; }
  change() { this.edited.emit(); }
  addProficiency() {
    if (!this.manualTarget.trim()) return;
    this.d.creation.manualProficiencies.push({ kind: this.manualKind, target: this.manualTarget.trim(), rank: Number(this.manualRank) as ProficiencyContribution['rank'], origin: crypto.randomUUID() }); this.change();
  }
  addItem() {
    if (!this.customItem.trim()) return;
    this.items.push({ name: this.customItem.trim(), count: 1, isDummy: true, isEquipped: false, isAttuned: false, notes: [], uses: [] });
    this.customItem = ''; this.change();
  }
  addCondition() { if (this.condition.trim()) this.conditions.push(this.condition.trim()); this.condition = ''; this.change(); }
  addSource() {
    if (!this.sourceName.trim()) return;
    const source = { id: crypto.randomUUID(), label: this.sourceName.trim(), manual: true, ability: 'int', useSpellbook: false, customization: {} };
    this.d.creation.manualSources.push(source); this.d.instances.sources.push(structuredClone(source)); this.sourceName = ''; this.change();
  }
  addPool() {
    if (!this.poolName.trim()) return;
    const pool = { id: crypto.randomUUID(), kind: 'feature-uses' as const, total: 1, regain: 'LONG_REST' as const, manual: true, origins: [] };
    this.d.creation.manualResources.push(pool); this.d.session.resources[pool.id] = { used: 0 };
    this.d.presentation[pool.id] = this.poolName.trim(); this.poolName = ''; this.change();
  }
  setPoolUsed(id: string, used: number) { this.d.session.resources[id] = { used }; this.change(); }
  addNote() { this.notes.push({ id: Math.max(0, ...this.notes.map(n => n.id)) + 1, title: 'New note', body: '', orderIndex: this.notes.length }); this.change(); }
  addAction() { this.combatActions.push({ name: 'New action', actionType: 'ACTION', orderIndex: this.combatActions.length }); this.change(); }
  move<T>(list: T[], position: number, direction: number) {
    const target = position + direction; if (target < 0 || target >= list.length) return;
    [list[position], list[target]] = [list[target], list[position]];
    list.forEach((item, orderIndex) => Object.assign(item as object, { orderIndex })); this.change();
  }
  annotation(id: string) { return (this.d.session.annotations[id] ?? []).join('\n'); }
  annotate(id: string, value: string) { this.d.session.annotations[id] = value.split('\n'); this.change(); }
  suppressFeature(grants: { id: string }[]) {
    this.d.overrides.suppressedFeatureGrants = [...new Set([...this.d.overrides.suppressedFeatureGrants ?? [], ...grants.map(g => g.id)])]; this.change();
  }
  suppressSpell(grants: { id: string }[]) {
    this.d.overrides.suppressedSpellGrants = [...new Set([...this.d.overrides.suppressedSpellGrants ?? [], ...grants.map(g => g.id)])]; this.change();
  }
  changeSpellList(id: string, list: 'known' | 'prepared' | 'innate') {
    const spell = this.d.instances.spells.find(s => s.id === id)!;
    if (!spell.manual) {
      this.suppressSpell(spell.grants);
      spell.manual = true; spell.grants = [];
    }
    spell.list = list; this.change();
  }
  copySpell(id: string) {
    const spell = structuredClone(this.d.instances.spells.find(s => s.id === id)!);
    spell.id = crypto.randomUUID(); spell.manual = true; spell.grants = [];
    spell.list = spell.list === 'prepared' ? 'known' : 'prepared';
    this.d.instances.spells.push(spell); this.change();
  }
}
