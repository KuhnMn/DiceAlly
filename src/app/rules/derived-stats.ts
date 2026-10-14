import { abilityModifier } from './level-rules';
export const SKILL_ABILITIES = {
  athletics: 'str',acrobatics: 'dex','sleight of hand': 'dex',stealth: 'dex',arcana: 'int',history: 'int',investigation: 'int',nature: 'int',religion: 'int',
  'animal handling': 'wis',insight: 'wis',medicine: 'wis',perception: 'wis',survival: 'wis',deception: 'cha',intimidation: 'cha',performance: 'cha',persuasion: 'cha',
} as const;
export type Ability = 'str' | 'dex' | 'con' | 'int' | 'wis' | 'cha';
export type Skill = keyof typeof SKILL_ABILITIES;
export interface ProficiencyContribution {
  kind: 'save' | 'skill' | 'tool' | 'language' | 'armor' | 'weapon';
  target: string;
  rank: 0 | 0.5 | 1 | 2;
  origin: string;
}
export interface ArmorInput {
  id: string;
  type: 'light' | 'medium' | 'heavy' | 'shield' | 'other';
  ac?: number;
  bonus: number;
  equipped: boolean;
  requiresAttunement: boolean;
  attuned: boolean;
}
/** Android best-AC policy; caller supplies normalized equipment and separate contribution ledgers. */
export function deriveStats(input: {
  abilities: Record<Ability,number>;
  totalLevel: number;
  manual: ProficiencyContribution[];
  generated: ProficiencyContribution[];
  skillBonuses?: Partial<Record<Skill,number>>;
  saveBonuses?: Partial<Record<Ability,number>>;
  initiativeProficient?: boolean;
  initiativeBonus?: number;
  initiativeOverride?: number | null;
  armor: ArmorInput[];
  unarmoredAbility?: Ability;
  calculateAc: boolean;
  manualAc: number;
  acOverride?: number | null;
}) {
  const integer = (n: number,label: string) => { if (!Number.isSafeInteger(n)) throw new Error(`Invalid ${label}.`); return n; };
  integer(input.totalLevel,'level'); if (input.totalLevel < 1 || input.totalLevel > 20) throw new Error('Invalid total level.');
  const abilities: Ability[] = ['str','dex','con','int','wis','cha'];
  const modifiers = Object.fromEntries(abilities.map(a => [a,abilityModifier(input.abilities[a])])) as Record<Ability,number>;
  const proficiencyBonus = 2 + Math.floor((input.totalLevel - 1) / 4);
  const contributions = structuredClone([...input.manual,...input.generated]);
  for (const entry of contributions) {
    if (!entry.origin || !entry.target || ![0,0.5,1,2].includes(entry.rank) || !['save','skill','tool','language','armor','weapon'].includes(entry.kind)
      || (entry.kind === 'save' && (!abilities.includes(entry.target as Ability) || ![0,1].includes(entry.rank)))
      || (entry.kind === 'skill' && !Object.hasOwn(SKILL_ABILITIES,entry.target))) throw new Error('Invalid proficiency contribution.');
  }
  const rank = (kind: string,target: string) => Math.max(0,...contributions.filter(c => c.kind === kind && c.target === target).map(c => c.rank));
  const skills = Object.fromEntries(Object.entries(SKILL_ABILITIES).map(([skill,ability]) => [skill,
    modifiers[ability] + Math.floor(proficiencyBonus * rank('skill',skill)) + integer(input.skillBonuses?.[skill as Skill] ?? 0,'skill bonus')])) as Record<Skill,number>;
  const saves = Object.fromEntries(abilities.map(ability => [ability,
    modifiers[ability] + proficiencyBonus * rank('save',ability) + integer(input.saveBonuses?.[ability] ?? 0,'save bonus')])) as Record<Ability,number>;
  const baseInitiative = modifiers.dex + (input.initiativeProficient ? proficiencyBonus : 0) + integer(input.initiativeBonus ?? 0,'initiative bonus');
  const initiative = input.initiativeOverride == null ? baseInitiative : integer(input.initiativeOverride,'initiative override');
  let baseAc = 10 + modifiers.dex; let armorSource = 'unarmored'; let shieldAc = 0; let shieldSource: string | undefined; let miscellaneous = 0;
  const equipmentIds = new Set<string>();
  for (const item of input.armor) {
    if (!item.id || equipmentIds.has(item.id) || !['light','medium','heavy','shield','other'].includes(item.type)) throw new Error('Invalid armor identity/type.');
    equipmentIds.add(item.id); integer(item.bonus,'armor bonus'); if (item.ac !== undefined) integer(item.ac,'armor AC');
    if (!item.equipped || (item.requiresAttunement && !item.attuned)) continue;
    if (item.type === 'other') { miscellaneous += item.bonus; continue; }
    if (item.type === 'shield') {
      const value = (item.ac ?? 0) + item.bonus;
      if (value > shieldAc) { shieldAc = value; shieldSource = item.id; } continue;
    }
    if (item.ac === undefined) continue;
    const value = item.ac + item.bonus + (item.type === 'heavy' ? 0 : item.type === 'medium' ? Math.min(2,modifiers.dex) : modifiers.dex);
    if (value > baseAc) { baseAc = value; armorSource = item.id; }
  }
  if (input.unarmoredAbility) {
    if (!abilities.includes(input.unarmoredAbility)) throw new Error('Invalid unarmored ability.');
    const value = 10 + modifiers.dex + modifiers[input.unarmoredAbility];
    if (value > baseAc) { baseAc = value; armorSource = `unarmored:${input.unarmoredAbility}`; }
  }
  const calculatedAc = baseAc + shieldAc + miscellaneous;
  const ac = input.acOverride == null ? (input.calculateAc ? calculatedAc : integer(input.manualAc,'manual AC')) : integer(input.acOverride,'AC override');
  return { policy: 'android-v1' as const,modifiers,proficiencyBonus,skills,saves,initiative,baseInitiative,ac,calculatedAc,
    armorSource,shieldSource,contributions,manual: structuredClone(input.manual),generated: structuredClone(input.generated) };
}
