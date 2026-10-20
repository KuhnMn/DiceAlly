import 'fake-indexeddb/auto';
import { TestBed } from '@angular/core/testing';
import { ClassesEditorComponent } from './classes-editor.component';
import { emptyBasicCharacter, validateBasicInfo } from './basic-info';
import { mapContent } from '../content/content-adapter';
import { characterDescription } from '../character-description';
import { IndexedDbCharacterRepository } from '../characters/indexeddb-character-repository';

describe('Display-only class rows', () => {
  it('supports library classes/subclasses and custom text, derives the total, and never configures the wizard', async () => {
    const fixture = TestBed.createComponent(ClassesEditorComponent), sheet = emptyBasicCharacter();
    sheet.creatorWizard = { revisionId: 'saved', classes: [{ selectionId: 'saved', classKey: 'saved-wizard-class', level: 8 }], answers: {}, options: {}, baseline: [], protectedPaths: [] };
    const wizardState = structuredClone(sheet.creatorWizard);
    fixture.componentRef.setInput('sheet', sheet); await fixture.whenStable();
    const editor = fixture.componentInstance;
    const data = mapContent({ class: [{ name: 'Fighter', source: 'PHB' }, { name: 'Wizard', source: 'XPHB' }],
      subclass: [{ name: 'Champion', source: 'PHB', className: 'Fighter', classSource: 'PHB' }, { name: 'Evoker', source: 'XPHB', className: 'Wizard', classSource: 'XPHB' }],
    }, 'classes.json').records;
    editor.records = data;
    editor.add(); const library = sheet.classes![0];
    editor.select(library, data.find(record => record.name === 'Fighter')!.key);
    expect(editor.subclassOptions(library).map(option => option.label)).toEqual(['None', 'Champion (PHB)']);
    editor.selectSubclass(library, data.find(record => record.name === 'Champion')!.key); editor.level(library, 3);
    editor.add(); const custom = sheet.classes![1]; custom.name = 'Storyteller'; custom.subclass = 'Lorekeeper'; editor.level(custom, 2);
    expect(sheet.character!.level).toBe(5);
    expect(characterDescription(sheet)).toBe('Fighter (Champion) 3 / Storyteller (Lorekeeper) 2');
    expect(sheet.creatorWizard).toEqual(wizardState); expect(sheet.features).toBeUndefined(); expect(sheet.spells).toBeUndefined();
    editor.books.setSelection(['PHB']); expect(editor.classOptions(library).some(option => option.label === 'Wizard (XPHB)')).toBe(false);
    validateBasicInfo(sheet);
    const repository = new IndexedDbCharacterRepository(); await repository.save(sheet, 0);
    expect((await repository.get(sheet.character!.characterUuid!))!.sheet.classes).toEqual(sheet.classes);
    editor.remove(0); expect(sheet.character!.level).toBe(2); expect(sheet.classes).toEqual([custom]);
  });

  it('does not save empty names or invalid per-class levels', async () => {
    const fixture = TestBed.createComponent(ClassesEditorComponent), sheet = emptyBasicCharacter();
    fixture.componentRef.setInput('sheet', sheet); await fixture.whenStable();
    const editor = fixture.componentInstance; editor.add();
    expect(() => validateBasicInfo(sheet)).toThrow('class name');
    sheet.classes![0].name = 'Custom'; editor.level(sheet.classes![0], 0);
    expect(() => validateBasicInfo(sheet)).toThrow('Class level');
  });
});
