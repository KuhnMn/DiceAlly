import type { BrewSourceByKind } from './generated/brew-source';
import type { ContentRecord } from './content.model';
import validate from './generated/proficiency-validators.mjs';

type Source = BrewSourceByKind['background'];
export interface ProficiencyGrants {
  skills?: Source['skillProficiencies'];
  languages?: Source['languageProficiencies'];
  tools?: Source['toolProficiencies'];
  armor?: Source['armorProficiencies'];
  weapons?: Source['weaponProficiencies'];
}
export const PROFICIENCY_FIELDS = {
  skillProficiencies: 'skills', languageProficiencies: 'languages', toolProficiencies: 'tools',
  armorProficiencies: 'armor', weaponProficiencies: 'weapons',
} as const;
export type ProficiencyPackages = NonNullable<ProficiencyGrants[keyof ProficiencyGrants]>;
export type ProficiencyPackage = ProficiencyPackages[number];
export type ExplicitProficiencyChoice = NonNullable<NonNullable<ProficiencyGrants['skills']>[number]['choose']>;

/** Shared, validated source payload; source storage and exported snapshots remain unchanged. */
export function sourceProficiencyGrants(record: ContentRecord): ProficiencyGrants {
  const grants = Object.fromEntries(Object.entries(PROFICIENCY_FIELDS)
    .filter(([field]) => record.data[field] !== undefined)
    .map(([field, target]) => [target, record.data[field]]));
  if (!validate(grants)) {
    const issue = validate.errors?.[0];
    throw new Error(`Invalid proficiency grants at ${issue?.instancePath || '/'}: ${issue?.message ?? 'invalid structure'}.`);
  }
  return grants as ProficiencyGrants;
}
