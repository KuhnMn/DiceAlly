import type { BrewSourceByKind } from './generated/brew-source';
import type { ContentRecord } from './content.model';
import validateAdditionalSpells from './generated/additional-spells-validators.mjs';

/** Shared source contract; retain its conventional storage and stable grant paths. */
type SourceBlocks = NonNullable<BrewSourceByKind['feat']['additionalSpells']>;
export const SPELL_GRANT_LISTS = ['innate', 'known', 'prepared', 'expanded'] as const;
export type SpellGrantList = typeof SPELL_GRANT_LISTS[number];
type SourceLevel = NonNullable<NonNullable<SourceBlocks[number]['known']>['_']>;
export type SpellGrantEntries = Extract<SourceLevel, unknown[]>;
export type SpellGrantChoice = Exclude<SpellGrantEntries[number], string>;
type SourceFrequencies = Exclude<SourceLevel, unknown[]>;
export type SpellGrantFrequency = keyof SourceFrequencies;
// Generated patternProperties are unknown; source validation establishes these map values.
export type SpellGrantLevel = SpellGrantEntries | {
  [K in SpellGrantFrequency]?: K extends 'daily' | 'rest' | 'resource' | 'limited'
    ? Record<string, SpellGrantEntries>
    : SpellGrantEntries;
};
export type AdditionalSpells = (Omit<SourceBlocks[number], SpellGrantList>
  & Partial<Record<SpellGrantList, Record<string, SpellGrantLevel>>>)[];

/** Visit only schema-defined list/group branches, retaining source order and paths. */
export function visitSpellGrantGroups(
  value: SpellGrantLevel,
  path: string,
  visit: (entries: SpellGrantEntries, path: string, frequency?: SpellGrantFrequency, count?: string) => void,
): void {
  if (Array.isArray(value)) {
    visit(value, path);
    return;
  }
  for (const frequency of Object.keys(value) as SpellGrantFrequency[]) {
    const groupPath = `${path}.${frequency}`;
    if (frequency === 'daily' || frequency === 'rest' || frequency === 'resource' || frequency === 'limited') {
      for (const [count, entries] of Object.entries(value[frequency]!)) {
        visit(entries, `${groupPath}.${count}`, frequency, count);
      }
    } else {
      visit(value[frequency]!, groupPath, frequency);
    }
  }
}

export function additionalSpells(record: ContentRecord): AdditionalSpells | undefined {
  const value = record.data['additionalSpells'];
  // Historical native snapshots used null/empty arrays for an absent grant list.
  if (value == null || (Array.isArray(value) && value.length === 0)) return undefined;
  if (!validateAdditionalSpells(value)) {
    const issue = validateAdditionalSpells.errors?.[0];
    throw new Error(`Invalid additionalSpells at ${issue?.instancePath || '/'}: ${issue?.message ?? 'invalid structure'}.`);
  }
  return value as AdditionalSpells;
}

/** Route present payloads to the validated grant handler, including malformed legacy payloads.
 * This is a presence check, not a substitute for additionalSpells validation.
 */
export function hasAdditionalSpellPayload(record: ContentRecord): boolean {
  return record.data['additionalSpells'] != null;
}
