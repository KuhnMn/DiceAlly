import type { ContentReference, Entry, ExportedCharacter } from './character.model';

export const STANDARD_CONDITIONS = ['BLINDED', 'CHARMED', 'DEAFENED', 'EXHAUSTION', 'FRIGHTENED', 'GRAPPLED', 'INCAPACITATED', 'INVISIBLE', 'PARALYZED', 'PETRIFIED', 'POISONED', 'PRONE', 'RESTRAINED', 'STUNNED', 'UNCONSCIOUS'] as const;
export const STANDARD_SENSES = ['Blindsight', 'Darkvision', 'Tremorsense', 'Truesight'] as const;
export const SKILL_DEFINITIONS = [
  { name: 'Acrobatics', ability: 'dex' }, { name: 'Animal Handling', ability: 'wis' },
  { name: 'Arcana', ability: 'int' }, { name: 'Athletics', ability: 'str' },
  { name: 'Deception', ability: 'cha' }, { name: 'History', ability: 'int' },
  { name: 'Insight', ability: 'wis' }, { name: 'Intimidation', ability: 'cha' },
  { name: 'Investigation', ability: 'int' }, { name: 'Medicine', ability: 'wis' },
  { name: 'Nature', ability: 'int' }, { name: 'Perception', ability: 'wis' },
  { name: 'Performance', ability: 'cha' }, { name: 'Persuasion', ability: 'cha' },
  { name: 'Religion', ability: 'int' }, { name: 'Sleight of Hand', ability: 'dex' },
  { name: 'Stealth', ability: 'dex' }, { name: 'Survival', ability: 'wis' },
] as const;

export interface RuleDescriptionSnapshot {
  name: string;
  source: string;
  entries: Entry[];
  contentReference?: ContentReference;
}

export type BasicActionType = 'ACTION' | 'BONUS' | 'REACTION' | 'OTHER';

/** Prepared timing categories; descriptions remain detached, portable snapshots. */
export interface BasicActionDescription extends RuleDescriptionSnapshot {
  source: 'XPHB' | 'XDMG';
  actionTypes: BasicActionType[];
}

/** Reference definitions only. Ranges, proficiency and active effects stay in their existing fields. */
export interface CharacterReferenceDescriptions {
  skills: RuleDescriptionSnapshot[];
  senses: RuleDescriptionSnapshot[];
  conditions: RuleDescriptionSnapshot[];
}
export type CharacterReferenceCategory = keyof CharacterReferenceDescriptions;

const referenceName = (name: string) => name.replace(/_/g, ' ').trim().toLowerCase();
export function referenceDescription(sheet: ExportedCharacter | null | undefined, category: CharacterReferenceCategory, name: string): RuleDescriptionSnapshot | undefined {
  return sheet?.referenceDescriptions?.[category].find(reference => referenceName(reference.name) === referenceName(name));
}
