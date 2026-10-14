import 'fake-indexeddb/auto';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { SpellSlotsComponent } from './spell-slots.component';
import { LocalEditorComponent } from './local-editor.component';
import { emptyBasicCharacter } from './basic-info';
import { BasicInfoRepository } from './basic-info-repository';
import { RestService } from '../services/rest.service';

describe('Spell Slots editor', () => {
  beforeEach(() => TestBed.configureTestingModule({ imports: [SpellSlotsComponent, LocalEditorComponent], providers: [provideRouter([])] }));

  it('only offers the page when a spellcasting source exists', async () => {
    const fixture = TestBed.createComponent(LocalEditorComponent); await fixture.whenStable();
    const editor = fixture.componentInstance;
    expect(editor.pages).not.toContain('Spell Slots');
    editor.character.featureSources = [{ name: 'Wizard', isSpellcastingSource: true }];
    expect(editor.pages).toContain('Spell Slots');
    editor.character.featureSources[0].isSpellcastingSource = false;
    expect(editor.pages).not.toContain('Spell Slots');
  });

  it('adds, merges, moves and saves totals without resetting usage', async () => {
    const fixture = TestBed.createComponent(SpellSlotsComponent); const sheet = emptyBasicCharacter();
    sheet.character!.featureSources = [{ name: 'Wizard', isSpellcastingSource: true }, { name: 'Cleric', isSpellcastingSource: true }];
    fixture.componentRef.setInput('sheet', sheet); await fixture.whenStable();
    const editor = fixture.componentInstance;
    editor.selectedSource = 'Wizard'; editor.total = 3; editor.add();
    editor.slots('Wizard')[0].used = 2; editor.total = 1; editor.add();
    expect(editor.slots('Wizard')[0]).toMatchObject({ level: 1, total: 4, used: 2, regainCondition: 'LONG_REST' });
    editor.recovery = 'SHORT_REST_ONE'; editor.add(); expect(editor.error).toMatch(/recovery/);
    editor.slots('Wizard')[0].regainCondition = 'SHORT_REST_ONE'; editor.add();
    expect(editor.slots('Wizard')[0].used).toBe(2);
    const select = document.createElement('select'); select.add(new Option('Cleric', 'Cleric')); select.value = 'Cleric';
    const event = new Event('change'); Object.defineProperty(event, 'target', { value: select });
    editor.move('Wizard', 0, event);
    expect(editor.slots('Wizard')).toEqual([]); expect(editor.slots('Cleric')[0].used).toBe(2);
    const repository = new BasicInfoRepository(); await repository.save(sheet, 0);
    const saved = (await repository.list()).find(entry => entry.id === sheet.character!.characterUuid)!;
    expect(saved.sheet.character!.spellSlots!['Cleric'][0]).toMatchObject({ total: 5, used: 2, regainCondition: 'SHORT_REST_ONE' });
    editor.remove('Cleric', 0); expect(editor.slots('Cleric')).toEqual([]);
  });

  it('implements short-rest, short-rest-one, long-rest and manual recovery separately', () => {
    const sheet = emptyBasicCharacter();
    sheet.character!.spellSlots = { Wizard: [
      { level: 1, total: 3, used: 3, regainCondition: 'SHORT_REST' },
      { level: 2, total: 3, used: 3, regainCondition: 'SHORT_REST_ONE' },
      { level: 3, total: 3, used: 3, regainCondition: 'LONG_REST' },
      { level: 4, total: 3, used: 3, regainCondition: 'MANUAL' },
    ] };
    const rest = TestBed.inject(RestService); rest.performShortRest(sheet);
    expect(sheet.character!.spellSlots['Wizard'].map(slot => slot.used)).toEqual([0, 2, 3, 3]);
    rest.performLongRest(sheet);
    expect(sheet.character!.spellSlots['Wizard'].map(slot => slot.used)).toEqual([0, 1, 0, 3]);
  });
});
