import { ExportedCharacter } from '../models/character.model';
import { PrefillChange } from './wizard-prefill';

export const REVIEW_ACTION_LABELS: Record<PrefillChange['action'], string> = {
  Fill: 'Add', Update: 'Update', Remove: 'Remove', Keep: 'Keep your edit',
};
const ACTION_SUMMARIES = { Fill: 'added', Update: 'updated', Remove: 'removed', Keep: 'kept' };
export interface WizardReviewGroup {
  label: string;
  entries: PrefillChange[];
  counts: { action: PrefillChange['action']; label: string; count: number }[];
}
export interface WizardReviewSection { label: string; count: number; groups: WizardReviewGroup[]; }

/** Source groups retain every individual action, including protected edits and removed entries. */
export function groupWizardReview(changes: PrefillChange[], before: ExportedCharacter, after: ExportedCharacter): WizardReviewSection[] {
  const sections = new Map<string, Map<string, PrefillChange[]>>();
  for (const change of changes) {
    const sheet = change.action === 'Remove' ? before : after;
    const other = change.action === 'Remove' ? after : before;
    const [kind, id, field] = change.path;
    let section = 'Character stats';
    let group = kind === 'dice' ? 'Hit dice' : 'Level & health';
    if (kind === 'features') {
      const feature = sheet.features?.find(entry => entry.editorId === id) ?? other.features?.find(entry => entry.editorId === id);
      const type = feature?.featEntity || feature?.featureType === 'FEAT' ? 'Feats'
        : feature?.optionalFeatureEntity || feature?.featureType === 'OPTIONAL_FEATURE' ? 'Optional Features' : 'Class Features';
      section = 'Features'; group = `${feature?.featureSourceName || 'Unassigned Source'} · ${type}`;
    } else if (kind === 'spells') {
      const spell = sheet.spells?.find(entry => entry.editorId === id) ?? other.spells?.find(entry => entry.editorId === id);
      const list = spell?.listType === 'PREPARED' ? 'Prepared' : spell?.listType === 'SPELLBOOK' ? 'Spellbook' : 'Spelllist';
      const level = spell?.entity?.level;
      section = 'Spells & Slots';
      group = `${spell?.castingSourceName || 'Unassigned Source'} · ${list} · ${level === 0 ? 'Cantrips' : level == null ? 'Spells' : `Level ${level}`}`;
    } else if (kind === 'slots') {
      section = 'Spells & Slots'; group = `${id} · Spell Slots`;
    } else if (kind === 'sources') {
      section = 'Feature Sources'; group = 'Sources';
    } else if (kind === 'species' || kind === 'resistances' || kind === 'character' && ['senses', 'speeds'].includes(id)) {
      section = 'Species & Movement'; group = kind === 'species' ? 'Species' : kind === 'resistances' ? 'Resistances' : id === 'senses' ? 'Senses' : 'Speeds';
    } else if (['saves', 'languages', 'custom'].includes(kind) || kind === 'character' && id === 'proficiencies') {
      section = 'Proficiencies';
      group = kind === 'languages' ? 'Languages' : kind === 'saves' || field === 'savingThrows' ? 'Saving throws'
        : field === 'skills' ? 'Skills' : field === 'tools' ? 'Tools' : 'Other proficiencies';
    }
    if (!sections.has(section)) sections.set(section, new Map());
    const groups = sections.get(section)!;
    const entries = groups.get(group) ?? [];
    entries.push(change); groups.set(group, entries);
  }
  return ['Character stats', 'Feature Sources', 'Species & Movement', 'Proficiencies', 'Features', 'Spells & Slots']
    .filter(label => sections.has(label)).map(label => ({
      label, count: [...sections.get(label)!.values()].reduce((count, entries) => count + entries.length, 0),
      groups: [...sections.get(label)!].sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true })).map(([label, entries]) => ({
        label, entries,
        counts: (['Fill', 'Update', 'Remove', 'Keep'] as const).map(action => ({
          action, label: ACTION_SUMMARIES[action], count: entries.filter(entry => entry.action === action).length,
        })).filter(count => count.count > 0),
      })),
    }));
}
