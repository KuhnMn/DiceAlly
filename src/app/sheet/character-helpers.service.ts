import { spellSchoolLabel } from '../models/spell-metadata';
import { SKILL_DEFINITIONS } from '../models/character-references';
import { Injectable } from '@angular/core';
import { castingTimeText, prepareSpellCastingTimes, prepareSpellComponents, prepareSpellDurations, spellDurationText } from './spell-presentation';
import {
  Entry,
  FeatureEntryFull,
  SpellComponents,
  SpellDuration,
  SpellEntryFull,
  SpellRange,
  SpellTime,
  CharacterData,
  InventoryItem,
} from '../models/character.model';

@Injectable({
  providedIn: 'root',
})
export class CharacterHelpersService {
  readonly skillDefinitions = SKILL_DEFINITIONS;

  // Feature-related helpers
  featureEntries(feature: FeatureEntryFull): Entry[] {
    return (
      feature.featureEntity?.entries ??
      feature.featEntity?.entries ??
      feature.optionalFeatureEntity?.entries ??
      []
    );
  }

  featureTypeLabel(feature: FeatureEntryFull): string {
    if (feature.featureType) return feature.featureType;
    if (feature.featEntity) return 'FEAT';
    if (feature.optionalFeatureEntity) return 'OPTIONAL_FEATURE';
    return 'CLASS_FEATURE';
  }

  featureTypeOrder(feature: FeatureEntryFull): number {
    const type = this.featureTypeLabel(feature);
    if (type === 'CLASS_FEATURE') return 0;
    if (type === 'FEAT') return 1;
    if (type === 'OPTIONAL_FEATURE') return 2;
    return 3;
  }

  featureLevel(feature: FeatureEntryFull): number {
    return feature.featureEntity?.level ?? 0;
  }

  sourceId(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  }

  // Spell-related helpers
  spellLevelLabel(spell: SpellEntryFull): string {
    const level = spell.entity?.level ?? 0;
    return level === 0 ? 'Cantrip' : `Level ${level}`;
  }

  spellSchoolLabel(school: string): string {
    return spellSchoolLabel(school);
  }

  spellTimeLabel(times: SpellTime[]): string {
    return prepareSpellCastingTimes(times).map(castingTimeText).filter(Boolean).join(' or ');
  }

  spellRangeLabel(range: SpellRange | null): string {
    if (!range) return '—';
    if (range.type === 'self' || range.type === 'touch') return range.type;
    if (range.distance?.type) {
      const amount = range.distance.amount ?? '';
      return `${amount} ${range.distance.type}`.trim();
    }
    return range.type ?? '—';
  }

  spellComponentsLabel(components: SpellComponents | null): string {
    if (!components) return '—';
    return prepareSpellComponents(components).summaryText;
  }

  spellDurationLabel(durations: SpellDuration[]): string {
    return prepareSpellDurations(durations).map(duration => spellDurationText(duration)).filter(Boolean).join(' or ');
  }

  compactSpellDurationLabel(durations: SpellDuration[]): string {
    return prepareSpellDurations(durations).map(duration => spellDurationText(duration, false)).filter(Boolean).join(' or ');
  }

  // Character stat helpers
  isProficientInSavingThrow(character: CharacterData | null, abbr?: string) {
    const saves = character?.proficiencies?.savingThrows ?? [];
    if (!abbr) return false;
    return saves.includes((abbr || '').toUpperCase());
  }

  hasMiscBonusForSavingThrow(character: CharacterData | null, abbr?: string) {
    const misc = character?.proficiencies?.saveMiscBonuses ?? {};
    if (!abbr) return false;
    return typeof misc[abbr.toLowerCase()] === 'number';
  }

  savingThrowValue(character: CharacterData | null, abilityScore: string) {
    if (!abilityScore || !character) return 0;
    const abbr = this.abilityScoreToAbbreviation(abilityScore);
    const abilityScoreValue = this.abilityScoreValue(character, abilityScore);
    if (typeof abilityScoreValue !== 'number') return 0;
    const total =
      this.modifierNumber(abilityScoreValue) +
      (this.isProficientInSavingThrow(character, abbr) ? this.proficiencyBonus(character) : 0) +
      (this.hasMiscBonusForSavingThrow(character, abbr)
        ? (character?.proficiencies?.saveMiscBonuses?.[abbr.toLowerCase()] ?? 0)
        : 0);
    return total;
  }

