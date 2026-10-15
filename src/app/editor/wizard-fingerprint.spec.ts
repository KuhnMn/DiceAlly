import { readWizardBookkeeping } from './wizard-bookkeeping';
import { emptyBasicCharacter } from './basic-info';
import { PrefillValue, WizardState, mergeWizardPrefill } from './wizard-prefill';
import { wizardFingerprint } from './wizard-fingerprint';
import { normalizeCharacterEditorIdentity } from './editor-identity';

function state(): WizardState {
  return { revisionId: 'test', classes: [], answers: {}, options: {}, baseline: [], protectedPaths: [] };
}
const hp = (value: number): PrefillValue => ({ path: ['character', 'maxHp'], scope: 'hp', label: 'Maximum HP', value });

describe('Compact wizard baselines', () => {
  it('exports fingerprints rather than generated snapshots and updates untouched values', () => {
    const first = mergeWizardPrefill(emptyBasicCharacter(), state(), [hp(20)]).sheet;
    expect(first.creatorWizard!.baseline[0]).not.toHaveProperty('value');
    expect(first.creatorWizard!.baseline[0].fingerprint).toBe(wizardFingerprint(20));
    const next = mergeWizardPrefill(first, first.creatorWizard!, [hp(30)]).sheet;
    expect(next.character!.maxHp).toBe(30);
  });

  it('protects manual edits and removals while allowing untouched obsolete values to reset', () => {
    const first = mergeWizardPrefill(emptyBasicCharacter(), state(), [hp(20)]).sheet;
    const untouched = mergeWizardPrefill(first, first.creatorWizard!, []).sheet;
    expect(untouched.character!.maxHp).toBe(0);
    first.character!.maxHp = 25;
    const edited = mergeWizardPrefill(first, first.creatorWizard!, [hp(30)]).sheet;
    expect(edited.character!.maxHp).toBe(25);
    expect(edited.creatorWizard!.protectedPaths).toContainEqual(['character', 'maxHp']);
    const feature: PrefillValue = { path: ['features', 'test-feature'], scope: 'features', label: 'Gift',
      value: { editorId: 'test-feature', name: 'Gift', notes: [], uses: [] } };
    const generated = mergeWizardPrefill(emptyBasicCharacter(), state(), [feature]).sheet;
    generated.features = [];
    expect(mergeWizardPrefill(generated, generated.creatorWizard!, [feature]).sheet.features).toEqual([]);
  });

  it('preserves feature notes and trackers without mistaking them for definition edits', () => {
    const feature: PrefillValue = { path: ['features', 'test-feature'], scope: 'features', label: 'Gift',
      value: { editorId: 'test-feature', name: 'Gift', source: 'TEST', notes: [], uses: [] } };
    const first = mergeWizardPrefill(emptyBasicCharacter(), state(), [feature]).sheet;
    first.features![0].notes = [{ tag: 'Notes', notes: ['Keep'], isEditable: true }];
    first.features![0].uses = [{ tag: 'Uses', totalFreeUses: 3, usedFreeUses: 2 }];
    const nextValue = { ...feature, value: { ...feature.value as object, name: 'Updated Gift' } };
    const next = mergeWizardPrefill(first, first.creatorWizard!, [nextValue]).sheet;
    expect(next.features![0].name).toBe('Updated Gift');
    expect(next.features![0].notes).toEqual(first.features![0].notes);
    expect(next.features![0].uses).toEqual(first.features![0].uses);
    const obsolete = mergeWizardPrefill(next, next.creatorWizard!, []).sheet;
    expect(obsolete.features).toHaveLength(1);
  });

  it('accepts RAW characters but rejects retired full-value history instead of converting it', () => {
    const raw = emptyBasicCharacter();
    expect(normalizeCharacterEditorIdentity(raw).creatorWizard).toBeUndefined();
    Object.assign(raw, { creatorWizard: { ...state(), baseline: [hp(20)] } });
    expect(() => readWizardBookkeeping(raw.creatorWizard!)).toThrow('Unsupported wizard history');
    expect(normalizeCharacterEditorIdentity(raw).character).toEqual(raw.character);
  });

  it('ignores session counters but detects changes to tracker configuration and numeric values', () => {
    expect(wizardFingerprint({ total: 4, used: 1 })).toBe(wizardFingerprint({ used: 3, total: 4 }));
    expect(wizardFingerprint({ total: 5 })).not.toBe(wizardFingerprint({ total: 4 }));
    expect(wizardFingerprint(undefined)).not.toBe(wizardFingerprint('undefined'));
  });
});
