import { normalizeCharacterEditorIdentity, wizardEditorId } from './editor-identity';
import { emptyBasicCharacter } from './basic-info';
import { copySpellToList } from './spell-selection';

describe('Editor instance identity', () => {
  it('copies a spell with a new instance identity while preserving detached provenance and trackers', () => {
    const spell = { editorId: crypto.randomUUID(), name: 'Shield', listType: 'KNOWN',
      contentReference: { key: 'spell', sourceIdentity: 'library', revisionId: 'revision', commit: 'commit' },
      notes: [{ tag: 'Notes', notes: ['Keep this'], isEditable: true }] };
    const copy = copySpellToList(spell, 'PREPARED');
    expect(copy.editorId).not.toBe(spell.editorId);
    expect(copy.contentReference).toEqual(spell.contentReference);
    expect(copy.listType).toBe('PREPARED');
    copy.notes![0].notes![0] = 'Edited';
    expect(spell.notes[0].notes[0]).toBe('Keep this');
  });
  it('uses one compact format with stable, scoped wizard identities', () => {
    const id = wizardEditorId('source', 'library', 'selection', 'class');
    expect(id).toMatch(/^hash:[a-f\d]{8}-[a-f\d]{4}-8[a-f\d]{3}-[89ab][a-f\d]{3}-[a-f\d]{12}$/);
    expect(wizardEditorId('source', 'library', 'selection', 'class')).toBe(id);
    expect(wizardEditorId('species-source', 'library', 'class')).not.toBe(id);
    expect(wizardEditorId('spell', 'library', 'source', 'spell', 'KNOWN')).not.toBe(wizardEditorId('spell', 'library', 'source', 'spell', 'PREPARED'));
  });

  it('initializes RAW entries without mutating them or rewriting existing current identities', () => {
    const sheet = emptyBasicCharacter();
    const existingId = crypto.randomUUID();
    sheet.character!.featureSources = [{ name: 'Wizard' }];
    sheet.features = [{ name: 'Imported Feature' }, { name: 'Existing Feature', editorId: existingId }];
    sheet.spells = [{ name: 'Imported Spell', listType: 'KNOWN' }];
    const normalized = normalizeCharacterEditorIdentity(sheet);
    expect(normalized.character!.featureSources![0].editorId).toMatch(/^hash:/);
    expect(normalized.features![0].editorId).toMatch(/^hash:/);
    expect(normalized.spells![0].editorId).toMatch(/^hash:/);
    expect(normalized.features![1].editorId).toBe(existingId);
    expect(sheet.features[0].editorId).toBeUndefined();
    expect(normalized.creatorWizard).toBeUndefined();
    expect(normalizeCharacterEditorIdentity(normalized)).toEqual(normalized);
  });
});
