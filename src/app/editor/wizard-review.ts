import { ExportedCharacter } from '../models/character.model';
import { PrefillChange, PrefillValue, readWizardValue } from './wizard-prefill';
import { object } from '../content/content.model';
import { FeatureSource } from '../models/character.model';
import { SOURCE_ABILITIES, sourceAbilities } from '../models/feature-source-abilities';
import { comparableWizardValue } from './wizard-fingerprint';

export const REVIEW_ACTION_LABELS: Record<PrefillChange['action'], string> = {
  Fill: 'Add', Update: 'Update', Remove: 'Remove', Keep: 'Keep Existing',
};
const ACTION_SUMMARIES = { Fill: 'added', Update: 'updated', Remove: 'removed', Keep: 'kept' };
export interface WizardReviewGroup {
  label: string;
  entries: PrefillChange[];
  counts: { action: PrefillChange['action']; label: string; count: number }[];
}
export interface WizardReviewSection { label: string; count: number; groups: WizardReviewGroup[]; }
export interface WizardReviewValues { before: string; after: string; suggested?: string; detail?: string; origin?: string; differences?: { label: string; current: string; suggested: string }[]; }

const DETAIL_LABELS: Readonly<Record<string, string>> = {
  name: 'Name', source: 'Source Book', castingSourceName: 'Casting Source', featureSourceName: 'Feature Source',
  listType: 'Spell List', featureType: 'Feature Type', entity: 'Description & Rules', featureEntity: 'Feature Details',
  featEntity: 'Feat Details', optionalFeatureEntity: 'Optional Feature Details',
  total: 'Total', level: 'Level', regainCondition: 'Recovery', dieType: 'Hit Die', value: 'Movement',
};

/** Compare player-facing settings, excluding bookkeeping and the annotations the merge preserves. */
function reviewDefinition(value: unknown, kind: string): Record<string, unknown> | undefined {
  const entry = object(value);
  if (!entry) return;
  if (kind === 'sources') {
    const source: FeatureSource = entry;
    const abilities = (usage: 'features' | 'spellcasting') => sourceAbilities(source, usage)
      .map(key => SOURCE_ABILITIES.find(ability => ability.key === key)!.label).sort().join(', ') || 'None';
    return { Name: source.name, Features: !!source.isGeneralFeatureSource, Spellcasting: !!source.isSpellcastingSource,
      'Feature Abilities': abilities('features'), 'Casting Abilities': abilities('spellcasting'),
      Spellbook: !!source.useSpellbook, 'Custom Attack Bonus': source.customToHit ?? 'Calculated', 'Custom Save DC': source.customDc ?? 'Calculated' };
  }
  return Object.fromEntries(Object.entries(entry).filter(([key]) => !['editorId', 'contentReference', 'userAdded', 'notes', 'uses'].includes(key)));
}

function reviewDifferences(current: unknown, suggested: unknown, kind: string) {
  const before = reviewDefinition(current, kind), after = reviewDefinition(suggested, kind);
  if (!before || !after) return [];
  const label = (value: unknown, fallback: string) => value == null ? 'Not Set' : value === true ? 'Yes' : value === false ? 'No'
    : typeof value === 'object' ? fallback : valueLabel(value);
  return [...new Set([...Object.keys(before), ...Object.keys(after)])]
    .filter(key => JSON.stringify(comparableWizardValue(before[key])) !== JSON.stringify(comparableWizardValue(after[key])))
    .map(key => ({ label: kind === 'sources' ? key : DETAIL_LABELS[key] ?? 'Other Details',
      current: label(before[key], 'Saved Details'), suggested: label(after[key], 'Library Details') }));
}

