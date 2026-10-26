import { ExportedCharacter } from '../models/character.model';
import { DEFENSE_ABILITIES } from './basic-info';
import { EditorPage } from './editor-pages';
import type { WizardChoice } from './class-wizard-preview';

export interface WizardFollowUp { id: string; label: string; detail: string; page: EditorPage; }

export const WIZARD_CHOICE_PAGES: Readonly<Record<NonNullable<WizardChoice['scope']>, EditorPage>> = {
  features: 'Species & Features', spells: 'Spells', species: 'Species & Features', proficiencies: 'Proficiencies & More',
};

/** Only describe observable omissions. These suggestions never block applying a draft. */
export function wizardFollowUps(sheet: ExportedCharacter): WizardFollowUp[] {
  const result: WizardFollowUp[] = [];
  const add = (id: string, label: string, detail: string, page: EditorPage) => result.push({ id, label, detail, page });
  if (!sheet.character?.name?.trim()) add('name', 'Character Name', 'No name is entered yet.', 'Basic Info');
  if (!sheet.classes?.some(entry => entry.name.trim())) add('classes', 'Class', 'No displayed class is selected. You can also add a custom class manually.', 'Basic Info');
  if (!sheet.species?.name?.trim()) add('species', 'Species', 'No species is selected. Add one if your character uses one.', 'Species & Features');
  if (!sheet.background?.name?.trim()) add('background', 'Background', 'No background is selected. You can also enter a custom background.', 'Basic Info');
  if (!(Number(sheet.character?.maxHp) > 0)) add('hp', 'Maximum HP', 'Maximum HP is currently zero or unset.', 'Basic Info');
  if (DEFENSE_ABILITIES.some(ability => sheet.character?.abilityScores?.[ability.key] == null)) {
    add('abilities', 'Ability Scores', 'Some ability scores are missing. The wizard uses your existing scores and does not assign bonuses.', 'Ability Scores');
  }
  if (!sheet.inventory?.length) add('equipment', 'Equipment', 'No equipment is listed. Starting equipment is added manually.', 'Items');
  const casting = sheet.character?.featureSources?.some(source => source.isSpellcastingSource);
  if (casting && !sheet.spells?.some(spell => spell.listType === 'PREPARED')) {
    add('spells', 'Ready Spells', 'No spells are in Prepared. A prefilled spell list contains choices, not a prepared selection.', 'Spells');
  }
  return result;
}

/** Always available handoffs for work that the wizard deliberately leaves to the editor. */
export const WIZARD_MANUAL_AREAS: readonly WizardFollowUp[] = [
  { id: 'abilities', label: 'Ability Scores', detail: 'Current scores drive HP and spell uses. Assign scores and bonuses here.', page: 'Ability Scores' },
  { id: 'features', label: 'Feats & Features', detail: 'Add feats and customize feature details here.', page: 'Species & Features' },
  { id: 'spells', label: 'Spells', detail: 'Choose ready spells in Prepared and edit spell details here.', page: 'Spells' },
  { id: 'items', label: 'Equipment', detail: 'Add starting equipment and other items here.', page: 'Items' },
];

