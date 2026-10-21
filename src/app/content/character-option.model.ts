import type { ProficiencyGrants } from './proficiency-grants';
import type { BrewSourceByKind } from './generated/brew-source';

type Background = BrewSourceByKind['background'];
export const CHARACTER_OPTION_KINDS = ['feat', 'optionalfeature', 'background'] as const;
export type CharacterOptionKind = typeof CHARACTER_OPTION_KINDS[number];
/** Existing selection/filter fields and typed shared grants; source-shaped descriptions are retained. */
export interface CharacterOptionDefinition {
  version: 1;
  kind: CharacterOptionKind;
  prerequisites: NonNullable<Background['prerequisite']>;
  category?: BrewSourceByKind['feat']['category'];
  featureTypes: NonNullable<BrewSourceByKind['optionalfeature']['featureType']>;
  proficiencies: ProficiencyGrants;
}
