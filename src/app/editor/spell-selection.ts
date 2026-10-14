import { ContentRecord, object } from '../content/content.model';
import { SpellEntryFull, SpellClassInfo, SpellEntity } from '../models/character.model';

export type SpellList = 'KNOWN' | 'SPELLBOOK' | 'PREPARED';
export interface SpellCatalogFilter {
  search: string;
  className: string;
  maximumLevel: number;
  publication: string;
}

/** The import uses upstream membership objects; Android exports use a flat class list. */
export function spellClasses(data: Record<string, unknown>): SpellClassInfo[] {
  const classes = data['classes'];
  const membership = object(classes);
  const values = Array.isArray(classes) ? classes : [
    ...(Array.isArray(membership?.['fromClassList']) ? membership['fromClassList'] : []),
    ...(Array.isArray(membership?.['fromClassListVariant']) ? membership['fromClassListVariant'] : []),
  ];
  const result = new Map<string, SpellClassInfo>();
  for (const value of values) {
    const entry = object(value);
    if (typeof entry?.['name'] !== 'string') continue;
    const name = entry['name'];
    const source = typeof entry['source'] === 'string' ? entry['source'] : '';
    result.set(JSON.stringify([name, source]), { name, source });
  }
  return [...result.values()];
}

export function matchesSpell(record: ContentRecord, filter: SpellCatalogFilter): boolean {
  if (record.kind !== 'spell') return false;
  const level = record.data['level'];
  if (typeof level !== 'number' || level > filter.maximumLevel) return false;
  if (filter.publication && record.publication !== filter.publication) return false;
  if (filter.className && !spellClasses(record.data).some(entry => entry.name.toLowerCase() === filter.className.toLowerCase())) return false;
  const text = `${record.name} ${record.publication}`.toLowerCase();
  return filter.search.trim().toLowerCase().split(/\s+/).every(term => text.includes(term));
}

/** List membership is scoped to a casting source, never just to the spell's name. */
export function spellIdentity(spell: SpellEntryFull): string {
  return JSON.stringify([spell.contentReference?.key ?? [spell.name, spell.source ?? ''], spell.castingSourceName ?? '']);
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
