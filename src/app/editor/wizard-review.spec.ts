import { ExportedCharacter, SpellEntryFull } from '../models/character.model';
import { PrefillChange } from './wizard-prefill';
import { groupWizardReview } from './wizard-review';

function spell(editorId: string, listType = 'KNOWN', level = 0, castingSourceName = 'Arcane Trickster'): SpellEntryFull {
  return { editorId, name: editorId, listType, castingSourceName,
    entity: { name: editorId, level, source: 'TEST', school: 'C', time: [], range: { type: 'point' }, components: {}, duration: [], entries: [] } };
}
const change = (id: string, action: PrefillChange['action'] = 'Fill'): PrefillChange => ({ path: ['spells', id], label: id, action });

describe('Wizard review grouping', () => {
  it('separates stats from spells and groups Spelllist and Prepared spells independently', () => {
    const known = Array.from({ length: 20 }, (_, index) => spell(`cantrip-${index}`));
    const after: ExportedCharacter = { spells: [...known, spell('Mage Hand', 'PREPARED')] };
    const hp: PrefillChange = { path: ['character', 'maxHp'], label: 'Maximum HP', action: 'Update' };
    const changes = [...known.map(spell => change(spell.editorId!)), change('Mage Hand'), hp];
    const review = groupWizardReview(changes, {}, after);
    expect(review.map(section => section.label)).toEqual(['Character stats', 'Spells & Slots']);
    expect(review[0].groups[0].entries).toEqual([hp]);
    const groups = review[1].groups;
    expect(groups.find(group => group.label === 'Arcane Trickster · Spelllist · Cantrips')?.entries).toHaveLength(20);
    expect(groups.find(group => group.label === 'Arcane Trickster · Prepared · Cantrips')?.entries).toEqual([change('Mage Hand')]);
    expect(review[1].count).toBe(21);
  });

  it('separates source and level, retaining every action and protected edit in group summaries', () => {
    const removed = Array.from({ length: 4 }, (_, index) => spell(`removed-${index}`, 'KNOWN', 1));
    const added = Array.from({ length: 4 }, (_, index) => spell(`added-${index}`, 'KNOWN', 2, 'Bard'));
    const before: ExportedCharacter = { spells: removed };
    const after: ExportedCharacter = { spells: [...added, spell('Protected'), spell('Specific')] };
    const changes = [...removed.map(spell => change(spell.editorId!, 'Remove')), ...added.map(spell => change(spell.editorId!)),
      change('Protected', 'Keep'), change('Specific')];
    const review = groupWizardReview(changes, before, after);
    const groups = review[0].groups;
    const protectedGroup = groups.find(group => group.label === 'Arcane Trickster · Spelllist · Cantrips')!;
    expect(protectedGroup.entries).toEqual([change('Protected', 'Keep'), change('Specific')]);
    expect(protectedGroup.counts).toEqual([{ action: 'Fill', label: 'added', count: 1 }, { action: 'Keep', label: 'kept', count: 1 }]);
    expect(groups.find(group => group.label.includes('Level 1'))?.counts).toEqual([{ action: 'Remove', label: 'removed', count: 4 }]);
    expect(groups.find(group => group.label.includes('Bard'))?.entries).toHaveLength(4);
    expect(groups.flatMap(group => group.entries)).toHaveLength(changes.length);
  });

  it('groups features by source and type and uses the old source for removed features', () => {
    const before: ExportedCharacter = { features: [
      { editorId: 'removed', name: 'Old gift', featureSourceName: 'Elf' },
      { editorId: 'renamed', name: 'Spellcasting', featureSourceName: 'Old Wizard' },
    ] };
    const after: ExportedCharacter = { features: [
      { editorId: 'renamed', name: 'Spellcasting', featureSourceName: 'Wizard' },
      { editorId: 'scholar', name: 'Scholar', featureSourceName: 'Wizard' },
      { editorId: 'feat', name: 'Lucky', featureSourceName: 'Wizard', featureType: 'FEAT' },
    ] };
    const changes: PrefillChange[] = [
      { path: ['features', 'removed'], label: 'Old gift', action: 'Remove' },
      { path: ['features', 'renamed'], label: 'Spellcasting', action: 'Update' },
      { path: ['features', 'scholar'], label: 'Scholar', action: 'Keep' },
      { path: ['features', 'feat'], label: 'Lucky', action: 'Fill' },
    ];
    const review = groupWizardReview(changes, before, after);
    expect(review[0].label).toBe('Features');
    expect(review[0].count).toBe(4);
    expect(review[0].groups.map(group => group.label)).toEqual(['Elf · Class Features', 'Wizard · Class Features', 'Wizard · Feats']);
    expect(review[0].groups[1].entries).toEqual(changes.slice(1, 3));
  });

  it('groups slots by casting source and keeps proficiency and species changes in their own sections', () => {
    const changes: PrefillChange[] = [
      { path: ['slots', 'Wizard', '1'], label: 'Level 1 slots', action: 'Update' },
      { path: ['slots', 'Wizard', '2'], label: 'Level 2 slots', action: 'Fill' },
      { path: ['languages', 'Elvish'], label: 'Elvish', action: 'Fill' },
      { path: ['character', 'proficiencies', 'skills', 'ARCANA'], label: 'Arcana', action: 'Keep' },
      { path: ['character', 'senses', 'Darkvision'], label: 'Darkvision', action: 'Update' },
    ];
    const review = groupWizardReview(changes, {}, {});
    expect(review.map(section => section.label)).toEqual(['Species & Movement', 'Proficiencies', 'Spells & Slots']);
    expect(review.at(-1)!.groups[0].entries).toEqual(changes.slice(0, 2));
    expect(groupWizardReview([], {}, {})).toEqual([]);
  });
});
