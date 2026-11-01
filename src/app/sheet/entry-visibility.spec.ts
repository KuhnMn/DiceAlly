import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { emptyBasicCharacter } from '../editor/basic-info';
import { prefillCombatAction } from '../editor/combat-actions';
import { CharacterHelpersService } from './character-helpers.service';
import { FeaturesPageComponent } from './features-page.component';
import { SpellsPageComponent } from './spells-page.component';
import { EquipmentPageComponent } from './equipment-page.component';
import { MonstersPageComponent } from './monsters-page.component';
import { BastionsPageComponent } from './bastions-page.component';
import { CharacterInfoPageComponent } from './character-info-page.component';

describe('Viewer entry visibility', () => {
  beforeEach(() => TestBed.configureTestingModule({ providers: [provideRouter([])] }));

  it('omits hidden features and species from the page and feature index without removing saved data', () => {
    const sheet = emptyBasicCharacter();
    sheet.features = [{ name: 'Visible Feat', featureType: 'FEAT' }, { name: 'Hidden Feat', featureType: 'FEAT', hidden: true }];
    sheet.species = { name: 'Hidden Species', hidden: true };
    const fixture = TestBed.createComponent(FeaturesPageComponent);
    fixture.componentRef.setInput('characterData', sheet); fixture.componentInstance.setFeatureView('FEAT'); fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Visible Feat');
    expect(fixture.nativeElement.textContent).not.toContain('Hidden Feat');
    expect(fixture.nativeElement.querySelector('#species-section')).toBeNull();
    const overview = TestBed.createComponent(CharacterInfoPageComponent); overview.componentRef.setInput('characterData', sheet);
    expect(overview.componentInstance.features().map(entry => entry.name)).toEqual(['Visible Feat']);
    expect(sheet.features).toHaveLength(2);
  });

  it('omits hidden spells from every viewer list', () => {
    const sheet = emptyBasicCharacter();
    sheet.spells = ['PREPARED', 'KNOWN', 'SPELLBOOK'].flatMap(listType => [
      { name: 'Visible Spell', listType },
      { name: 'Hidden Spell', listType, hidden: true },
    ]);
    const fixture = TestBed.createComponent(SpellsPageComponent); fixture.componentRef.setInput('characterData', sheet);
    for (const view of ['PREPARED', 'KNOWN', 'SPELLBOOK'] as const) {
      fixture.componentInstance.spellView.set(view); fixture.detectChanges();
      expect(fixture.componentInstance.spells().map(entry => entry.name)).toEqual(['Visible Spell']);
      expect(fixture.nativeElement.textContent).not.toContain('Hidden Spell');
    }
    expect(sheet.spells).toHaveLength(6);
  });

  it('hides inventory cards while retaining equipped items for calculations', () => {
    const sheet = emptyBasicCharacter();
    sheet.inventory = [{ name: 'Visible Item' }, { name: 'Hidden Armor', isEquipped: true, hidden: true }];
    const fixture = TestBed.createComponent(EquipmentPageComponent); fixture.componentRef.setInput('characterData', sheet); fixture.detectChanges();
    expect(fixture.componentInstance.visibleInventory().map(entry => entry.name)).toEqual(['Visible Item']);
    expect(fixture.componentInstance.inventory()).toHaveLength(2);
    const overview = TestBed.createComponent(CharacterInfoPageComponent); overview.componentRef.setInput('characterData', sheet);
    expect(overview.componentInstance.inventory()[1]).toBe(sheet.inventory[1]);
  });

  it('filters monsters, object companions and facilities without losing their instances', () => {
    const sheet = emptyBasicCharacter();
    sheet.monsters = [{ name: 'Visible Wolf' }, { name: 'Hidden Wolf', hidden: true }];
    sheet.objects = [{ kind: 'object', name: 'Visible Object', hitPoints: { enabled: false } }, { kind: 'object', name: 'Hidden Object', hitPoints: { enabled: false }, hidden: true }];
    sheet.bastion = { facilities: [{ editorId: 'room', name: 'Hidden Room', hidden: true, entity: { version: 1, name: 'Room', source: 'TEST', facilityType: 'basic', entries: [] } }] };
    const companions = TestBed.createComponent(MonstersPageComponent); companions.componentRef.setInput('characterData', sheet); companions.detectChanges();
    expect(companions.componentInstance.visibleMonsters().map(entry => entry.name)).toEqual(['Visible Wolf']);
    companions.componentInstance.companionType.set('object'); companions.detectChanges();
    expect(companions.componentInstance.visibleMonsters().map(entry => entry.name)).toEqual(['Visible Object']);
    const bastions = TestBed.createComponent(BastionsPageComponent); bastions.componentRef.setInput('characterData', sheet); bastions.detectChanges();
    expect(bastions.componentInstance.selected()).toEqual([]);
    expect(sheet.objects).toHaveLength(2); expect(sheet.bastion.facilities).toHaveLength(1);
  });

  it('hides independent combat entries and bookmarks of hidden sources', () => {
    const sheet = emptyBasicCharacter();
    sheet.features = [{ editorId: 'gift', name: 'Hidden Gift', featureType: 'FEAT', hidden: true }];
    const helper = TestBed.inject(CharacterHelpersService);
    sheet.combatActions = [prefillCombatAction(sheet, sheet.features[0], 'FEAT', helper), { name: 'Hidden Custom Action', hidden: true }, { name: 'Visible Action' }];
    const fixture = TestBed.createComponent(CharacterInfoPageComponent); fixture.componentRef.setInput('characterData', sheet); fixture.detectChanges();
    expect(fixture.componentInstance.combatActions().map(action => action.name)).toEqual(['Visible Action']);
    expect(sheet.combatActions).toHaveLength(3);
  });
});
