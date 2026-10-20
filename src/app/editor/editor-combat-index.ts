import { Injectable } from '@angular/core';
import { ExportedCharacter, SpellEntryFull } from '../models/character.model';
import { CombatResource, resolveCombatResource } from './combat-actions';
import { spellIdentity } from './spell-selection';

/** Scoped to one editor. Resolve bookmarks once per check, rather than once per row. */
@Injectable()
export class EditorCombatIndex {
  private sheet?: ExportedCharacter;
  private counts = new Map<CombatResource, number>();
  private spells = new Set<CombatResource>();
  private spellCounts = new Map<string, number>();
  clear() { this.sheet = undefined; }
  count(sheet: ExportedCharacter, resource: CombatResource): number {
    if (this.sheet !== sheet) {
      this.sheet = sheet; this.counts.clear(); this.spellCounts.clear();
      this.spells = new Set(sheet.spells ?? []);
      for (const action of sheet.combatActions ?? []) {
        const linked = resolveCombatResource(sheet, action);
        if (!linked) continue;
        this.counts.set(linked, (this.counts.get(linked) ?? 0) + 1);
        if (this.spells.has(linked)) {
          const key = spellIdentity(linked as SpellEntryFull);
          this.spellCounts.set(key, (this.spellCounts.get(key) ?? 0) + 1);
        }
      }
    }
    return this.spells.has(resource) ? this.spellCounts.get(spellIdentity(resource as SpellEntryFull)) ?? 0 : this.counts.get(resource) ?? 0;
  }
}
