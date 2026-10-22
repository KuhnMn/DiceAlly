import { ExportedCharacter, FeatureSource } from '../models/character.model';
import { CharacterHelpersService } from '../sheet/character-helpers.service';
import { SOURCE_ABILITIES, SourceCombatStats, SourceUsage, sourceAbilities } from '../models/feature-source-abilities';

export interface FeatureSourceStat { ability: string; modifier: string; attack: string; save?: number; }

/** Both creator lists use the sheet's modifier/proficiency rules and custom source overrides. */
export function featureSourceStats(
  source: FeatureSource,
  character: NonNullable<ExportedCharacter['character']>,
  helpers: CharacterHelpersService,
  usage: SourceUsage = 'features',
): FeatureSourceStat[] {
  if ((usage === 'features' ? source.isGeneralFeatureSource : source.isSpellcastingSource) === false) return [];
  const proficiency = helpers.proficiencyBonus(character);
  const abilities = sourceAbilities(source, usage);
  const stats: FeatureSourceStat[] = SOURCE_ABILITIES
    .filter(ability => abilities.includes(ability.key))
    .map(ability => {
      const modifier = helpers.modifierNumber(character.abilityScores?.[ability.key]);
      return {
        ability: ability.label,
        modifier: helpers.formatSigned(modifier),
        attack: helpers.formatSigned(source.customToHit ?? modifier + proficiency),
        save: source.customDc ?? 8 + modifier + proficiency,
      };
    });
  if (!stats.length && (source.customToHit != null || source.customDc != null)) {
    stats.push({
      ability: 'CUSTOM',
      modifier: '—',
      attack: source.customToHit == null ? '—' : helpers.formatSigned(source.customToHit),
      save: source.customDc ?? undefined,
    });
  }
  return stats;
}

export function sourceCombatStats(source: FeatureSource, character: NonNullable<ExportedCharacter['character']>, helpers: CharacterHelpersService, usage: SourceUsage): SourceCombatStats | undefined {
  const stats = featureSourceStats(source, character, helpers, usage);
  const attacks = stats.map(stat => Number(stat.attack)).filter(Number.isFinite);
  const saves = stats.flatMap(stat => stat.save == null ? [] : [stat.save]).filter(Number.isFinite);
  if (!attacks.length && !saves.length) return;
  return { ...(attacks.length ? { attackModifier: Math.max(...attacks) } : {}),
    ...(saves.length ? { savingThrowDifficulty: Math.max(...saves) } : {}) };
}
