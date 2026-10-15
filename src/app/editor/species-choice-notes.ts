import { FeatureNotes, Species } from '../models/character.model';
import { capitalizeFirst } from '../text';
import type { WizardChoice } from './class-wizard-preview';
import { isCompleteSelection } from '../rules/spell-choice';
import { wizardFingerprint } from './wizard-fingerprint';

/** Refresh only our unedited summary. User notes, including other “Choices” groups, are preserved. */
export function updateSpeciesChoiceNotes(species: Species, choices: WizardChoice[], answers: Record<string, string[]>): void {
  const lines = choices.flatMap(choice => {
    const answer = answers[choice.id] ?? [];
    if (!isCompleteSelection(answer, choice.count, choice.candidates.map(candidate => candidate.value))) return [];
    const label = capitalizeFirst(choice.label.slice(choice.label.indexOf(':') + 1).trim());
    return [`${label}: ${answer.map(value => capitalizeFirst(choice.candidates.find(candidate => candidate.value === value)!.label)).join(', ')}`];
  });
  const notes = species.notes ?? [];
  const index = notes.findIndex(group => group.wizardChoiceHash !== undefined);
  if (index >= 0) {
    const group = notes[index];
    if (group.tag !== 'Choices' || wizardFingerprint(group.notes) !== group.wizardChoiceHash) return;
  }
  if (!lines.length) {
    if (index >= 0) notes.splice(index, 1);
    return;
  }
  const group: FeatureNotes = { tag: 'Choices', notes: lines, isEditable: false, wizardChoiceHash: wizardFingerprint(lines) };
  if (index >= 0) notes[index] = group;
  else (species.notes ??= []).push(group);
}
