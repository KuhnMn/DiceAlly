import type { BrewSourceByKind } from './generated/brew-source';
import type { ContentRecord } from './content.model';
import { spellDefinition } from './spell-adapter';
import { STANDARD_CONDITIONS } from '../models/character-references';
import type { SourceCombatStats } from '../models/feature-source-abilities';

type SourceSpell = BrewSourceByKind['spell'];
/** Existing portable fields accept historical ability abbreviations as well as source names. */
export interface SpellEffectFields {
  damageInflict?: string[] | null;
  savingThrow?: string[] | null;
  spellAttack?: string[] | null;
  areaTags?: string[] | null;
  conditionInflict?: SourceSpell['conditionInflict'] | null;
  miscTags?: string[] | null;
  scalingLevelDice?: SourceSpell['scalingLevelDice'] | null;
}

const title = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);
export const SPELL_DAMAGE_TYPES = ['acid', 'bludgeoning', 'cold', 'fire', 'force', 'lightning', 'necrotic', 'piercing', 'poison', 'psychic', 'radiant', 'slashing', 'thunder'] as const;
export const SPELL_SAVE_NAMES = { strength: 'Strength', dexterity: 'Dexterity', constitution: 'Constitution', intelligence: 'Intelligence', wisdom: 'Wisdom', charisma: 'Charisma' } as const;
const ABILITY_ALIASES: Readonly<Record<string, string>> = Object.fromEntries(Object.keys(SPELL_SAVE_NAMES).map(name => [name.slice(0, 3), name]));
export const spellSaveName = (value: string) => ABILITY_ALIASES[value.toLowerCase()] ?? value.toLowerCase();
export const spellSaveLabel = (value: string) => title(spellSaveName(value));
export const SPELL_AREA_NAMES = { C: 'Cube', E: 'Emanation', H: 'Hemisphere', L: 'Line', MT: 'Multiple targets', N: 'Cone', Q: 'Square', R: 'Circle', ST: 'Single target', S: 'Sphere', W: 'Wall', Y: 'Cylinder' } as const;
const ATTACK_NAMES: Readonly<Record<string, string>> = { M: 'Melee', R: 'Ranged', O: 'Special' };
const unique = (values: readonly string[] | null | undefined) => [...new Set(values ?? [])];

export interface PreparedSpellEffects {
  damageTypes: string[];
  savingThrows: string[];
  conditions: string[];
  attackTypes: string[];
  areaShapes: string[];
  grantsHealing: boolean;
  grantsTemporaryHitPoints: boolean;
}

/** Metadata describes possible effects, not an instruction to apply every listed effect. */
export function prepareSpellEffects(spell: SpellEffectFields | null | undefined): PreparedSpellEffects {
  return {
    damageTypes: unique(spell?.damageInflict).map(title),
    savingThrows: unique(spell?.savingThrow?.map(spellSaveName)).map(title),
    conditions: unique(spell?.conditionInflict).map(title),
    attackTypes: unique(spell?.spellAttack).map(value => ATTACK_NAMES[value] ?? value),
    areaShapes: unique(spell?.areaTags).filter(value => value !== 'ST' && value !== 'MT').map(value => SPELL_AREA_NAMES[value as keyof typeof SPELL_AREA_NAMES] ?? value),
    grantsHealing: spell?.miscTags?.includes('HL') ?? false,
    grantsTemporaryHitPoints: spell?.miscTags?.includes('THP') ?? false,
  };
}

export type SpellCastingStats = SourceCombatStats;

export function spellEffectSummary(spell: SpellEffectFields | null | undefined, stats?: SpellCastingStats): { label: string; text: string }[] {
  const effects = prepareSpellEffects(spell);
  const attack = stats?.attackModifier;
  const attackText = effects.attackTypes.join(' / ');
  const saveText = effects.savingThrows.join(' / ');
  return [
    { label: 'Attack', values: effects.attackTypes.length ? [attack != null && spell?.spellAttack?.some(type => type === 'M' || type === 'R') ? `${attackText} ${attack >= 0 ? '+' : ''}${attack} to hit` : attackText] : [] },
    { label: 'Save', values: effects.savingThrows.length ? [stats?.savingThrowDifficulty != null ? `DC ${stats.savingThrowDifficulty} ${saveText}` : saveText] : [] },
    { label: 'Damage types', values: effects.damageTypes }, { label: 'May cause', values: effects.conditions },
    { label: 'Area', values: effects.areaShapes },
    { label: 'Effect', values: [...(effects.grantsHealing ? ['Healing'] : []), ...(effects.grantsTemporaryHitPoints ? ['Temporary HP'] : [])] },
  ].filter(row => row.values.length).map(row => ({ label: row.label, text: row.values.join(' / ') }));
}

/** Canonical casting/attack data and retained source effect metadata have explicit owners. */
export function spellEffectsFromRecord(record: ContentRecord, definition = spellDefinition(record)): SpellEffectFields {
  const data = record.data as SpellEffectFields;
  return { damageInflict: data.damageInflict, savingThrow: data.savingThrow, conditionInflict: data.conditionInflict,
    areaTags: data.areaTags, miscTags: data.miscTags, scalingLevelDice: data.scalingLevelDice, spellAttack: definition.spellAttack };
}

export interface SpellEffectFilter {
  damageTypes?: string[];
  savingThrows?: string[];
  conditions?: string[];
  areas?: string[];
}
export const SPELL_EFFECT_FILTER_GROUPS = [
  { key: 'damageTypes', label: 'Damage type', options: SPELL_DAMAGE_TYPES.map(value => ({ value, label: title(value) })) },
  { key: 'savingThrows', label: 'Saving throw', options: Object.entries(SPELL_SAVE_NAMES).map(([value, label]) => ({ value, label })) },
  { key: 'conditions', label: 'Condition', options: STANDARD_CONDITIONS.map(value => ({ value: value.toLowerCase(), label: title(value.toLowerCase()) })) },
  { key: 'areas', label: 'Area', options: Object.entries(SPELL_AREA_NAMES).map(([value, label]) => ({ value, label })) },
] as const;
export const spellEffectFilterCount = (filter: SpellEffectFilter | undefined) => SPELL_EFFECT_FILTER_GROUPS.reduce((count, group) => count + (filter?.[group.key]?.length ?? 0), 0);

/** OR within each selected group, AND between groups. Missing metadata never matches a selection. */
export function matchesSpellEffects(spell: SpellEffectFields | null | undefined, filter: SpellEffectFilter = {}): boolean {
  const matches = (selected: readonly string[] | undefined, values: readonly string[] | null | undefined) => !selected?.length || selected.some(value => values?.includes(value));
  return matches(filter.damageTypes, spell?.damageInflict) && matches(filter.savingThrows?.map(spellSaveName), spell?.savingThrow?.map(spellSaveName))
    && matches(filter.conditions, spell?.conditionInflict) && matches(filter.areas, spell?.areaTags);
}
