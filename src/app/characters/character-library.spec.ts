import 'fake-indexeddb/auto';
import { TestBed } from '@angular/core/testing';
import { CharacterLibraryService } from './character-library.service';
import { CharacterSessionService } from './character-session.service';
import { CharacterStorageService } from '../services/character-storage.service';
import { CharacterStore } from '../stores/character.store';
import { emptyBasicCharacter } from '../editor/basic-info';
import { IndexedDbCharacterRepository } from './indexeddb-character-repository';

describe('Shared creator/viewer library', () => {
  beforeEach(() => { localStorage.clear(); TestBed.configureTestingModule({}); });

  it('lists and opens saved sheets even when optional wizard history is unsupported', async () => {
    const repository = new IndexedDbCharacterRepository();
    const older = emptyBasicCharacter(); older.character!.name = 'Existing character';
    Object.assign(older, { creatorWizard: { baseline: { old: { value: 1 } }, protectedKeys: [] } });
    const current = emptyBasicCharacter(); current.character!.name = 'Current character';
    await repository.save(older, 0); await repository.save(current, 0);
    const library = TestBed.inject(CharacterLibraryService);
    const summaries = await library.summaries();
    expect(summaries.some(entry => entry.characterId === older.character!.characterUuid)).toBe(true);
    expect(summaries.some(entry => entry.characterId === current.character!.characterUuid)).toBe(true);
    await TestBed.inject(CharacterSessionService).open(older.character!.characterUuid!);
    expect(TestBed.inject(CharacterStore).characterData()!.character!.name).toBe('Existing character');
  });

  it('preserves session resources, notes and wizard metadata through viewer saves', async () => {
    const library = TestBed.inject(CharacterLibraryService);
    const sheet = emptyBasicCharacter();
    sheet.character!.name = 'Round trip'; sheet.character!.maxHp = 24;
    sheet.character!.currentHp = 0;
    sheet.character!.hitDice = [{ dieType: 'd8', total: 3, used: 1 }];
    sheet.notes = [{ id: 1, title: 'Session', body: 'Keep this note' }];
    sheet.creatorWizard = { revisionId: 'test', classes: [], answers: {}, options: {}, baseline: [], protectedPaths: [['character', 'maxHp']] };
    await library.save(sheet, 0);
    await TestBed.inject(CharacterSessionService).open(sheet.character!.characterUuid!);
    const store = TestBed.inject(CharacterStore);
    expect(store.characterData()!.character!.currentHp).toBe(0);
    store.characterData()!.character!.currentHp = 7;
    await store.nativeSave!(store.characterData()!);
    const saved = (await library.get(sheet.character!.characterUuid!))!;
    expect(saved.version).toBe(2);
    expect(saved.sheet.character!.currentHp).toBe(7);
    expect(saved.sheet.character!.hitDice).toEqual(sheet.character!.hitDice);
    expect(saved.sheet.notes).toEqual(sheet.notes);
    expect(saved.sheet.creatorWizard).toEqual(sheet.creatorWizard);
    expect((await library.summaries()).some(row => row.characterId === saved.id)).toBe(true);
  });

  it('imports legacy saves once and retains deletion intent instead of resurrecting backups', async () => {
    const legacy = TestBed.inject(CharacterStorageService);
    const sheet = emptyBasicCharacter(); sheet.character!.name = 'Legacy';
    expect(legacy.saveCharacter(sheet).success).toBe(true);
    const library = TestBed.inject(CharacterLibraryService);
    const id = sheet.character!.characterUuid!;
    expect((await library.get(id))!.sheet).toEqual(sheet);
    await library.delete(id, 1);
    expect(await library.get(id)).toBeUndefined();
    expect((await library.summaries()).some(row => row.characterId === id)).toBe(false);
    expect(legacy.loadCharacter(id)).toEqual(sheet);
    expect((await new IndexedDbCharacterRepository().get(id))!.deletedAt).toBeTruthy();
  });

  it('rejects stale edits and snapshots data before asynchronous saves', async () => {
    const library = TestBed.inject(CharacterLibraryService);
    const sheet = emptyBasicCharacter(); sheet.character!.name = 'Original';
    const pending = library.save(sheet, 0);
    sheet.character!.name = 'Unsaved change';
    expect(await pending).toBe(1);
    expect((await library.get(sheet.character!.characterUuid!))!.sheet.character!.name).toBe('Original');
    await library.save(sheet, 1);
    await expect(library.save(sheet, 1)).rejects.toThrow('another tab');
    expect((await library.get(sheet.character!.characterUuid!))!.version).toBe(2);
  });

  it('imports portable JSON with stable IDs and requires explicit replacement', async () => {
    const library = TestBed.inject(CharacterLibraryService);
    const sheet = emptyBasicCharacter(); sheet.portaitUrl = 'data:image/png;base64,test';
    const json = JSON.stringify(sheet);
    expect((await library.importCharacterFromJson(json)).success).toBe(true);
    expect((await library.importCharacterFromJson(json)).error!.code).toBe('IMPORT_CONFLICT');
    expect((await library.importCharacterFromJson(json, true)).success).toBe(true);
    expect((await library.get(sheet.character!.characterUuid!))!.sheet).toEqual(sheet);
    expect((await library.importCharacterFromJson('{"character":[]}')).success).toBe(false);
  });
});