  initiative(character: CharacterData | null) {
    if (character?.initiativeOverride != null) return character.initiativeOverride;
    const dex = character?.abilityScores?.dexterity;
    if (typeof dex !== 'number') return 0;
    const mod = this.modifierNumber(dex);
    const misc = character?.proficiencies?.initiative ? this.proficiencyBonus(character) : 0;
    return mod + misc;
  }

  passivePerception(character: CharacterData | null, skillList: any[]): number {
    if (!character) return 10;
    const wis = this.modifierNumber(character.abilityScores?.wisdom);
    const perceptionSkill = skillList.find((s) => s.name === 'Perception');
    const skillMod = perceptionSkill
      ? parseInt(perceptionSkill.value)
      : wis + this.proficiencyBonus(character);
    return 10 + skillMod;
  }

  getSkillAbility(skillName: string): string {
    const def = this.skillDefinitions.find((d) => d.name === skillName);
    return def ? this.abilityScoreToAbbreviation(def.ability).toUpperCase() : '';
  }

  modifier(score?: number) {
    if (typeof score !== 'number') return '';
    return this.formatSigned(this.modifierNumber(score));
  }

  proficiencyBonus(character: CharacterData | null) {
    const level = character?.level ?? 0;
    if (level >= 17) return 6;
    if (level >= 13) return 5;
    if (level >= 9) return 4;
    if (level >= 5) return 3;
    return 2;
  }

  modifierNumber(score?: number) {
    if (typeof score !== 'number') return 0;
    return Math.floor((score - 10) / 2);
  }

  formatSigned(value: number) {
    return value >= 0 ? `+${value}` : `${value}`;
  }

  abilityScoreValue(character: CharacterData | null, abbrevOrName?: string) {
    if (!abbrevOrName || !character) return undefined;
    const key = this.abilityScoreToAbbreviation(abbrevOrName);
    const scores = character?.abilityScores;
    if (!scores) return undefined;
    switch (key) {
      case 'str':
        return scores.strength;
      case 'dex':
        return scores.dexterity;
      case 'con':
        return scores.constitution;
      case 'int':
        return scores.intelligence;
      case 'wis':
        return scores.wisdom;
      case 'cha':
        return scores.charisma;
      default:
        return undefined;
    }
  }

  abilityScoreToAbbreviation(name: string) {
    const key = name.toLowerCase().slice(0, 3);
    return key;
  }

  skillProficiencyLevel(value: unknown) {
    if (typeof value === 'string') {
      const normalized = value.trim();
      if (normalized === 'EXPERTISE') return 'EXPERTISE' as const;
      if (normalized === 'PROFICIENT') return 'PROFICIENT' as const;
      if (normalized === 'HALF') return 'HALF' as const;
      return 'NONE' as const;
    }
    if (value === true || value === 1) return 'PROFICIENT' as const;
    if (value === 2) return 'EXPERTISE' as const;
    if (value === 0.5) return 'HALF' as const;
    return 'NONE' as const;
  }

  proficiencyBonusValue(character: CharacterData | null, level: 'EXPERTISE' | 'PROFICIENT' | 'HALF' | 'NONE') {
    const bonus = this.proficiencyBonus(character);
    if (level === 'EXPERTISE') return bonus * 2;
    if (level === 'PROFICIENT') return bonus;
    if (level === 'HALF') return Math.floor(bonus / 2);
    return 0;
  }

  getCustomSkillBonus(character: CharacterData | null, skillName: string): number | undefined {
    return character?.proficiencies?.skillMiscBonuses?.[(skillName.toUpperCase().replace(/\s+/g, '_'))] ?? 0;
  }

  proficiencyLabel(level: 'EXPERTISE' | 'PROFICIENT' | 'HALF' | 'NONE') {
    if (level === 'EXPERTISE') return 'EXP.';
    if (level === 'PROFICIENT') return 'PROF.';
    if (level === 'HALF') return 'HALF';
    if (level === 'NONE') return 'NONE';
    return '';
  }

