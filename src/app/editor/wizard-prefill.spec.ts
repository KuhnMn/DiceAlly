import { emptyBasicCharacter } from './basic-info';
import { mergeWizardPrefill, PrefillValue, WizardState } from './wizard-prefill';

const state = (): WizardState => ({ revisionId: 'test', classes: [], answers: {}, options: {}, baseline: [], protectedPaths: [] });
const hp: PrefillValue = { path: ['character', 'maxHp'], value: 20, scope: 'hp', label: 'Maximum HP' };

describe('Wizard manual edit override', () => {
  it('distinguishes existing values without wizard history from detected edits to generated values', () => {
    const imported = emptyBasicCharacter(); imported.character!.maxHp = 20;
    const existing = mergeWizardPrefill(imported, state(), [hp]);
    expect(existing.changes[0]).toMatchObject({ action: 'Keep', keepReason: 'existing' });
    expect(existing.sheet.character!.maxHp).toBe(20);
    const generated = mergeWizardPrefill(emptyBasicCharacter(), state(), [hp]).sheet;
    generated.character!.maxHp = 50;
    const edited = mergeWizardPrefill(generated, generated.creatorWizard!, [hp]);
    expect(edited.changes[0]).toMatchObject({ action: 'Keep', keepReason: 'edited' });
    expect(edited.sheet.character!.maxHp).toBe(50);
    expect(edited.sheet.creatorWizard!.baseline.every(entry => !('keepReason' in entry))).toBe(true);
  });

  it('preserves manual values by default and replaces protected edits only when enabled', () => {
    const original = emptyBasicCharacter(); original.character!.maxHp = 50;
    const kept = mergeWizardPrefill(original, state(), [hp]);
    expect(kept.sheet.character!.maxHp).toBe(50);
    expect(kept.changes[0].action).toBe('Keep');
    const overridden = mergeWizardPrefill(kept.sheet, kept.sheet.creatorWizard!, [hp], ['hp']);
    expect(overridden.sheet.character!.maxHp).toBe(20);
    expect(overridden.changes[0].action).toBe('Update');
    expect(overridden.sheet.creatorWizard!.protectedPaths).not.toContainEqual(hp.path);
    expect(original.character!.maxHp).toBe(50);
  });

  it('restores manually removed wizard entries and respects unselected sections', () => {
    const feature: PrefillValue = { path: ['features', 'generated'], value: { editorId: 'generated', name: 'Gift' }, scope: 'features', label: 'Gift' };
    const initial = mergeWizardPrefill(emptyBasicCharacter(), state(), [feature]).sheet;
    initial.features = [];
    const kept = mergeWizardPrefill(initial, initial.creatorWizard!, [feature]);
    expect(kept.changes[0].keepReason).toBe('removed');
    expect(kept.sheet.features).toEqual([]);
    expect(mergeWizardPrefill(kept.sheet, kept.sheet.creatorWizard!, [feature], ['features']).sheet.features).toHaveLength(1);
    const disabled = { ...kept.sheet.creatorWizard!, options: { features: false } };
    expect(mergeWizardPrefill(kept.sheet, disabled, [feature], ['features']).sheet.features).toEqual([]);
  });

  it('replaces a matching manually added feature without duplication and keeps annotations and combat links', () => {
    const original = emptyBasicCharacter();
    original.features = [{ editorId: 'manual', name: 'Gift', source: 'TEST', featureSourceName: 'Mage',
      notes: [{ tag: 'Notes', notes: ['Keep me'] }], uses: [{ totalFreeUses: 3, usedFreeUses: 2 }] }];
    original.combatActions = [{ name: 'Gift action', actionType: 'ACTION', linkedResourceType: 'CLASS_FEATURE', linkedResource: { editorId: 'manual', name: 'Gift' } }];
    const value: PrefillValue = { path: ['features', 'generated'], scope: 'features', label: 'Gift',
      value: { editorId: 'generated', name: 'Gift', source: 'TEST', featureSourceName: 'Mage', userAdded: false } };
    expect(mergeWizardPrefill(original, state(), [value]).changes[0]).toMatchObject({ action: 'Keep', keepReason: 'matching' });
    const overridden = mergeWizardPrefill(original, state(), [value], ['features']);
    expect(overridden.sheet.features).toHaveLength(1);
    expect(overridden.sheet.features![0]).toMatchObject({ editorId: 'generated', userAdded: false });
    expect(overridden.sheet.features![0].notes).toEqual(original.features[0].notes);
    expect(overridden.sheet.features![0].uses).toEqual(original.features[0].uses);
    expect(overridden.sheet.combatActions![0].linkedResource!.editorId).toBe('generated');
    expect(overridden.changes[0].action).toBe('Update');
  });

  it('replaces edited generated definitions without resetting slot usage', () => {
    const slots: PrefillValue = { path: ['slots', 'Mage', '1'], scope: 'spells', label: 'Level 1 slots', value: { level: 1, total: 4, used: 0 } };
    const original = mergeWizardPrefill(emptyBasicCharacter(), state(), [slots]).sheet;
    original.character!.spellSlots!['Mage'][0] = { level: 1, total: 10, used: 3 };
    const overridden = mergeWizardPrefill(original, original.creatorWizard!, [slots], ['spells']);
    expect(overridden.sheet.character!.spellSlots!['Mage'][0]).toEqual({ level: 1, total: 4, used: 3 });
  });

  it('overrides only the requested sections and keeps unrelated manual edits protected', () => {
    const sheet = emptyBasicCharacter();
    sheet.character!.maxHp = 50;
    sheet.character!.level = 8;
    const level: PrefillValue = { path: ['character', 'level'], value: 3, scope: 'level', label: 'Level' };
    const result = mergeWizardPrefill(sheet, state(), [hp, level], ['hp']);
    expect(result.sheet.character!.maxHp).toBe(20);
    expect(result.sheet.character!.level).toBe(8);
    expect(result.changes.map(change => change.action)).toEqual(['Update', 'Keep']);
  });
});
