import type { SpellTime } from './character.model';

export const SPELL_CASTING_TIMES = [
  { value: 'action', label: 'Action' },
  { value: 'bonus', label: 'Bonus' },
  { value: 'reaction', label: 'Reaction' },
] as const;
export type SpellCastingTime = typeof SPELL_CASTING_TIMES[number]['value'];

export const SPELL_SCHOOLS = [
  { value: 'A', label: 'Abjuration', short: 'Abj' }, { value: 'C', label: 'Conjuration', short: 'Conj' },
  { value: 'D', label: 'Divination', short: 'Div' }, { value: 'E', label: 'Enchantment', short: 'Ench' },
  { value: 'V', label: 'Evocation', short: 'Evoc' }, { value: 'I', label: 'Illusion', short: 'Illus' },
  { value: 'N', label: 'Necromancy', short: 'Necro' }, { value: 'T', label: 'Transmutation', short: 'Trans' },
] as const;
export type SpellSchool = typeof SPELL_SCHOOLS[number]['value'];

export function matchesSpellSchool(school: unknown, selected: readonly SpellSchool[]): boolean {
  if (!selected.length) return true;
  const normalized = typeof school === 'string' ? school.trim().toLowerCase() : '';
  return SPELL_SCHOOLS.some(option => selected.includes(option.value) &&
    (normalized === option.value.toLowerCase() || normalized === option.label.toLowerCase()));
}

export function shortSpellSchoolLabel(school: unknown): string {
  const label = typeof school === 'string' ? school.trim() : '';
  return SPELL_SCHOOLS.find(option => option.value.toLowerCase() === label.toLowerCase() || option.label.toLowerCase() === label.toLowerCase())?.short ?? label.slice(0, 4);
}

/** Multiple choices match any listed casting time, including alternative times. */
export function matchesCastingTime(times: SpellTime[] | null | undefined, selected: readonly SpellCastingTime[]): boolean {
  return !selected.length || !!times?.some(time => selected.some(unit => time.unit?.trim().toLowerCase() === unit));
}

/** Expand schema codes while preserving custom labels. */
export function spellSchoolLabel(school: string): string {
  return SPELL_SCHOOLS.find(option => option.value === school?.trim().toUpperCase())?.label ?? school;
}
