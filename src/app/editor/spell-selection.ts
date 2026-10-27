import { spellDefinition, spellRecordClasses, projectSpellData } from '../content/spell-adapter';
import { ContentRecord } from '../content/content.model';
import { newEditorId } from './editor-identity';
import { FeatureSource, SpellEntryFull, SpellEntity } from '../models/character.model';
import { SpellEffectFilter, matchesSpellEffects, spellEffectsFromRecord } from '../content/spell-effects';
import { matchesSpellSchool, SpellSchool } from '../models/spell-metadata';

export type SpellList = 'KNOWN' | 'SPELLBOOK' | 'PREPARED';

export function spellListLabel(list: SpellList): string {
  return list === 'KNOWN' ? 'Spelllist' : list === 'SPELLBOOK' ? 'Spellbook' : 'Prepared';
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
  effects?: SpellEffectFilter;
}

export function matchesSpell(record: ContentRecord, filter: SpellCatalogFilter): boolean {
  if (record.kind !== 'spell') return false;
  const definition = spellDefinition(record);
  const level = definition.level;
  if (filter.levels.length && !filter.levels.includes(level)) return false;
  if (!matchesSpellSchool(definition.school, filter.schools ?? [])) return false;
  if (filter.effects && !matchesSpellEffects(spellEffectsFromRecord(record, definition), filter.effects)) return false;
  const classes = filter.classes.map(name => name.toLowerCase());
  if (classes.length && !spellRecordClasses(record).some(entry => classes.includes(entry.name.toLowerCase()))) return false;
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
  return projectSpellData(record) as unknown as SpellEntity;
}

export function preparedVersion(spell: SpellEntryFull, spells: SpellEntryFull[]): SpellEntryFull | undefined {
  const identity = spellIdentity(spell);
  return spells.find(entry => entry.listType === 'PREPARED' && spellIdentity(entry) === identity);
}

export function preparationLocked(spell: SpellEntryFull, spells: SpellEntryFull[]): boolean {
  return !!(spell.uses?.length || preparedVersion(spell, spells)?.uses?.length);
}
