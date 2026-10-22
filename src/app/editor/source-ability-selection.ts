import type { FeatureSource } from '../models/character.model';
import { SOURCE_ABILITIES, SourceAbility, SourceAbilityAssignments, sourceAbilities } from '../models/feature-source-abilities';

export type SourceAbilityState = 'none' | 'features' | 'spellcasting' | 'both';
export const SOURCE_ABILITY_STATE_LABELS = { none: 'Not used', features: 'Features', spellcasting: 'Spellcasting', both: 'Features and Spellcasting' } as const;


/** Materialize historical shared flags once before editing a scope; new assignments have one owner. */
export function editableSourceAbilities(source: FeatureSource): SourceAbilityAssignments {
  source.associatedAbilities ??= { features: [...sourceAbilities(source, 'features')], spellcasting: [...sourceAbilities(source, 'spellcasting')] };
  for (const ability of SOURCE_ABILITIES) delete source[ability.legacyKey];
  return source.associatedAbilities;
}

export function sourceAbilityState(source: FeatureSource, ability: SourceAbility): SourceAbilityState {
  const features = !!source.isGeneralFeatureSource && sourceAbilities(source, 'features').includes(ability);
  const spellcasting = !!source.isSpellcastingSource && sourceAbilities(source, 'spellcasting').includes(ability);
  return features && spellcasting ? 'both' : features ? 'features' : spellcasting ? 'spellcasting' : 'none';
}

export function cycleSourceAbility(source: FeatureSource, ability: SourceAbility): void {
  if (!source.isGeneralFeatureSource && !source.isSpellcastingSource) return;
  const assignments = editableSourceAbilities(source);
  if (source.isGeneralFeatureSource && source.isSpellcastingSource) {
    const states: SourceAbilityState[] = ['none', 'features', 'spellcasting', 'both'];
    const next = states[(states.indexOf(sourceAbilityState(source, ability)) + 1) % states.length];
    assignments.features = assignments.features.filter(value => value !== ability);
    assignments.spellcasting = assignments.spellcasting.filter(value => value !== ability);
    if (next === 'features' || next === 'both') assignments.features.push(ability);
    if (next === 'spellcasting' || next === 'both') assignments.spellcasting.push(ability);
  } else {
    const usage = source.isGeneralFeatureSource ? 'features' : 'spellcasting';
    assignments[usage] = assignments[usage].includes(ability) ? assignments[usage].filter(value => value !== ability) : [...assignments[usage], ability];
  }
}

