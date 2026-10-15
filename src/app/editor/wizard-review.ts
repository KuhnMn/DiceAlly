import { ExportedCharacter } from '../models/character.model';
import { PrefillChange } from './wizard-prefill';

export interface WizardReviewItem { label: string; action: PrefillChange['action']; entries?: PrefillChange[]; }

/** Collapse large Known lists only. Prepared spells and protected edits always remain individual rows. */
export function groupWizardReview(changes: PrefillChange[], before: ExportedCharacter, after: ExportedCharacter): WizardReviewItem[] {
  const spells = new Map([...before.spells ?? [], ...after.spells ?? []].map(spell => [spell.editorId, spell]));
  const groups = new Map<string, { label: string; action: PrefillChange['action']; entries: PrefillChange[] }>();
  const singles: WizardReviewItem[] = [];
  for (const change of changes) {
    const spell = change.path[0] === 'spells' ? spells.get(change.path[1]) : undefined;
    if (!spell || spell.listType !== 'KNOWN' || change.action === 'Keep') { singles.push(change); continue; }
    const level = spell.entity?.level;
    const source = spell.castingSourceName || 'Unassigned Source';
    const key = JSON.stringify([source, level, change.action]);
    let group = groups.get(key);
    if (!group) {
      const label = level === 0 ? 'Known Cantrips' : level == null ? 'Known Spells' : `Level ${level} Known Spells`;
      group = { label: `${source} · ${label}`, action: change.action, entries: [] };
      groups.set(key, group);
    }
    group.entries.push(change);
  }
  const bulk: WizardReviewItem[] = [];
  for (const group of groups.values()) {
    if (group.entries.length < 4) singles.push(...group.entries);
    else bulk.push({ ...group, label: `${group.label} (${group.entries.length})` });
  }
  // Keep significant individual changes above expandable catalogue additions.
  return [...singles, ...bulk];
}
