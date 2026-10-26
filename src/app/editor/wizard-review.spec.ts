import { ExportedCharacter, SpellEntryFull } from '../models/character.model';
import { PrefillChange } from './wizard-prefill';
import { groupWizardReview, REVIEW_ACTION_LABELS, wizardReviewValues } from './wizard-review';

function spell(editorId: string, listType = 'KNOWN', level = 0, castingSourceName = 'Arcane Trickster'): SpellEntryFull {
  return { editorId, name: editorId, listType, castingSourceName,
    entity: { name: editorId, level, source: 'TEST', school: 'C', time: [], range: { type: 'point' }, components: {}, duration: [], entries: [] } };
}
const change = (id: string, action: PrefillChange['action'] = 'Fill'): PrefillChange => ({ path: ['spells', id], label: id, action });

describe('Wizard review grouping', () => {
  it('includes displayed class and background changes in the identity review', () => {
    const changes: PrefillChange[] = [
      { path: ['classes'], label: 'Classes', action: 'Update' },
      { path: ['background'], label: 'Background', action: 'Remove' },
    ];
    const before: ExportedCharacter = { classes: [{ name: 'Mage', level: 1 }], background: { name: 'Sage' } };
    const after: ExportedCharacter = { classes: [{ name: 'Mage', level: 2 }] };
    const review = groupWizardReview(changes, before, after);
    expect(review[0].label).toBe('Character identity');
    expect(review[0].count).toBe(2);
    expect(wizardReviewValues(changes[0], before, after, [])).toEqual({ before: 'Mage · Level 1', after: 'Mage · Level 2' });
    expect(wizardReviewValues(changes[1], before, after, [])).toEqual({ before: 'Sage', after: 'Not Set' });
  });

  it('distinguishes a retained manual value from the wizard suggestion and preserves removed entries', () => {
    const hp: PrefillChange = { path: ['character', 'maxHp'], label: 'Maximum HP', action: 'Keep' };
    const sheet: ExportedCharacter = { character: { maxHp: 50 } };
    const values = wizardReviewValues(hp, sheet, sheet, [{ ...hp, scope: 'hp', value: 28 }]);
    expect(values).toMatchObject({ before: '50', after: '50', suggested: '28' });
    const removed = wizardReviewValues({ ...change('Gift', 'Keep'), keepReason: 'removed' }, {}, {}, [{ path: ['spells', 'Gift'], scope: 'spells', label: 'Gift', value: { name: 'Gift' } }]);
    expect(removed).toMatchObject({ before: 'Not Set', after: 'Not Set', suggested: 'Gift' });
    expect(removed.detail).toContain('stays removed');
  });

  it('shows existing manual duplicates as kept entries rather than describing them as removed', () => {
    const manual = { editorId: 'manual', name: 'Gift', source: 'PHB', featureSourceName: 'Mage' };
    const sheet: ExportedCharacter = { features: [manual] };
    const values = wizardReviewValues({ path: ['features', 'wizard'], label: 'Gift', action: 'Keep' }, sheet, sheet,
      [{ path: ['features', 'wizard'], scope: 'features', label: 'Gift', value: { ...manual, editorId: 'wizard' } }]);
    expect(values.before).toBe('Gift · PHB'); expect(values.after).toBe(values.before);
    expect(values.detail).not.toContain('removal');
  });

  it('describes what applying will do instead of showing wizard bookkeeping as a reason', () => {
    expect(REVIEW_ACTION_LABELS.Keep).toBe('Keep Existing');
    const hp: PrefillChange = { path: ['character', 'maxHp'], label: 'Maximum HP', action: 'Keep' };
    const sheet: ExportedCharacter = { character: { maxHp: 50 } };
    expect(wizardReviewValues({ ...hp, keepReason: 'existing' }, sheet, sheet, []).detail).toBe('Already on your character. Applying this setup will not change it.');
    expect(wizardReviewValues({ ...hp, keepReason: 'edited' }, sheet, sheet, [{ path: hp.path, scope: 'hp', label: 'HP', value: 28 }]).detail).toContain('will not be applied');
    expect(wizardReviewValues({ ...hp, keepReason: 'annotations' }, sheet, sheet, []).detail).toContain('notes or recorded uses');
  });

  it('does not repeat identical spell names or expose past protection flags as a warning', () => {
    const current = { editorId: 'spell', name: 'Acid Splash', source: 'XPHB', listType: 'KNOWN' };
    const sheet: ExportedCharacter = { spells: [current] };
    const result = wizardReviewValues({ path: ['spells', 'spell'], label: 'Acid Splash', action: 'Keep', keepReason: 'protected' }, sheet, sheet,
      [{ path: ['spells', 'spell'], scope: 'spells', label: 'Acid Splash', value: { ...current, userAdded: false } }]);
    expect(result.suggested).toBeUndefined(); expect(result.differences).toBeUndefined();
    expect(result.detail).toBe('Already on your character. Applying this setup will not change it.');
  });

  it('shows the source settings that actually differ and normalizes equivalent ability storage', () => {
    const source = { editorId: 'source', name: 'Artificer (EFA)', isGeneralFeatureSource: false, isSpellcastingSource: true, usesIntelligence: true, customDc: 18 };
    const sheet: ExportedCharacter = { character: { featureSources: [source] } };
    const result = wizardReviewValues({ path: ['sources', 'source'], label: 'Artificer Source', action: 'Keep', keepReason: 'edited' }, sheet, sheet,
      [{ path: ['sources', 'source'], scope: 'sources', label: 'Artificer Source', value: { ...source, customDc: null, useSpellbook: true,
        associatedAbilities: { features: [], spellcasting: ['intelligence'] } } }]);
    expect(result.suggested).toBeUndefined();
    expect(result.differences).toEqual([
      { label: 'Spellbook', current: 'No', suggested: 'Yes' },
      { label: 'Custom Save DC', current: '18', suggested: 'Calculated' },
    ]);
    expect(result.detail).toContain('will not be applied');
  });

  it('summarizes slot and hit-dice totals without resetting or interpreting used counters', () => {
    const before: ExportedCharacter = { character: { spellSlots: { Mage: [{ level: 1, total: 2, used: 1 }] } } };
    const after: ExportedCharacter = { character: { spellSlots: { Mage: [{ level: 1, total: 3, used: 1 }] } } };
    const value = wizardReviewValues({ path: ['slots', 'Mage', '1'], label: 'Slots', action: 'Update' }, before, after, []);
    expect(value).toEqual({ before: '2 Slots', after: '3 Slots' });
    expect(after.character!.spellSlots!['Mage'][0].used).toBe(1);
  });

  it('retains every contributing source when different grants target the same proficiency', () => {
    const change: PrefillChange = { path: ['character', 'proficiencies', 'skills', 'ARCANA'], label: 'Arcana', action: 'Fill' };
    const value = { path: change.path, scope: 'proficiencies', label: 'Arcana', value: 'PROFICIENT' };
    const after: ExportedCharacter = { character: { proficiencies: { skills: { ARCANA: 'PROFICIENT' } } } };
    expect(wizardReviewValues(change, {}, after, [{ ...value, origin: 'Mage (XPHB)' }, { ...value, origin: 'Sage (XPHB)' }])).toMatchObject({
      before: 'Not Set', after: 'Proficient', origin: 'Mage (XPHB), Sage (XPHB)',
    });
  });

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
