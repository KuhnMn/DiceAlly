import { ExportedCharacter, SpellEntryFull } from '../models/character.model';
import { PrefillChange } from './wizard-prefill';
import { groupWizardReview } from './wizard-review';

function spell(editorId: string, listType = 'KNOWN', level = 0, castingSourceName = 'Arcane Trickster'): SpellEntryFull {
  return { editorId, name: editorId, listType, castingSourceName,
    entity: { name: editorId, level, source: 'TEST', school: 'C', time: [], range: { type: 'point' }, components: {}, duration: [], entries: [] } };
}
const change = (id: string, action: PrefillChange['action'] = 'Fill'): PrefillChange => ({ path: ['spells', id], label: id, action });

describe('Wizard review grouping', () => {
  it('collapses bulk Known entries while keeping specific Prepared spells and other changes above them', () => {
    const known = Array.from({ length: 20 }, (_, index) => spell(`cantrip-${index}`));
    const after: ExportedCharacter = { spells: [...known, spell('Mage Hand', 'PREPARED')] };
    const hp: PrefillChange = { path: ['character', 'maxHp'], label: 'Maximum HP', action: 'Update' };
    const changes = [...known.map(spell => change(spell.editorId!)), change('Mage Hand'), hp];
    const review = groupWizardReview(changes, {}, after);
    expect(review).toHaveLength(3);
    expect(review[0]).toEqual(change('Mage Hand'));
    expect(review[1]).toEqual(hp);
    expect(review[2].label).toBe('Arcane Trickster · Known Cantrips (20)');
    expect(review[2].entries).toHaveLength(20);
  });

  it('separates source, level and action, retaining protected edits and small spell changes as individual rows', () => {
    const removed = Array.from({ length: 4 }, (_, index) => spell(`removed-${index}`, 'KNOWN', 1));
    const added = Array.from({ length: 4 }, (_, index) => spell(`added-${index}`, 'KNOWN', 2, 'Bard'));
    const before: ExportedCharacter = { spells: removed };
    const after: ExportedCharacter = { spells: [...added, spell('Protected'), spell('Specific')] };
    const changes = [...removed.map(spell => change(spell.editorId!, 'Remove')), ...added.map(spell => change(spell.editorId!)),
      change('Protected', 'Keep'), change('Specific')];
    const review = groupWizardReview(changes, before, after);
    expect(review.slice(0, 2)).toEqual([change('Protected', 'Keep'), change('Specific')]);
    expect(review[2].action).toBe('Remove'); expect(review[2].label).toContain('Level 1');
    expect(review[3].action).toBe('Fill'); expect(review[3].label).toContain('Bard');
    expect(review.reduce((count, item) => count + (item.entries?.length ?? 1), 0)).toBe(changes.length);
  });
});
