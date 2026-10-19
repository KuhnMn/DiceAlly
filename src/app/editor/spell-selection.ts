import { ContentRecord } from '../content/content.model';
import { newEditorId } from './editor-identity';
import { spellClassMemberships } from '../content/spell-membership';
import { FeatureSource, SpellEntryFull, SpellClassInfo, SpellEntity, SpellTime } from '../models/character.model';

export type SpellList = 'KNOWN' | 'SPELLBOOK' | 'PREPARED';

export function spellListLabel(list: SpellList): string {
  return list === 'KNOWN' ? 'Spelllist' : list === 'SPELLBOOK' ? 'Spellbook' : 'Prepared';
}

export const SPELL_CASTING_TIMES = [
  { value: 'action', label: 'Action' },
  { value: 'bonus', label: 'Bonus' },
  { value: 'reaction', label: 'Reaction' },
] as const;
export type SpellCastingTime = typeof SPELL_CASTING_TIMES[number]['value'];

export const SPELL_SCHOOLS = [
  { value: 'A', label: 'Abjuration', short: 'Abj' }, { value: 'C', label: 'Conjuration', short: 'Conj' },
  { value: 'D', label: 'Divination', short: 'Div' }, { value: 'E', label: 'Enchantment', short: 'Ench' },
  { value: 'V', label: 'Evocation', short: 'Evoc' }, { value: 'I', label: 'Illusion', short: 'Illus' },
  { value: 'N', label: 'Necromancy', short: 'Necro' }, { value: 'T', label: 'Transmutation', short: 'Trans' },
] as const;
export type SpellSchool = typeof SPELL_SCHOOLS[number]['value'];

export function matchesSpellSchool(school: unknown, selected: readonly SpellSchool[]): boolean {
  if (!selected.length) return true;
  const normalized = typeof school === 'string' ? school.trim().toLowerCase() : '';
  return SPELL_SCHOOLS.some(option => selected.includes(option.value) &&
    (normalized === option.value.toLowerCase() || normalized === option.label.toLowerCase()));
}

export function shortSpellSchoolLabel(school: unknown): string {
  const label = typeof school === 'string' ? school.trim() : '';
  return SPELL_SCHOOLS.find(option => option.value.toLowerCase() === label.toLowerCase() || option.label.toLowerCase() === label.toLowerCase())?.short ?? label.slice(0, 4);
}

/** Multiple choices match any listed casting time, including alternative times. */
export function matchesCastingTime(times: SpellTime[] | null | undefined, selected: readonly SpellCastingTime[]): boolean {
  return !selected.length || !!times?.some(time => selected.some(unit => time.unit?.trim().toLowerCase() === unit));
}

/** A list copy is a separate instance of the same content, in both the creator and playing sheet. */
export function copySpellToList(spell: SpellEntryFull, listType: SpellList): SpellEntryFull {
  return { ...structuredClone(spell), editorId: newEditorId(), listType };
}
export interface SpellCatalogFilter {
  search: string;
  classes: string[];
  levels: number[];
  schools?: SpellSchool[];
}

/** The import uses upstream membership objects; Android exports use a flat class list. */
export function spellClasses(data: Record<string, unknown>): SpellClassInfo[] {
  return spellClassMemberships(data['classes']);
}

export function matchesSpell(record: ContentRecord, filter: SpellCatalogFilter): boolean {
  if (record.kind !== 'spell') return false;
  const level = record.data['level'];
  if (typeof level !== 'number' || (filter.levels.length && !filter.levels.includes(level))) return false;
  if (!matchesSpellSchool(record.data['school'], filter.schools ?? [])) return false;
  const classes = filter.classes.map(name => name.toLowerCase());
  if (classes.length && !spellClasses(record.data).some(entry => classes.includes(entry.name.toLowerCase()))) return false;
  const text = `${record.name} ${record.publication}`.toLowerCase();
  return filter.search.trim().toLowerCase().split(/\s+/).every(term => text.includes(term));
}

/** List membership is scoped to a casting source, never just to the spell's name. */
export function spellIdentity(spell: SpellEntryFull): string {
  return JSON.stringify([spell.name, spell.source ?? '', spell.castingSourceName ?? '']);
}

/** Membership totals for source cards, independent of search, filters and the selected view. */
export interface SpellSourceCount { prepared: number; preparedCantrips: number; spellbook?: number; }

export function spellSourceCounts(spells: readonly SpellEntryFull[], sources: readonly FeatureSource[], extraNames: readonly string[] = []): Record<string, SpellSourceCount> {
  const names = new Set(['ALL', ...sources.map(source => source.name!).filter(Boolean), ...extraNames]);
  return Object.fromEntries([...names].map(name => {
    const entries = name === 'ALL' ? spells : spells.filter(spell => (spell.castingSourceName ?? '') === name);
    const count = (list: SpellList, cantrips?: boolean) => new Set(entries.filter(spell => spell.listType === list
      && (cantrips === undefined || ((spell.entity?.level ?? 0) === 0) === cantrips)).map(spellIdentity)).size;
    const hasBook = entries.some(spell => spell.listType === 'SPELLBOOK')
      || sources.some(source => source.useSpellbook && (name === 'ALL' || source.name === name));
    return [name, { prepared: count('PREPARED', false), preparedCantrips: count('PREPARED', true), ...(hasBook ? { spellbook: count('SPELLBOOK') } : {}) }];
  }));
}

export function spellSnapshot(record: ContentRecord): SpellEntity {
  return { ...structuredClone(record.data), classes: spellClasses(record.data) } as unknown as SpellEntity;
}

export function preparedVersion(spell: SpellEntryFull, spells: SpellEntryFull[]): SpellEntryFull | undefined {
  const identity = spellIdentity(spell);
  return spells.find(entry => entry.listType === 'PREPARED' && spellIdentity(entry) === identity);
}

export function preparationLocked(spell: SpellEntryFull, spells: SpellEntryFull[]): boolean {
  return !!(spell.uses?.length || preparedVersion(spell, spells)?.uses?.length);
}
