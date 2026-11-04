import type { CharacterData, FeatureUses } from './character.model';
import { BONUS_ABILITIES } from './ability-score-bonuses';

/** Omitted on older documents, where the numeric total remains authoritative. */
export type UsesTotal =
  | { kind: 'fixed' }
  | { kind: 'proficiency-bonus' }
  | { kind: 'ability-modifier'; ability: typeof BONUS_ABILITIES[number]['field'] };

export const USES_TOTAL_OPTIONS = [
  { value: 'fixed', label: 'Fixed Value' },
  { value: 'proficiency-bonus', label: 'Proficiency Bonus (PB)' },
  ...BONUS_ABILITIES.map(ability => ({ value: ability.field, label: `${ability.label} Modifier` })),
];

export function usesTotalSelection(total?: UsesTotal): string {
  return total?.kind === 'ability-modifier' ? total.ability : total?.kind ?? 'fixed';
}

export function usesTotalFromSelection(value: string): UsesTotal {
  if (value === 'proficiency-bonus') return { kind: value };
  const ability = BONUS_ABILITIES.find(ability => ability.field === value);
  return ability ? { kind: 'ability-modifier', ability: ability.field } : { kind: 'fixed' };
}

export function validateUsesTotal(value: unknown): void {
  if (value === undefined) return;
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid uses total.');
  const total = value as Record<string, unknown>;
  if (total['kind'] === 'fixed' || total['kind'] === 'proficiency-bonus') return;
  if (total['kind'] === 'ability-modifier' && BONUS_ABILITIES.some(ability => ability.field === total['ability'])) return;
  throw new Error('Invalid uses total.');
}

export function resolveUsesTotal(total: UsesTotal | undefined, fixed: number, character?: CharacterData | null): number {
  if (!total || total.kind === 'fixed') return fixed;
  if (total.kind === 'proficiency-bonus') {
    const level = character?.level ?? 1;
    return level >= 17 ? 6 : level >= 13 ? 5 : level >= 9 ? 4 : level >= 5 ? 3 : 2;
  }
  const score = character?.abilityScores?.[total.ability];
  return typeof score === 'number' && Number.isFinite(score) ? Math.max(0, Math.floor((score - 10) / 2)) : 0;
}

export function featureUsesTotal(uses: FeatureUses | undefined, character?: CharacterData | null): number {
  return resolveUsesTotal(uses?.totalCalculation, uses?.totalFreeUses ?? 1, character);
}
