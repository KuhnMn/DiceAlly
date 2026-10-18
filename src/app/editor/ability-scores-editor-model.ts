import { EditorPageModel } from './editor-page-model';
import { DEFENSE_ABILITIES } from './basic-info';
import { AbilityScores } from '../models/character.model';

/** Editing actions and transient form state for the ability scores page. */
export class AbilityScoresEditorModel extends EditorPageModel {
  readonly defenseAbilities = DEFENSE_ABILITIES;
  get abilityScores() { return this.character.abilityScores!; }
  abilityModifier(ability: keyof AbilityScores) {
    return this.helpers.formatSigned(this.helpers.modifierNumber(this.abilityScores[ability]));
  }
  adjustAbility(ability: keyof AbilityScores, change: number) {
    this.abilityScores[ability] = Math.max(0, (this.abilityScores[ability] ?? 10) + change);
    this.changed();
  }
}
