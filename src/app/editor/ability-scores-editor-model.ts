import { EditorPageModel } from './editor-page-model';
import { DEFENSE_ABILITIES } from './basic-info';
import { AbilityScores } from '../models/character.model';
import { calculateAbilityBonuses, setAbilityBonusesEnabled } from '../models/ability-score-bonuses';

/** Editing actions and transient form state for the ability scores page. */
export class AbilityScoresEditorModel extends EditorPageModel {
  readonly defenseAbilities = DEFENSE_ABILITIES;
  get automatic() { return !!this.sheet.abilityBonuses?.enabled; }
  get abilityScores() { return this.automatic ? this.sheet.abilityBonuses!.base : this.character.abilityScores!; }
  get bonusSources() { return this.bonusResult.sources.map(result => result.source); }
  get bonusResult() { return calculateAbilityBonuses(this.sheet); }
  setAutomatic(enabled: boolean) { setAbilityBonusesEnabled(this.sheet, enabled); this.changed(); }
  abilityModifier(ability: keyof AbilityScores) {
    return this.helpers.formatSigned(this.helpers.modifierNumber(this.character.abilityScores?.[ability]));
  }
  adjustAbility(ability: keyof AbilityScores, change: number) {
    this.abilityScores[ability] = Math.max(0, (this.abilityScores[ability] ?? 10) + change);
    this.changed();
  }
}
