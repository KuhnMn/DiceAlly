import 'fake-indexeddb/auto';
import { TestBed } from '@angular/core/testing';
import { CombatAction, InventoryItem, Monster, SpellEntryFull } from '../models/character.model';
import { CharacterHelpersService } from '../sheet/character-helpers.service';
import { CharacterLibraryService } from '../characters/character-library.service';
import { CharacterInfoPageComponent } from '../sheet/character-info-page.component';
import { SpellsPageComponent } from '../sheet/spells-page.component';
import { CharacterStore } from '../stores/character.store';
import { emptyBasicCharacter } from './basic-info';
import { CombatEditorComponent } from './combat-editor.component';
import { CombatBookmarkComponent } from './combat-bookmark.component';
import { monsterCombatOptions, prefillCombatAction, resolveCombatResource } from './combat-actions';
import { AppDialogService } from '../services/app-dialog.service';
import { vi } from 'vitest';

function spell(): SpellEntryFull {
  return { editorId: 'test-spell', name: 'Flame', source: 'TEST', castingSourceName: 'Wizard', listType: 'KNOWN',
    entity: { name: 'Flame', source: 'TEST', level: 1, school: 'V', time: [{ number: 1, unit: 'bonus' }],
      range: { type: 'point', distance: { type: 'feet', amount: 60 } }, components: { v: true }, duration: [{ type: 'instant' }],
      entries: [{ text: 'Deal {@damage 2d6} fire damage.' }], spellAttack: ['R'], damageInflict: ['fire'] } };
}
describe('Combat creator', () => {
  beforeEach(() => TestBed.configureTestingModule({}));
  it.each(['SPELL', 'ITEM', 'SPECIES', 'CLASS_FEATURE', 'FEAT', 'OPTIONAL_FEATURE'] as const)(
    'adds multiple linked combat entries to a %s resource', async type => {
      const fixture = TestBed.createComponent(CombatBookmarkComponent);
      const sheet = emptyBasicCharacter();
      const resource = { editorId: 'resource', name: 'Resource' };
      if (type === 'SPELL') sheet.spells = [resource];
      else if (type === 'ITEM') sheet.inventory = [resource];
      else if (type === 'SPECIES') sheet.species = resource;
      else sheet.features = [resource];
      fixture.componentRef.setInput('sheet', sheet); fixture.componentRef.setInput('resource', resource);
      fixture.componentRef.setInput('type', type); await fixture.whenStable();
      const bookmark = fixture.componentInstance;
      bookmark.open(); bookmark.add(bookmark.draft!);
      fixture.changeDetectorRef.markForCheck(); await fixture.whenStable();
      fixture.nativeElement.querySelector('button[aria-label="Add another combat entry for Resource"]').click();
      expect(bookmark.draft).toBeDefined();
      bookmark.add({ ...bookmark.draft!, name: 'Second action', actionType: 'BONUS' });
      expect(bookmark.linkedActions()).toHaveLength(2);
      expect(new Set(bookmark.linkedActions().map(action => action.editorId)).size).toBe(2);
      expect(bookmark.linkedActions().map(action => action.orderIndex)).toEqual([0, 1]);
      expect(sheet.combatActions?.every(action => resolveCombatResource(sheet, action) === resource)).toBe(true);
    });
  it('suggests spell and weapon stats while leaving the original definitions unchanged', () => {
    const sheet = emptyBasicCharacter(); sheet.character!.level = 5;
    sheet.character!.abilityScores = { intelligence: 18, strength: 12, dexterity: 16 };
    sheet.character!.featureSources = [{ name: 'Wizard', usesIntelligence: true, isSpellcastingSource: true }];
    const helpers = TestBed.inject(CharacterHelpersService), source = spell();
    const action = prefillCombatAction(sheet, source, 'SPELL', helpers);
    expect(action).toMatchObject({ name: 'Flame', actionType: 'BONUS', hitOrDc: '+7 to hit', range: '60 feet', damageOrHeal: '2d6 Fire' });
    source.entity!.savingThrow = ['dex'];
    expect(prefillCombatAction(sheet, source, 'SPELL', helpers).hitOrDc).toBe('DC 15 Dexterity');
    const weapon: InventoryItem = { editorId: 'weapon', name: 'Rapier', source: 'TEST', entity: {
      item: { name: 'Rapier', source: 'TEST', dmg1: '1d8', dmgType: 'P', bonusWeapon: '+1' }, properties: [{ name: 'Finesse' }] } };
    expect(prefillCombatAction(sheet, weapon, 'ITEM', helpers)).toMatchObject({ hitOrDc: '+7 to hit', damageOrHeal: '1d8 +4 Piercing' });
    expect(source.entity!.entries).toEqual([{ text: 'Deal {@damage 2d6} fire damage.' }]);
  });
  it('offers individual monster actions and reactions, with links to the original monster', () => {
    const monster: Monster = { editorId: 'wolf', name: 'Wolf', source: 'TEST', entity: { name: 'Wolf',
      action: [{ name: 'Bite', entries: [{ text: '{@hit 4} to hit, reach 5 ft. Hit: {@damage 2d4 + 2} piercing damage.' }] }],
      reaction: [{ name: 'Retaliate', entries: [{ text: 'A reaction.' }] }] } };
    expect(monsterCombatOptions(monster)).toHaveLength(2);
    const action = prefillCombatAction(emptyBasicCharacter(), monster, 'MONSTER', TestBed.inject(CharacterHelpersService));
    expect(action).toMatchObject({ name: 'Wolf: Bite', hitOrDc: '+4 to hit', damageOrHeal: '2d4 + 2', actionType: 'ACTION' });
    expect(action.linkedResource?.editorId).toBe('wolf');
    expect(prefillCombatAction(emptyBasicCharacter(), monster, 'MONSTER', TestBed.inject(CharacterHelpersService), 1).actionType).toBe('REACTION');
  });
  it('adds through a review dialog, edits and reorders entries, and persists them with their links', async () => {
    const sheet = emptyBasicCharacter(); sheet.spells = [spell()];
    const bookmark = TestBed.createComponent(CombatBookmarkComponent);
    bookmark.componentRef.setInput('sheet', sheet); bookmark.componentRef.setInput('resource', sheet.spells[0]); bookmark.componentRef.setInput('type', 'SPELL');
    await bookmark.whenStable(); bookmark.componentInstance.open();
    expect(sheet.combatActions).toBeUndefined(); // Opening/cancelling suggestions does not add anything.
    bookmark.componentInstance.add(bookmark.componentInstance.draft!);
    bookmark.destroy();
    const fixture = TestBed.createComponent(CombatEditorComponent); fixture.componentRef.setInput('sheet', sheet); await fixture.whenStable();
    const editor = fixture.componentInstance;
    editor.create(); editor.save({ ...editor.draft, name: 'Quick Step', actionType: 'BONUS', damageOrHeal: 'Move 10 feet.' });
    const first = sheet.combatActions![0], second = sheet.combatActions![1];
    editor.move(second, -1);
    expect(editor.entries('BONUS')[0]).toBe(second);
    editor.edit(first); editor.save({ ...editor.draft, name: 'Flame Shot' });
    sheet.spells[0].name = 'Renamed Flame';
    fixture.changeDetectorRef.markForCheck();
    await fixture.whenStable();
    expect(resolveCombatResource(sheet, first)).toBe(sheet.spells[0]);
    const library = TestBed.inject(CharacterLibraryService); await library.save(sheet, 0);
    expect((await library.get(sheet.character!.characterUuid!))!.sheet.combatActions?.map(action => action.name)).toEqual(['Flame Shot', 'Quick Step']);
    const viewer = TestBed.createComponent(CharacterInfoPageComponent); viewer.componentRef.setInput('characterData', sheet); await viewer.whenStable();
    expect(viewer.componentInstance.getCombatActionAnchorId(first)).toBe('spell-test-spell');
    editor.unlink(first); expect(viewer.componentInstance.getCombatActionAnchorId(first)).toBeNull();
  });
  it('opens a bookmarked spell even when viewer filters would otherwise hide it', async () => {
    const sheet = emptyBasicCharacter(); sheet.spells = [spell()];
    const fixture = TestBed.createComponent(SpellsPageComponent); fixture.componentRef.setInput('characterData', sheet); await fixture.whenStable();
    fixture.componentInstance.spellCastingSourceFilter.set('Different');
    TestBed.inject(CharacterStore).setFeatureScrollTarget('spell-test-spell');
    await fixture.whenStable();
    expect(fixture.componentInstance.spellListTypeFilter()).toBe('KNOWN');
    expect(fixture.componentInstance.spellCastingSourceFilter()).toBe('ALL');
    expect(fixture.componentInstance.spells()).toHaveLength(1);
  });
  it('highlights bookmarked entries and removes only their linked combat references after confirmation', async () => {
    const sheet = emptyBasicCharacter(); sheet.spells = [spell()];
    const fixture = TestBed.createComponent(CombatBookmarkComponent);
    fixture.componentRef.setInput('sheet', sheet); fixture.componentRef.setInput('resource', sheet.spells[0]); fixture.componentRef.setInput('type', 'SPELL');
    await fixture.whenStable();
    const bookmark = fixture.componentInstance;
    expect(fixture.nativeElement.querySelector('button').getAttribute('aria-pressed')).toBe('false');
    bookmark.open(); bookmark.add(bookmark.draft!);
    sheet.combatActions!.push({ name: 'Unrelated', actionType: 'ACTION' });
    fixture.changeDetectorRef.markForCheck(); await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('button').classList.contains('action-button')).toBe(true);
    expect(fixture.nativeElement.querySelector('button').getAttribute('aria-pressed')).toBe('true');
    const confirm = vi.spyOn(TestBed.inject(AppDialogService), 'confirm').mockResolvedValue(false);
    await bookmark.toggle(); expect(sheet.combatActions).toHaveLength(2);
    confirm.mockResolvedValue(true);
    await bookmark.toggle();
    fixture.changeDetectorRef.markForCheck(); await fixture.whenStable();
    expect(sheet.combatActions).toEqual([{ name: 'Unrelated', actionType: 'ACTION' }]);
    expect(sheet.spells).toHaveLength(1);
    expect(fixture.nativeElement.querySelector('button').getAttribute('aria-pressed')).toBe('false');
  });
});
