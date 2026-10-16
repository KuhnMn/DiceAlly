import 'fake-indexeddb/auto';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { SpellSlotsComponent } from './spell-slots.component';
import { LocalEditorComponent } from './local-editor.component';
import { emptyBasicCharacter } from './basic-info';
import { IndexedDbCharacterRepository } from '../characters/indexeddb-character-repository';
import { RestService } from '../services/rest.service';
import { By } from '@angular/platform-browser';
import { FeatureSourcePickerComponent } from './feature-source-picker.component';

describe('Spell Slots editor', () => {
  beforeEach(() => TestBed.configureTestingModule({ imports: [SpellSlotsComponent, LocalEditorComponent], providers: [provideRouter([])] }));

  it('offers slots inside Feature Sources when casting sources or existing slots exist', async () => {
    const fixture = TestBed.createComponent(LocalEditorComponent); await fixture.whenStable();
    const editor = fixture.componentInstance;
    expect(editor.pages).toEqual(['Basic Info', 'Ability Scores', 'Proficiencies & More', 'Feature Sources', 'Features & Spells', 'Items', 'Monsters', 'Combat']);
    expect(editor.hasCastingSources).toBe(false);
    editor.character.featureSources = [{ name: 'Wizard', isSpellcastingSource: true }];
    expect(editor.hasCastingSources).toBe(true);
    editor.character.featureSources[0].isSpellcastingSource = false;
    expect(editor.hasCastingSources).toBe(false);
    editor.character.spellSlots = { Wizard: [{ level: 1, total: 2, used: 0 }] };
    expect(editor.hasSpellSlots).toBe(true);
    editor.setPage(3); fixture.changeDetectorRef.markForCheck(); await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('app-editor-spell-slots')).not.toBeNull();
  });

  it('sorts editable rows by level, moves and saves without resetting usage', async () => {
    const fixture = TestBed.createComponent(SpellSlotsComponent); const sheet = emptyBasicCharacter();
    sheet.character!.featureSources = [{ name: 'Wizard', isSpellcastingSource: true }, { name: 'Cleric', isSpellcastingSource: true }];
    fixture.componentRef.setInput('sheet', sheet); await fixture.whenStable();
    const editor = fixture.componentInstance;
    editor.add();
    const first = editor.slots('Wizard')[0];
    expect(first).toMatchObject({ level: 1, total: 0, used: 0 });
    first.total = 5; first.used = 2; first.regainCondition = 'SHORT_REST_ONE';
    editor.add();
    expect(editor.slots('Wizard').map(slot => slot.level)).toEqual([1, 2]);
    expect(editor.slots('Wizard')[0]).toBe(first);
    editor.setLevel('Wizard', first, 3);
    expect(editor.slots('Wizard').map(slot => slot.level)).toEqual([2, 3]);
    editor.remove('Wizard', 0);
    expect(editor.visibleSources.map(source => source.name)).toEqual(['Wizard']);
    editor.move('Wizard', 0, 'Cleric');
    expect(editor.slots('Wizard')).toEqual([]); expect(editor.slots('Cleric')[0].used).toBe(2);
    const repository = new IndexedDbCharacterRepository(); await repository.save(sheet, 0);
    const saved = (await repository.list()).find(entry => entry.id === sheet.character!.characterUuid)!;
    expect(saved.sheet.character!.spellSlots!['Cleric'][0]).toMatchObject({ total: 5, used: 2, regainCondition: 'SHORT_REST_ONE' });
    editor.remove('Cleric', 0); expect(editor.slots('Cleric')).toEqual([]);
  });

  it('disables duplicate level and recovery combinations but allows different recovery at the same level', async () => {
    const fixture = TestBed.createComponent(SpellSlotsComponent); const sheet = emptyBasicCharacter();
    sheet.character!.featureSources = [{ name: 'Wizard', isSpellcastingSource: true }];
    const first = { level: 1, total: 2, used: 0, regainCondition: 'LONG_REST' };
    const second = { level: 2, total: 1, used: 0, regainCondition: 'LONG_REST' };
    sheet.character!.spellSlots = { Wizard: [first, second] };
    fixture.componentRef.setInput('sheet', sheet); await fixture.whenStable();
    const editor = fixture.componentInstance;
    const levelSelect = fixture.nativeElement.querySelectorAll('select')[2] as HTMLSelectElement;
    expect(levelSelect.options[0].disabled).toBe(true);
    editor.setLevel('Wizard', second, 1);
    expect(second.level).toBe(2);
    editor.setRecovery('Wizard', second, 'SHORT_REST');
    editor.setLevel('Wizard', second, 1);
    expect(second.level).toBe(1);
    fixture.changeDetectorRef.markForCheck(); await fixture.whenStable();
    const recoverySelect = fixture.nativeElement.querySelectorAll('select')[3] as HTMLSelectElement;
    expect(Array.from(recoverySelect.options).find(option => option.value === 'LONG_REST')!.disabled).toBe(true);
    editor.setRecovery('Wizard', second, 'LONG_REST');
    expect(second.regainCondition).toBe('SHORT_REST');
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

  it('keeps the source picker and used counts unchanged when a move would collide', async () => {
    const fixture = TestBed.createComponent(SpellSlotsComponent); const sheet = emptyBasicCharacter();
    sheet.character!.featureSources = [{ name: 'Wizard', isSpellcastingSource: true }, { name: 'Cleric', isSpellcastingSource: true }];
    sheet.character!.spellSlots = {
      Wizard: [{ level: 1, total: 3, used: 2 }],
      Cleric: [{ level: 1, total: 2, used: 1 }],
    };
    fixture.componentRef.setInput('sheet', sheet); await fixture.whenStable();
    const pickers = fixture.debugElement.queryAll(By.directive(FeatureSourcePickerComponent));
    const wizardPicker = pickers[0].componentInstance as FeatureSourcePickerComponent;
    expect(wizardPicker.value()).toBe('Wizard');
    wizardPicker.selected.emit('Cleric'); await fixture.whenStable();
    expect(fixture.componentInstance.error).toContain('already has slots');
    expect(wizardPicker.value()).toBe('Wizard');
    expect(sheet.character!.spellSlots['Wizard'][0].used).toBe(2);
    expect(sheet.character!.spellSlots['Cleric'][0].used).toBe(1);
  });
});
