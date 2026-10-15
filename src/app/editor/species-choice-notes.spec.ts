import { Species } from '../models/character.model';
import { updateSpeciesChoiceNotes } from './species-choice-notes';

describe('Species choice notes', () => {
  const choices = [
    { id: 'language', label: 'Elf: language proficiencies', count: 1, candidates: [{ value: 'elvish', label: 'Elvish' }] },
    { id: 'ability', label: 'Elf: casting ability', count: 1, candidates: [{ value: 'wis', label: 'Wisdom' }] },
    { id: 'spell', label: 'Elf: spells', count: 1, candidates: [{ value: 'spell-key', label: 'Light (PHB)' }] },
  ];
  it('records readable choices, skips incomplete answers, and preserves user groups', () => {
    const species: Species = { notes: [{ tag: 'Choices', notes: ['My own notes'], isEditable: true }] };
    updateSpeciesChoiceNotes(species, choices, { language: ['elvish'], ability: ['wis'], spell: ['spell-key'] });
    expect(species.notes![1].notes).toEqual(['Language proficiencies: Elvish', 'Casting ability: Wisdom', 'Spells: Light (PHB)']);
    updateSpeciesChoiceNotes(species, choices, {});
    expect(species.notes).toEqual([{ tag: 'Choices', notes: ['My own notes'], isEditable: true }]);
  });
  it('does not overwrite manually edited generated notes', () => {
    const species: Species = {};
    updateSpeciesChoiceNotes(species, choices, { language: ['elvish'] });
    species.notes![0].notes.push('A personal explanation');
    updateSpeciesChoiceNotes(species, choices, { ability: ['wis'] });
    expect(species.notes![0].notes).toEqual(['Language proficiencies: Elvish', 'A personal explanation']);
  });
});
