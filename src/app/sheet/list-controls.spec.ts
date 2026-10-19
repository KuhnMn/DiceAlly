import { TestBed } from '@angular/core/testing';
import { Signal } from '@angular/core';
import { By } from '@angular/platform-browser';
import { emptyBasicCharacter } from '../editor/basic-info';
import { ListControlsComponent } from '../list-controls.component';
import { SpellsPageComponent } from './spells-page.component';
import { FeaturesPageComponent } from './features-page.component';
import { EquipmentPageComponent } from './equipment-page.component';
import { MonstersPageComponent } from './monsters-page.component';

describe('Shared viewer list controls', () => {
  it('puts exact names first across spell levels, feature levels, inventory groups and monster types', () => {
    const spells = TestBed.createComponent(SpellsPageComponent);
    spells.componentRef.setInput('characterData', { character: {}, spells: [
      { name: 'Greater Bless', listType: 'PREPARED', entity: { level: 0 } },
      { name: 'Bless', listType: 'PREPARED', entity: { level: 9 } },
    ] });
    spells.componentInstance.searchQuery.set('bless');
    expect(spells.componentInstance.spellsByLevel().map(group => group.spells[0].name)).toEqual(['Bless', 'Greater Bless']);
    const features = TestBed.createComponent(FeaturesPageComponent);
    features.componentRef.setInput('characterData', { character: {}, features: [
      { name: 'Improved Training', featureEntity: { level: 1 } }, { name: 'Training', featureEntity: { level: 9 } },
    ] });
    features.componentInstance.searchQuery.set('training');
    expect(features.componentInstance.featureGroups().map(group => group.features[0].name)).toEqual(['Training', 'Improved Training']);
    const inventory = TestBed.createComponent(EquipmentPageComponent);
    inventory.componentRef.setInput('characterData', { character: {}, inventory: [
      { name: 'Ascended Longsword', entity: { itemType: 'A' } }, { name: 'Longsword', entity: { itemType: 'Z' } },
    ] });
    inventory.componentInstance.searchQuery.set('longsword');
    expect(inventory.componentInstance.inventoryGroups().map(group => group.items[0].name)).toEqual(['Longsword', 'Ascended Longsword']);
    const monsters = TestBed.createComponent(MonstersPageComponent);
    monsters.componentRef.setInput('characterData', { character: {}, monsters: [
      { name: 'Dire Wolf', hpEnabled: true }, { name: 'Wolf', hpEnabled: false },
    ] });
    monsters.componentInstance.searchQuery.set('wolf');
    expect(monsters.componentInstance.visibleMonsters().map(monster => monster.name)).toEqual(['Wolf', 'Dire Wolf']);
  });
  it('combines spell levels, toggles them independently, and returns to All when cleared', () => {
    const fixture = TestBed.createComponent(SpellsPageComponent);
    fixture.componentRef.setInput('characterData', { character: {}, spells: [
      { name: 'Light', listType: 'PREPARED', entity: { level: 0 } },
      { name: 'Shield', listType: 'PREPARED', entity: { level: 1 } },
      { name: 'Misty Step', listType: 'PREPARED', entity: { level: 2 } },
    ] }); fixture.detectChanges();
    const page = fixture.componentInstance;
    const controls = fixture.debugElement.query(By.directive(ListControlsComponent));
    controls.componentInstance.filtersOpen.set(true); fixture.detectChanges();
    const levelButton = (label: string) => Array.from(controls.nativeElement.querySelectorAll('button[aria-pressed]'))
      .find(button => (button as HTMLButtonElement).textContent?.trim() === label) as HTMLButtonElement;
    levelButton('Cantrips').click(); levelButton('Level 1').click(); fixture.detectChanges();
    expect(page.spells().map(spell => spell.name)).toEqual(['Light', 'Shield']);
    expect(levelButton('Cantrips').getAttribute('aria-pressed')).toBe('true');
    expect(levelButton('Level 1').getAttribute('aria-pressed')).toBe('true');
    expect(page.activeFilterCount()).toBe(2);
    controls.componentInstance.filtersOpen.set(false); fixture.detectChanges();
    controls.componentInstance.filtersOpen.set(true); fixture.detectChanges();
    expect(page.spellLevelFilters()).toEqual([0, 1]);
    levelButton('Cantrips').click(); fixture.detectChanges();
    expect(page.spells().map(spell => spell.name)).toEqual(['Shield']);
    levelButton('Level 1').click(); fixture.detectChanges();
    expect(page.spells()).toHaveLength(3); expect(levelButton('All').getAttribute('aria-pressed')).toBe('true');
    levelButton('Level 2').click(); levelButton('All').click(); fixture.detectChanges();
    expect(page.spellLevelFilters()).toEqual([]); expect(page.spells()).toHaveLength(3);
  });

  it.each([SpellsPageComponent, FeaturesPageComponent, EquipmentPageComponent, MonstersPageComponent])(
    'retains search and filters through disclosure and clears without editing the sheet in %s', component => {
      const fixture = TestBed.createComponent<{ searchQuery: Signal<string> }>(component);
      const sheet = emptyBasicCharacter();
      fixture.componentRef.setInput('characterData', sheet); fixture.detectChanges();
      const before = JSON.stringify(sheet);
      const controls = fixture.debugElement.query(By.directive(ListControlsComponent));
      const toolbar = controls.componentInstance as ListControlsComponent;
      const panel = controls.nativeElement.querySelector('[id$="-filters"]') as HTMLElement;
      const toggle = controls.nativeElement.querySelector('button[aria-expanded]') as HTMLButtonElement;
      expect(panel.hidden).toBe(true);
      const input = controls.nativeElement.querySelector('input') as HTMLInputElement;
      input.value = 'Session search'; input.dispatchEvent(new Event('input', { bubbles: true }));
      fixture.detectChanges();
      expect(fixture.componentInstance.searchQuery()).toBe('Session search');
      toggle.click(); fixture.detectChanges(); expect(panel.hidden).toBe(false);
      toggle.click(); fixture.detectChanges(); expect(panel.hidden).toBe(true);
      expect(toolbar.query()).toBe('Session search');
      controls.nativeElement.querySelector('[aria-label="Clear filters and search"]').click();
      fixture.detectChanges(); expect(fixture.componentInstance.searchQuery()).toBe('');
      expect(JSON.stringify(sheet)).toBe(before);
    },
  );

  it('shows active spell filters while closed and restores results through Clear', () => {
    const fixture = TestBed.createComponent(SpellsPageComponent);
    fixture.componentRef.setInput('characterData', emptyBasicCharacter()); fixture.detectChanges();
    const page = fixture.componentInstance;
    page.searchQuery.set('missing'); page.spellLevelFilters.set([9]);
    page.spellRitualFilter.set('RITUAL'); page.spellCastingSourceFilter.set('Wizard');
    fixture.detectChanges();
    const toggle = fixture.nativeElement.querySelector('app-list-controls button[aria-expanded]');
    expect(toggle.textContent).toContain('(2)'); expect(toggle.getAttribute('aria-expanded')).toBe('false');
    fixture.nativeElement.querySelector('[aria-label="Clear filters and search"]').click(); fixture.detectChanges();
    expect(page.activeFilterCount()).toBe(0); expect(page.searchQuery()).toBe('');
    expect(page.spellLevelFilters()).toEqual([]); expect(page.spellRitualFilter()).toBe('ALL');
    expect(page.spellCastingSourceFilter()).toBe('Wizard');
  });

  it('treats feature sources as context rather than active filters and retains them on Clear', () => {
    const fixture = TestBed.createComponent(FeaturesPageComponent);
    fixture.componentRef.setInput('characterData', emptyBasicCharacter()); fixture.detectChanges();
    const page = fixture.componentInstance;
    page.featureSourceFilter.set('Wizard'); fixture.detectChanges();
    expect(page.activeFilterCount()).toBe(0);
    expect(fixture.nativeElement.querySelector('app-list-controls button[aria-expanded]').textContent).not.toContain('(1)');
    page.featureTypeFilter.set('FEAT'); page.searchQuery.set('test'); fixture.detectChanges();
    expect(page.activeFilterCount()).toBe(0);
    fixture.nativeElement.querySelector('[aria-label="Clear filters and search"]').click(); fixture.detectChanges();
    expect(page.activeFilterCount()).toBe(0); expect(page.featureSourceFilter()).toBe('Wizard');
  });
});