function valueLabel(value: unknown): string {
  if (value == null) return 'Not Set';
  if (value === true) return 'Granted';
  if (value === false) return 'Not Granted';
  if (Array.isArray(value)) return value.map(valueLabel).join(', ') || 'None';
  if (typeof value !== 'object') return ({ PROFICIENT: 'Proficient', EXPERTISE: 'Expertise', HALF: 'Half Proficiency' } as Record<string, string>)[String(value)] ?? String(value);
  const entry = object(value)!;
  if (typeof entry['dieType'] === 'string') return `${entry['total']} × ${entry['dieType']}`;
  if (typeof entry['total'] === 'number') return `${entry['total']} Slots`;
  const speed = object(entry['value']);
  if (speed?.['kind'] === 'fixed') return `${speed['feet']} ft.`;
  if (typeof entry['name'] === 'string') return [entry['name'], entry['subclass'], entry['source'], entry['custom'] ? 'Custom' : undefined, typeof entry['level'] === 'number' ? `Level ${entry['level']}` : undefined].filter(Boolean).join(' · ');
  return 'Configured Details';
}

/** Summaries use actual retained values, including manually added duplicates with a different ID. */
export function wizardReviewValues(change: PrefillChange, before: ExportedCharacter, after: ExportedCharacter, values: readonly PrefillValue[]): WizardReviewValues {
  const suggestions = values.filter(value => JSON.stringify(value.path) === JSON.stringify(change.path));
  const suggested = suggestions.at(-1);
  let previous = readWizardValue(before, change.path);
  let next = readWizardValue(after, change.path);
  if (change.action === 'Keep' && previous === undefined && suggested) {
    const wanted = object(suggested.value);
    const kind = change.path[0];
    if (wanted && (kind === 'features' || kind === 'spells' || kind === 'sources')) {
      const entries = kind === 'sources' ? before.character?.featureSources : before[kind];
      const match = entries?.find(entry => {
        const candidate = object(entry)!;
        return ['name', ...(kind === 'features' ? ['source', 'featureSourceName'] : kind === 'spells' ? ['source', 'castingSourceName', 'listType'] : [])]
          .every(field => candidate[field] === wanted[field]);
      });
      if (match) previous = next = match;
    }
  }
  const result: WizardReviewValues = { before: valueLabel(previous), after: valueLabel(next) };
  const origins = [...new Set(suggestions.flatMap(value => value.origin ? [value.origin] : []))];
  if (origins.length) result.origin = origins.join(', ');
  if (change.action === 'Keep') {
    const differences = suggested ? reviewDifferences(next, suggested.value, change.path[0]) : [];
    if (differences.length) result.differences = differences;
    if (suggested && valueLabel(suggested.value) !== result.after) result.suggested = valueLabel(suggested.value);
    result.detail = next == null ? 'This entry stays removed. The wizard will not add it again.'
      : change.keepReason === 'annotations' ? 'This setup no longer adds this entry. It stays on your character because it has notes or recorded uses.'
      : change.keepReason === 'linked' ? 'This source stays because your features, spells or spell slots still use it.'
      : result.suggested || differences.length ? 'Your current values will be kept. The wizard suggestions shown here will not be applied.'
      : 'Already on your character. Applying this setup will not change it.';
  }
  else if (change.action === 'Update' && result.before === result.after) result.detail = 'Definition details will be updated. Existing notes and usage counters are preserved.';
  return result;
}

/** Source groups retain every individual action, including protected edits and removed entries. */
export function groupWizardReview(changes: PrefillChange[], before: ExportedCharacter, after: ExportedCharacter): WizardReviewSection[] {
  const sections = new Map<string, Map<string, PrefillChange[]>>();
  for (const change of changes) {
    const sheet = change.action === 'Remove' ? before : after;
    const other = change.action === 'Remove' ? after : before;
    const [kind, id, field] = change.path;
    let section = 'Character stats';
    let group = kind === 'dice' ? 'Hit dice' : 'Level & health';
    if (kind === 'background' || kind === 'classes') {
      section = 'Character identity'; group = kind === 'background' ? 'Background' : 'Displayed classes';
    } else if (kind === 'features') {
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
    } else if (kind === 'species' || kind === 'resistances' || kind === 'speeds' || kind === 'character' && ['senses', 'speeds'].includes(id)) {
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
  return ['Character identity', 'Character stats', 'Feature Sources', 'Species & Movement', 'Proficiencies', 'Features', 'Spells & Slots']
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
