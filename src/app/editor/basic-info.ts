import { ExportedCharacter, AbilityScores } from '../models/character.model';
import { canonicalDocument } from '../rules/character-document';

export const DEFENSE_ABILITIES: { key: keyof AbilityScores; label: string }[] = [
  { key: 'strength', label: 'Strength' }, { key: 'dexterity', label: 'Dexterity' },
  { key: 'constitution', label: 'Constitution' }, { key: 'intelligence', label: 'Intelligence' },
  { key: 'wisdom', label: 'Wisdom' }, { key: 'charisma', label: 'Charisma' },
];

export function emptyBasicCharacter(): ExportedCharacter {
  return { character: { characterUuid: crypto.randomUUID(), name: '', description: '', level: 1,
    maxHp: 0, armorClass: 10, calculateAC: false,
    abilityScores: { strength: 10, dexterity: 10, constitution: 10, intelligence: 10, wisdom: 10, charisma: 10 },
    resistances: [], senses: {}, speeds: { walk: 30 } } };
}

export function validateBasicInfo(sheet: ExportedCharacter): void {
  canonicalDocument(sheet);
  const character = sheet.character;
  if (sheet.background && (typeof sheet.background.name !== 'string' || !sheet.background.name.trim())) throw new Error('Enter a background name or clear the background.');
  if (!character?.characterUuid) throw new Error('Character identity is missing.');
  const integer = (value: unknown, label: string, minimum = 0) => {
    if (!Number.isSafeInteger(value) || Number(value) < minimum) throw new Error(`${label} must be a whole number of at least ${minimum}.`);
  };
  integer(character.level, 'Level', 1);
  for (const entry of sheet.classes ?? []) {
    if (typeof entry.name !== 'string' || !entry.name.trim()) throw new Error('Enter a class name or remove the empty class row.');
    integer(entry.level, 'Class level', 1);
  }
  integer(character.maxHp, 'Maximum HP');
  integer(character.speeds?.walk, 'Walk speed');
  for (const ability of DEFENSE_ABILITIES) integer(character.abilityScores?.[ability.key], ability.label);
  for (const [skill, bonus] of Object.entries(character.proficiencies?.skillMiscBonuses ?? {})) {
    if (!Number.isSafeInteger(bonus)) throw new Error(`${skill} bonus must be a whole number.`);
  }
  for (const [ability, bonus] of Object.entries(character.proficiencies?.saveMiscBonuses ?? {})) {
    if (!Number.isSafeInteger(bonus)) throw new Error(`${ability} saving throw bonus must be a whole number.`);
  }
  for (const source of character.featureSources ?? []) {
    for (const field of ['customDc', 'customToHit'] as const) {
      if (source[field] != null && !Number.isSafeInteger(source[field])) throw new Error(`${source.name ?? 'Source'} ${field} must be a whole number.`);
    }
  }
  for (const slots of Object.values(character.spellSlots ?? {})) for (const slot of slots) {
    integer(slot.level, 'Spell slot level', 1);
    if (slot.level > 9) throw new Error('Spell slot level must be 1–9.');
    integer(slot.total, 'Spell slot total', 1); integer(slot.used, 'Used spell slots');
    if (slot.regainCondition && !['SHORT_REST', 'SHORT_REST_ONE', 'LONG_REST', 'MANUAL'].includes(slot.regainCondition)) throw new Error('Unknown spell slot recovery setting.');
  }
  if (!character.calculateAC) integer(character.armorClass, 'Armor Class');
  if (Array.isArray(character.hitDice)) {
    for (const die of character.hitDice) {
      if (typeof die.dieType !== 'string' || !die.dieType.trim()) throw new Error('Hit dice need a die type.');
      integer(die.total, `${die.dieType} total`);
      integer(die.used, `${die.dieType} used`);
    }
  }
  for (const feature of [...sheet.features ?? [], ...sheet.spells ?? [], ...sheet.monsters ?? [], ...(sheet.species ? [sheet.species] : [])]) {
    for (const usage of feature.uses ?? []) {
      integer(usage.totalFreeUses ?? 1, `${feature.name} uses`);
      integer(usage.usedFreeUses ?? 0, `${feature.name} used count`);
      if (usage.freeUsesRegainCondition && !['SHORT_REST', 'SHORT_REST_ONE', 'LONG_REST', 'MANUAL'].includes(usage.freeUsesRegainCondition)) throw new Error(`Unknown recovery setting for ${feature.name}.`);
    }
    for (const group of feature.notes ?? []) if (!Array.isArray(group.notes) || group.notes.some(note => typeof note !== 'string')) throw new Error(`Invalid notes for ${feature.name}.`);
  }
  for (const monster of sheet.monsters ?? []) {
    if (monster.monsterMaxHP != null) integer(monster.monsterMaxHP, `${monster.name ?? 'Monster'} maximum HP`);
    if (monster.monsterMaxHpOverride != null) integer(monster.monsterMaxHpOverride, `${monster.name ?? 'Monster'} maximum HP`);
  }
  for (const [mode, speed] of Object.entries(character.speeds ?? {})) {
    if (speed != null) integer(speed, `${mode} speed`);
  }
  for (const [name, range] of Object.entries(character.senses ?? {})) {
    if (!name.trim()) throw new Error('Senses need a name.');
    integer(range, `${name} range`);
  }
}