  // AC calculation
  private parseBonusValue(bonusStr: string | null | undefined): number {
    if (!bonusStr) return 0;
    // Extract number from strings like "+2" or "2"
    const match = bonusStr.match(/(\+?-?\d+)/);
    return match ? parseInt(match[1], 10) : 0;
  }

  calculateArmorClass(character: CharacterData | null, allItems: InventoryItem[]): { ac: number; source: string } {
    if (!character) {
      return { ac: 10, source: 'No character data' };
    }

    // Only consider equipped items
    const equippedItems = allItems.filter((item) => item.isEquipped);

    const dexMod = this.modifierNumber(character.abilityScores?.dexterity);

    let bestArmorAC = 10 + dexMod; // fallback
    let bestArmorSource = 'Dexterity Only';
    let bestShieldAC = 0;
    let bestShieldSource = 'No Shield';

    // Extract armor type from item type string (e.g., "LA|plate armor" → "LA")
    const getArmorType = (typeStr: string | null | undefined): string | null => {
      if (!typeStr) return null;
      return typeStr.includes('|') ? typeStr.split('|')[0] : typeStr;
    };

    // Split items by category
    const armorItems = equippedItems.filter((item) => {
      const type = getArmorType(item.entity?.item?.type);
      return ['LA', 'MA', 'HA'].includes(type ?? '');
    });

    const shieldItems = equippedItems.filter((item) => {
      const type = getArmorType(item.entity?.item?.type);
      return type === 'S';
    });

    const miscItems = equippedItems.filter(
      (item) =>
        !armorItems.includes(item) &&
        !shieldItems.includes(item) &&
        item.entity?.item?.bonusAc
    );

    // Calculate best armor AC
    if (armorItems.length > 0) {
      for (const armor of armorItems) {
        const baseAC = armor.entity?.item?.ac;
        if (baseAC === null || baseAC === undefined) continue;

        const bonus = this.parseBonusValue(armor.entity?.item?.bonusAc);
        const armorType = getArmorType(armor.entity?.item?.type);

        let totalAC = baseAC;
        if (armorType?.startsWith('LA')) {
          totalAC = baseAC + dexMod + bonus;
        } else if (armorType?.startsWith('MA')) {
          totalAC = baseAC + Math.min(2, dexMod) + bonus;
        } else if (armorType?.startsWith('HA')) {
          totalAC = baseAC + bonus; // no dex
        }

        if (totalAC > bestArmorAC) {
          bestArmorAC = totalAC;
          bestArmorSource = armor.name;
        }
      }
    }

    // Check unarmored defense
    if (character.unarmoredDefense) {
      // Android serializes the selected ability as an enum string. Older web data can be an object.
      const abilityName = typeof character.unarmoredDefense === 'string'
        ? character.unarmoredDefense.toLowerCase()
        : Object.keys(character.unarmoredDefense).find(key =>
            ['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma'].includes(key));
      const defenseMod = this.modifierNumber(
        this.abilityScoreValue(character, abilityName)
      );
      const unarmoredAC = 10 + dexMod + defenseMod;
      if (unarmoredAC > bestArmorAC) {
        bestArmorAC = unarmoredAC;
        bestArmorSource = abilityName
          ? `Unarmored Defense (${abilityName})`
          : 'Unarmored Defense';
      }
    }

    // Calculate shield AC
    if (shieldItems.length > 0) {
      for (const shield of shieldItems) {
        const baseAC = shield.entity?.item?.ac ?? 0;
        const bonus = this.parseBonusValue(shield.entity?.item?.bonusAc);
        const totalAC = baseAC + bonus;

        if (totalAC > bestShieldAC) {
          bestShieldAC = totalAC;
          bestShieldSource = shield.name;
        }
      }
    }

    // Add misc bonuses
    let miscBonus = 0;
    const miscSources: string[] = [];
    for (const item of miscItems) {
      const bonus = this.parseBonusValue(item.entity?.item?.bonusAc);
      miscBonus += bonus;
      miscSources.push(item.name);
    }

    const totalAC = bestArmorAC + bestShieldAC + miscBonus;
    const sourceParts = [bestArmorSource, bestShieldSource, ...miscSources].filter(
      (s) => s && s !== 'No Shield'
    );
    const source = sourceParts.join(' + ');

    return { ac: totalAC, source };
  }

}
