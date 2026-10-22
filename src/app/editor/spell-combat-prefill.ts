import type { CombatAction, SpellEntity } from '../models/character.model';
import { prepareSpellEffects, SpellCastingStats } from '../content/spell-effects';

/** A level table is explicit source data, not a rule inferred from a cantrip's prose. */
function scaledCantripDamage(spell: SpellEntity, characterLevel?: number): string[] {
  if (spell.level !== 0 || !Number.isSafeInteger(characterLevel) || characterLevel! < 1 || !spell.scalingLevelDice) return [];
  const tables = Array.isArray(spell.scalingLevelDice) ? spell.scalingLevelDice : [spell.scalingLevelDice];
  const damageTypes = prepareSpellEffects(spell).damageTypes;
  return tables.flatMap(table => {
    const level = Object.keys(table.scaling ?? {}).map(Number).filter(level => level <= characterLevel!).sort((a, b) => b - a)[0];
    const dice = table.scaling?.[String(level)];
    if (!dice) return [];
    const label = tables.length === 1 && damageTypes.length === 1 ? damageTypes[0] : table.label;
    return [`${dice}${label ? ` ${label}` : ''}`];
  });
}

export function prepareSpellCombatFields(spell: SpellEntity, stats: SpellCastingStats | undefined, range: string, characterLevel?: number): Pick<CombatAction, 'actionType' | 'range' | 'hitOrDc' | 'damageOrHeal'> {
  const effects = prepareSpellEffects(spell), unit = spell.time?.[0]?.unit;
  const checks: string[] = [];
  const attack = stats?.attackModifier;
  if (effects.attackTypes.length) checks.push(attack != null && spell.spellAttack?.some(type => type === 'M' || type === 'R') ? `${attack >= 0 ? '+' : ''}${attack} to hit` : `${effects.attackTypes.join('/')} spell attack`);
  if (effects.savingThrows.length) checks.push(`DC ${stats?.savingThrowDifficulty ?? '?'} ${effects.savingThrows.join('/')}`);
  const parts = scaledCantripDamage(spell, characterLevel);
  if (!parts.length) {
    // Damage tags are explicit expressions. Generic dice can describe unrelated checks or other rolls.
    const dice = [...new Set([...JSON.stringify(spell.entries ?? []).matchAll(/\{@damage ([^}|]+)(?:\|[^}]*)?\}/g)].map(match => match[1]))];
    if (dice.length === 1 && effects.damageTypes.length === 1) parts.push(`${dice[0]} ${effects.damageTypes[0]}`);
    else {
      if (dice.length) parts.push(dice.join(' / '));
      if (effects.damageTypes.length) parts.push(`${effects.damageTypes.length > 1 ? 'Damage types: ' : ''}${effects.damageTypes.join('/')}${dice.length ? '' : ' damage'}`);
    }
  }
  if (effects.grantsHealing) parts.push('Healing');
  if (effects.grantsTemporaryHitPoints) parts.push('Temporary HP');
  if (effects.conditions.length) parts.push(`May cause: ${effects.conditions.join('/')}`);
  return {
    actionType: unit === 'bonus' ? 'BONUS' : unit === 'reaction' ? 'REACTION' : unit === 'action' ? 'ACTION' : 'OTHER',
    range: [range, ...effects.areaShapes].filter(Boolean).join(' · '),
    hitOrDc: checks.join(' / '), damageOrHeal: parts.join(' · '),
  };
}
