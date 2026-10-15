import { ContentRecord } from '../content/content.model';
import { newEditorId } from './editor-identity';
import { spellClassMemberships } from '../content/spell-membership';
import { SpellEntryFull, SpellClassInfo, SpellEntity } from '../models/character.model';

export type SpellList = 'KNOWN' | 'SPELLBOOK' | 'PREPARED';

/** A list copy is a separate instance of the same content, in both the creator and playing sheet. */
export function copySpellToList(spell: SpellEntryFull, listType: SpellList): SpellEntryFull {
  return { ...structuredClone(spell), editorId: newEditorId(), listType };
}
export interface SpellCatalogFilter {
  search: string;
  classes: string[];
  levels: number[];
}

/** The import uses upstream membership objects; Android exports use a flat class list. */
export function spellClasses(data: Record<string, unknown>): SpellClassInfo[] {
  return spellClassMemberships(data['classes']);
}

export function matchesSpell(record: ContentRecord, filter: SpellCatalogFilter): boolean {
  if (record.kind !== 'spell') return false;
  const level = record.data['level'];
  if (typeof level !== 'number' || (filter.levels.length && !filter.levels.includes(level))) return false;
  const classes = filter.classes.map(name => name.toLowerCase());
  if (classes.length && !spellClasses(record.data).some(entry => classes.includes(entry.name.toLowerCase()))) return false;
  const text = `${record.name} ${record.publication}`.toLowerCase();
  return filter.search.trim().toLowerCase().split(/\s+/).every(term => text.includes(term));
}

/** List membership is scoped to a casting source, never just to the spell's name. */
export function spellIdentity(spell: SpellEntryFull): string {
  return JSON.stringify([spell.name, spell.source ?? '', spell.castingSourceName ?? '']);
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
