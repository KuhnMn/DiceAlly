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
import { MobileCombatPageComponent } from './mobile-combat-page.component';

function toggleHidden(root: HTMLElement) {
  root.querySelector<HTMLButtonElement>('button[aria-label="Show hidden entries"]')!.click();
}

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
    const before = structuredClone(sheet);
    toggleHidden(fixture.nativeElement); fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Hidden Feat');
    expect(fixture.nativeElement.querySelector('#species-section')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('[aria-label="Show hidden entries"]').getAttribute('aria-pressed')).toBe('true');
    fixture.componentInstance.searchQuery.set('Hidden'); fixture.detectChanges();
    expect(fixture.componentInstance.sortedFeatures().map(entry => entry.name)).toEqual(['Hidden Feat']);
    toggleHidden(fixture.nativeElement); fixture.detectChanges();
    expect(fixture.componentInstance.sortedFeatures()).toEqual([]);
    expect(fixture.componentInstance.searchQuery()).toBe('Hidden');
    expect(sheet).toEqual(before);
  });

  it('omits hidden spells from every viewer list', () => {
    const sheet = emptyBasicCharacter();
    sheet.spells = ['PREPARED', 'KNOWN', 'SPELLBOOK'].flatMap(listType => [
      { name: 'Visible Spell', listType },
      { name: 'Hidden Spell', listType, hidden: true },
    ]);
    const fixture = TestBed.createComponent(SpellsPageComponent); fixture.componentRef.setInput('characterData', sheet);
    const before = structuredClone(sheet);
    for (const view of ['PREPARED', 'KNOWN', 'SPELLBOOK'] as const) {
      fixture.componentInstance.spellView.set(view); fixture.detectChanges();
      expect(fixture.componentInstance.spells().map(entry => entry.name)).toEqual(['Visible Spell']);
      expect(fixture.nativeElement.textContent).not.toContain('Hidden Spell');
      toggleHidden(fixture.nativeElement); fixture.detectChanges();
      expect(fixture.componentInstance.spells().map(entry => entry.name)).toEqual(['Hidden Spell', 'Visible Spell']);
      expect(fixture.nativeElement.textContent).toContain('Hidden Spell');
      toggleHidden(fixture.nativeElement); fixture.detectChanges();
      expect(fixture.componentInstance.spells().map(entry => entry.name)).toEqual(['Visible Spell']);
    }
    expect(sheet.spells).toHaveLength(6);
    expect(sheet).toEqual(before);
  });

  it('hides inventory cards while retaining equipped items for calculations', () => {
    const sheet = emptyBasicCharacter();
    sheet.inventory = [{ name: 'Visible Item' }, { name: 'Hidden Armor', isEquipped: true, hidden: true }];
    const fixture = TestBed.createComponent(EquipmentPageComponent); fixture.componentRef.setInput('characterData', sheet); fixture.detectChanges();
    expect(fixture.componentInstance.visibleInventory().map(entry => entry.name)).toEqual(['Visible Item']);
    expect(fixture.componentInstance.inventory()).toHaveLength(2);
    const overview = TestBed.createComponent(CharacterInfoPageComponent); overview.componentRef.setInput('characterData', sheet);
    expect(overview.componentInstance.inventory()[1]).toBe(sheet.inventory[1]);
    const before = structuredClone(sheet);
    toggleHidden(fixture.nativeElement); fixture.detectChanges();
    expect(fixture.componentInstance.visibleInventory().map(entry => entry.name).sort()).toEqual(['Hidden Armor', 'Visible Item']);
    fixture.componentInstance.inventoryFilter.set('equipped'); fixture.detectChanges();
    expect(fixture.componentInstance.visibleInventory().map(entry => entry.name)).toEqual(['Hidden Armor']);
    toggleHidden(fixture.nativeElement); fixture.detectChanges();
    expect(fixture.componentInstance.visibleInventory()).toEqual([]);
    expect(sheet).toEqual(before);
  });

  it('filters monsters, object companions and facilities without losing their instances', () => {
    const sheet = emptyBasicCharacter();
    sheet.monsters = [{ name: 'Visible Wolf' }, { name: 'Hidden Wolf', hidden: true }];
    sheet.objects = [{ kind: 'object', name: 'Visible Object', hitPoints: { enabled: false } }, { kind: 'object', name: 'Hidden Object', hitPoints: { enabled: false }, hidden: true }];
    sheet.bastion = { facilities: [{ editorId: 'room', name: 'Hidden Room', hidden: true, entity: { version: 1, name: 'Room', source: 'TEST', facilityType: 'basic', entries: [] } }] };
    const companions = TestBed.createComponent(MonstersPageComponent); companions.componentRef.setInput('characterData', sheet); companions.detectChanges();
    const before = structuredClone(sheet);
    expect(companions.componentInstance.visibleMonsters().map(entry => entry.name)).toEqual(['Visible Wolf']);
    toggleHidden(companions.nativeElement); companions.detectChanges();
    expect(companions.componentInstance.visibleMonsters().map(entry => entry.name).sort()).toEqual(['Hidden Wolf', 'Visible Wolf']);
    toggleHidden(companions.nativeElement); companions.detectChanges();
    companions.componentInstance.companionType.set('object'); companions.detectChanges();
    expect(companions.componentInstance.visibleMonsters().map(entry => entry.name)).toEqual(['Visible Object']);
    toggleHidden(companions.nativeElement); companions.detectChanges();
    expect(companions.componentInstance.visibleMonsters().map(entry => entry.name).sort()).toEqual(['Hidden Object', 'Visible Object']);
    toggleHidden(companions.nativeElement); companions.detectChanges();
    const bastions = TestBed.createComponent(BastionsPageComponent); bastions.componentRef.setInput('characterData', sheet); bastions.detectChanges();
    expect(bastions.componentInstance.selected()).toEqual([]);
    toggleHidden(bastions.nativeElement); bastions.detectChanges();
    expect(bastions.componentInstance.selected().map(entry => entry.name)).toEqual(['Hidden Room']);
    toggleHidden(bastions.nativeElement); bastions.detectChanges();
    expect(bastions.componentInstance.selected()).toEqual([]);
    expect(sheet.objects).toHaveLength(2); expect(sheet.bastion.facilities).toHaveLength(1);
    expect(sheet).toEqual(before);
  });

  it.each([CharacterInfoPageComponent, MobileCombatPageComponent])('reveals independent combat entries and bookmarks of hidden sources in %s', component => {
    const sheet = emptyBasicCharacter();
    sheet.features = [{ editorId: 'gift', name: 'Hidden Gift', featureType: 'FEAT', hidden: true }];
    const helper = TestBed.inject(CharacterHelpersService);
    sheet.combatActions = [prefillCombatAction(sheet, sheet.features[0], 'FEAT', helper), { name: 'Hidden Custom Action', hidden: true }, { name: 'Visible Action' }];
    const fixture = TestBed.createComponent(component); fixture.componentRef.setInput('characterData', sheet); fixture.detectChanges();
    expect(fixture.componentInstance.combatActions().map(action => action.name)).toEqual(['Visible Action']);
    expect(sheet.combatActions).toHaveLength(3);
    const before = structuredClone(sheet);
    toggleHidden(fixture.nativeElement); fixture.detectChanges();
    expect(fixture.componentInstance.combatActions().map(action => action.name)).toEqual(sheet.combatActions.map(action => action.name));
    toggleHidden(fixture.nativeElement); fixture.detectChanges();
    expect(fixture.componentInstance.combatActions().map(action => action.name)).toEqual(['Visible Action']);
    expect(sheet).toEqual(before);
  });
});
