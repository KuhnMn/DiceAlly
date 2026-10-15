import { ExportedCharacter, FeatureSource } from '../models/character.model';
import { CharacterHelpersService } from '../sheet/character-helpers.service';
import { DEFENSE_ABILITIES } from './basic-info';

export interface FeatureSourceStat { ability: string; modifier: string; attack: string; save?: number; }

/** Both creator lists use the sheet's modifier/proficiency rules and custom source overrides. */
export function featureSourceStats(
  source: FeatureSource,
  character: NonNullable<ExportedCharacter['character']>,
  helpers: CharacterHelpersService,
): FeatureSourceStat[] {
  const proficiency = helpers.proficiencyBonus(character);
  const stats: FeatureSourceStat[] = DEFENSE_ABILITIES
    .filter(ability => source[`uses${ability.label}` as keyof FeatureSource])
    .map(ability => {
      const modifier = helpers.modifierNumber(character.abilityScores?.[ability.key]);
      return {
        ability: ability.key.slice(0, 3).toUpperCase(),
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
