import type { CharacterData, FeatureUses } from './character.model';
import { BONUS_ABILITIES } from './ability-score-bonuses';

export const USES_PB_MULTIPLIERS = [0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4] as const;
export type ProficiencyMultiplier = typeof USES_PB_MULTIPLIERS[number];

/** Complete definition of a use limit; consumption is stored separately in `used`. */
export type UsesTotal =
  | { kind: 'fixed'; value: number }
  /** Multiply the current proficiency bonus, rounding down to a whole use. */
  | { kind: 'proficiency-bonus'; multiplier: ProficiencyMultiplier }
  | { kind: 'ability-modifier'; ability: typeof BONUS_ABILITIES[number]['field'] };

export const USES_TOTAL_OPTIONS = [
  { value: 'fixed', label: 'Fixed Value' },
  { value: 'proficiency-bonus', label: 'Proficiency Bonus (PB)' },
  { value: 'ability-modifier', label: 'Ability Modifier' },
];
export const USES_ABILITY_OPTIONS = BONUS_ABILITIES;

export function usesTotalSelection(total?: UsesTotal): string {
  return total?.kind ?? 'fixed';
}

export function usesTotalFromSelection(value: string, previous?: UsesTotal): UsesTotal {
  if (value === previous?.kind) return previous;
  if (value === 'proficiency-bonus') return { kind: value, multiplier: 1 };
  if (value === 'ability-modifier') return { kind: value, ability: 'strength' };
  return { kind: 'fixed', value: 1 };
}

export function setUsesAbility(total: UsesTotal | undefined, value: string): void {
  const ability = BONUS_ABILITIES.find(ability => ability.field === value);
  if (total?.kind === 'ability-modifier' && ability) total.ability = ability.field;
}

export function setUsesMultiplier(total: UsesTotal | undefined, value: number): void {
  const multiplier = USES_PB_MULTIPLIERS.find(multiplier => multiplier === value);
  if (total?.kind === 'proficiency-bonus' && multiplier !== undefined) {
    total.multiplier = multiplier;
  }
}

export function validateUsesTotal(value: unknown): asserts value is UsesTotal {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid uses total.');
  const total = value as Record<string, unknown>;
  if (total['kind'] === 'fixed' && Number.isSafeInteger(total['value']) && Number(total['value']) >= 0) return;
  if (total['kind'] === 'proficiency-bonus'
    && USES_PB_MULTIPLIERS.some(multiplier => multiplier === total['multiplier'])) return;
  if (total['kind'] === 'ability-modifier' && BONUS_ABILITIES.some(ability => ability.field === total['ability'])) return;
  throw new Error('Invalid uses total.');
}

export function resolveUsesTotal(total: UsesTotal, character?: CharacterData | null): number {
  if (total.kind === 'fixed') return total.value;
  if (total.kind === 'proficiency-bonus') {
    const level = character?.level ?? 1;
    const bonus = level >= 17 ? 6 : level >= 13 ? 5 : level >= 9 ? 4 : level >= 5 ? 3 : 2;
    return Math.floor(bonus * total.multiplier);
  }
  const score = character?.abilityScores?.[total.ability];
  return typeof score === 'number' && Number.isFinite(score) ? Math.max(0, Math.floor((score - 10) / 2)) : 0;
}

export function featureUsesTotal(uses: FeatureUses | undefined, character?: CharacterData | null): number {
  return uses ? resolveUsesTotal(uses.total, character) : 1;
}
