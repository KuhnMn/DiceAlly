import 'fake-indexeddb/auto';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { mapContent } from '../content/content-adapter';
import { ADAPTER_VERSION, DEFAULT_CONTENT_SOURCE, ImportRevision, sourceIdentity } from '../content/content.model';
import { CharacterLibraryService } from '../characters/character-library.service';
import { RestService } from '../services/rest.service';
import { emptyBasicCharacter, validateBasicInfo } from './basic-info';
import { createMonsterEntry, setMonsterMaxHp } from './monster-selection';
import { MonstersEditorComponent } from './monsters-editor.component';

const record = () => mapContent({ monster: [{ name: 'Wolf', source: 'MM', type: 'beast', hp: { average: 11, formula: '2d8+2' },
  speed: { walk: 40, fly: { number: 20, condition: 'magic' } }, action: [{ name: 'Bite', entries: ['Bite text'] }] }] }, 'bestiary.json').records[0];
const revision = (): ImportRevision => ({ id: crypto.randomUUID(), namespace: 'development-local', source: DEFAULT_CONTENT_SOURCE,
  sourceIdentity: sourceIdentity(DEFAULT_CONTENT_SOURCE), commit: 'a'.repeat(40), adapterVersion: ADAPTER_VERSION,
  status: 'ready', createdAt: new Date().toISOString(), files: [], diagnostics: [], metrics: { bytes: 0, records: 1, mappedBytes: 0, elapsedMs: 0 } });

describe('Monster creator', () => {
  beforeEach(() => TestBed.configureTestingModule({ providers: [provideRouter([])] }));
  it('embeds a detached stat block in the viewer shape and preserves content provenance', () => {
    const source = record(); const imported = revision(); const monster = createMonsterEntry(source, imported);
    expect(monster.entity!.type).toEqual({ type: 'beast' });
    expect(monster.entity!.speed).toEqual({ walk: 40, fly: 20 });
    expect(monster.entity!.hp!.average).toBe(11); expect(monster.hpEnabled).toBe(false);
    expect(monster.monsterMaxHP).toBeUndefined(); expect(monster.monsterCurrentHP).toBeUndefined();
    expect(monster.contentReference!.key).toBe(source.key); expect(monster.contentReference!.commit).toBe(imported.commit);
    monster.entity!.name = 'Changed'; expect(source.name).toBe('Wolf'); expect(source.data['name']).toBe('Wolf');
  });
  it('keeps damaged HP when changing maximum HP and disables tracking when cleared', () => {
    const monster = createMonsterEntry(record(), revision());
    setMonsterMaxHp(monster, 30); expect(monster.monsterCurrentHP).toBe(30);
    monster.monsterCurrentHP = 7; setMonsterMaxHp(monster, 40); expect(monster.monsterCurrentHP).toBe(7);
    setMonsterMaxHp(monster, null); expect(monster.hpEnabled).toBe(false);
    expect(monster.monsterMaxHP).toBeUndefined(); expect(monster.monsterCurrentHP).toBeUndefined();
    expect(monster.entity!.hp!.average).toBe(11);
  });
  it('adds independent copies, saves HP/annotations, and confirms removal of annotated monsters', async () => {
    const fixture = TestBed.createComponent(MonstersEditorComponent); const sheet = emptyBasicCharacter();
    fixture.componentRef.setInput('sheet', sheet); await fixture.whenStable();
    const editor = fixture.componentInstance; await editor.refreshContent(); editor.catalog.revision.set(revision());
    const source = record(); editor.add(source); editor.add(source); expect(sheet.monsters).toHaveLength(2);
    const second = sheet.monsters![1];
    expect(editor.hasExisting(source)).toBe(true);
    expect(second.editorId).not.toBe(sheet.monsters![0].editorId);
    const monster = sheet.monsters![0]; editor.setMaxHp(monster, 25);
    monster.notes = [{ tag: 'Commands', notes: ['Guard', 'Follow'], isEditable: true }];
    monster.uses = [{ tag: 'Summon', totalFreeUses: 2, usedFreeUses: 1, freeUsesRegainCondition: 'SHORT_REST_ONE' }];
    expect(second.notes).toEqual([]); expect(second.uses).toEqual([]);
    expect(second.monsterMaxHP).toBeUndefined();
    monster.entity!.name = 'First wolf'; expect(second.entity!.name).toBe('Wolf');
    validateBasicInfo(sheet); const library = TestBed.inject(CharacterLibraryService); await library.save(sheet, 0);
    expect((await library.get(sheet.character!.characterUuid!))!.sheet.monsters).toEqual(sheet.monsters);
    editor.remove(monster); expect(editor.pendingRemoval).toBe(monster); expect(sheet.monsters).toHaveLength(2);
    editor.confirmRemoval(); expect(sheet.monsters).toEqual([second]);
    sheet.monsters = [monster]; monster.monsterMaxHP = -1;
    expect(() => validateBasicInfo(sheet)).toThrow('maximum HP');
  });
  it('uses the normal rest conditions for monster trackers', () => {
    const sheet = emptyBasicCharacter(); const monster = createMonsterEntry(record(), revision()); sheet.monsters = [monster];
    monster.uses = ['SHORT_REST', 'SHORT_REST_ONE', 'LONG_REST', 'MANUAL'].map(freeUsesRegainCondition => ({
      tag: freeUsesRegainCondition, totalFreeUses: 5, usedFreeUses: 3, freeUsesRegainCondition,
    }));
    const rest = TestBed.inject(RestService); rest.performShortRest(sheet);
    expect(monster.uses.map(use => use.usedFreeUses)).toEqual([0, 2, 3, 3]);
    rest.performLongRest(sheet); expect(monster.uses.map(use => use.usedFreeUses)).toEqual([0, 1, 0, 3]);
  });
});
