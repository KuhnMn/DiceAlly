import { EditorPageModel } from './editor-page-model';
import { DEFENSE_ABILITIES } from './basic-info';

/** Editing actions and transient form state for the proficiencies page. */
export class ProficienciesEditorModel extends EditorPageModel {
  readonly savingThrows = DEFENSE_ABILITIES.map(ability => ({ ...ability, abbreviation: ability.key.slice(0, 3) }));
  readonly skills = this.helpers.skillDefinitions.map(skill => ({ ...skill, key: skill.name.toUpperCase().replace(/\s+/g, '_') }));
  readonly proficiencyLevels = [
    { value: 'NONE', label: 'None' }, { value: 'HALF', label: 'Half' },
    { value: 'PROFICIENT', label: 'Full' }, { value: 'EXPERTISE', label: 'Expertise' },
  ] as const;
  skillLevel(key: string) { return this.helpers.skillProficiencyLevel(this.character.proficiencies?.skills?.[key]); }
  cycleSkillLevel(key: string) {
    const position = this.proficiencyLevels.findIndex(level => level.value === this.skillLevel(key));
    this.setSkillLevel(key, this.proficiencyLevels[(position + 1) % this.proficiencyLevels.length].value);
  }
  skillBonus(key: string) { return this.character.proficiencies?.skillMiscBonuses?.[key] ?? 0; }
  setSkillLevel(key: string, level: string) {
    const proficiencies = this.character.proficiencies ??= {};
    (proficiencies.skills ??= {})[key] = level; this.changed();
  }
  setSkillBonus(key: string, bonus: number | null) {
    this.setMiscBonus('skillMiscBonuses', key, bonus);
  }
  skillTotal(key: string, ability: string) {
    const modifier = this.helpers.modifierNumber(this.helpers.abilityScoreValue(this.character, ability));
    const proficiency = this.helpers.proficiencyBonusValue(this.character, this.skillLevel(key));
    return this.helpers.formatSigned(modifier + proficiency + this.skillBonus(key));
  }
  saveProficient(ability: string) { return this.helpers.isProficientInSavingThrow(this.character, ability); }
  toggleSaveProficiency(ability: string) {
    const proficiencies = this.character.proficiencies ??= {};
    const key = ability.toUpperCase();
    const saves = proficiencies.savingThrows ??= [];
    if (saves.includes(key)) proficiencies.savingThrows = saves.filter(save => save !== key);
    else saves.push(key);
    this.changed();
  }
  saveBonus(ability: string) { return this.character.proficiencies?.saveMiscBonuses?.[ability] ?? 0; }
  setSaveBonus(ability: string, bonus: number | null) {
    this.setMiscBonus('saveMiscBonuses', ability, bonus);
  }
  private setMiscBonus(field: 'skillMiscBonuses' | 'saveMiscBonuses', key: string, bonus: number | null) {
    const proficiencies = this.character.proficiencies ??= {};
    const bonuses = proficiencies[field] ??= {};
    if (bonus === null || bonus === 0) delete bonuses[key];
    else bonuses[key] = bonus;
    this.changed();
  }
  setAutomaticSaveBonuses(enabled: boolean) {
    this.character.calculateSavingThrowBonuses = enabled;
    this.changed();
  }
  saveCalculation(ability: string) { return this.helpers.savingThrowCalculation(this.character, ability, this.sheet.inventory ?? []); }
  saveTotal(ability: string) { return this.helpers.formatSigned(this.saveCalculation(ability).value); }
}
