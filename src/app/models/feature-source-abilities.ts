import type { FeatureSource } from './character.model';

export const SOURCE_ABILITIES = [
  { key: 'strength', label: 'STR', legacyKey: 'usesStrength' },
  { key: 'dexterity', label: 'DEX', legacyKey: 'usesDexterity' },
  { key: 'constitution', label: 'CON', legacyKey: 'usesConstitution' },
  { key: 'intelligence', label: 'INT', legacyKey: 'usesIntelligence' },
  { key: 'wisdom', label: 'WIS', legacyKey: 'usesWisdom' },
  { key: 'charisma', label: 'CHA', legacyKey: 'usesCharisma' },
] as const;
export type SourceAbility = typeof SOURCE_ABILITIES[number]['key'];
export type SourceUsage = 'features' | 'spellcasting';
export interface SourceAbilityAssignments { features: SourceAbility[]; spellcasting: SourceAbility[]; }
export interface SourceCombatStats { attackModifier?: number; savingThrowDifficulty?: number; }

export function sourceAbilities(source: FeatureSource, usage: SourceUsage): readonly SourceAbility[] {
  if ((usage === 'features' ? source.isGeneralFeatureSource : source.isSpellcastingSource) === false) return [];
  return source.associatedAbilities?.[usage] ?? SOURCE_ABILITIES.filter(ability => source[ability.legacyKey] === true).map(ability => ability.key);
}

export function validateSourceAbilities(source: FeatureSource): void {
  if (source.associatedAbilities === undefined) return;
  for (const usage of ['features', 'spellcasting'] as const) {
    const abilities = source.associatedAbilities?.[usage];
    if (!Array.isArray(abilities) || new Set(abilities).size !== abilities.length
      || abilities.some(value => !SOURCE_ABILITIES.some(ability => ability.key === value))) throw new Error(`Invalid ${usage} abilities for ${source.name ?? 'source'}.`);
  }
}
