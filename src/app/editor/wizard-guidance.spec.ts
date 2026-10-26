import { emptyBasicCharacter } from './basic-info';
import { wizardFollowUps } from './wizard-guidance';

describe('Wizard setup suggestions', () => {
  it('describes observable omissions without treating default scores or a missing subclass as invalid', () => {
    const sheet = emptyBasicCharacter();
    const before = structuredClone(sheet);
    const suggestions = wizardFollowUps(sheet);
    expect(suggestions.map(item => item.id)).toEqual(['name', 'classes', 'species', 'background', 'hp', 'equipment']);
    expect(suggestions.some(item => item.id === 'abilities' || item.id === 'subclass' || item.id === 'spells')).toBe(false);
    expect(sheet).toEqual(before);
  });

  it('checks actual draft values, supports manual identity, and offers spells only for casting characters', () => {
    const sheet = emptyBasicCharacter();
    sheet.character!.name = 'Manual Hero'; sheet.character!.maxHp = 30;
    sheet.classes = [{ name: 'Custom Class', custom: true, level: 3 }];
    sheet.species = { name: 'Custom Species' }; sheet.background = { name: 'Custom Background' };
    sheet.inventory = [{ name: 'Rope', count: 1 }];
    expect(wizardFollowUps(sheet)).toEqual([]);
    delete sheet.character!.abilityScores!.wisdom;
    sheet.character!.featureSources = [{ name: 'Mage', isSpellcastingSource: true }];
    sheet.spells = [{ name: 'Shield', listType: 'KNOWN' }];
    expect(wizardFollowUps(sheet).map(item => [item.id, item.page])).toEqual([['abilities', 'Ability Scores'], ['spells', 'Spells']]);
    sheet.spells.push({ name: 'Shield', listType: 'PREPARED' });
    expect(wizardFollowUps(sheet).map(item => item.id)).toEqual(['abilities']);
  });
});
