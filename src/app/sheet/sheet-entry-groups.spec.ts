import { TestBed } from '@angular/core/testing';
import { FeaturesPageComponent } from './features-page.component';
import { EquipmentPageComponent } from './equipment-page.component';

describe('Viewer list separators', () => {
  it('groups features by numeric level and feats and optional features by type without duplicating entries', () => {
    const fixture = TestBed.createComponent(FeaturesPageComponent);
    fixture.componentRef.setInput('characterData', { character: {}, features: [
      { name: 'Later feature', featureEntity: { level: 10 } },
      { name: 'Early feature', featureEntity: { level: 2 } },
      { name: 'Origin feat', featEntity: { category: 'O' } },
      { name: 'General feat', featEntity: { category: 'G' } },
      { name: 'Optional choice', optionalFeatureEntity: { featureType: ['MM', 'EI'] } },
      { name: 'Another choice', optionalFeatureEntity: { featureType: ['EI', 'MM'] } },
    ] });
    fixture.detectChanges();
    const page = fixture.componentInstance;
    expect(page.featureGroups().map(group => group.label)).toEqual(['Class Features \u00b7 Level 2', 'Class Features \u00b7 Level 10']);
    expect(fixture.nativeElement.querySelector('[aria-label="Feature class filters"]')).toBeNull();
    page.setFeatureView('FEAT'); fixture.detectChanges();
    expect(page.featureGroups().map(group => group.label)).toEqual(['Feats \u00b7 G', 'Feats \u00b7 O']);
    expect(page.activeFilterCount()).toBe(0);
    expect(fixture.nativeElement.querySelector('[aria-label="Feature level filters"]')).toBeNull();
    page.featureCategoriesFilter.set(['O']); fixture.detectChanges();
    expect(page.featureGroups().map(group => group.label)).toEqual(['Feats \u00b7 O']);
    expect(page.activeFilterCount()).toBe(1);
    page.clearFilters(); expect(page.featureTypeFilter()).toBe('FEAT');
    page.setFeatureView('OPTIONAL_FEATURE'); fixture.detectChanges();
    expect(page.featureGroups()).toHaveLength(1);
    expect(page.featureGroups()[0].features).toHaveLength(2);
    expect(page.featureCategoryOptions()).toEqual(['EI', 'MM']);
    expect(fixture.nativeElement.querySelector('[aria-label="Feature level filters"]')).toBeNull();
    expect(fixture.nativeElement.querySelector('[aria-label="Feature class filters"]')).toBeNull();
  });

  it('groups items by type, retains inventory order within groups and hides filtered groups', () => {
    const fixture = TestBed.createComponent(EquipmentPageComponent);
    fixture.componentRef.setInput('characterData', { character: {}, inventory: [
      { name: 'Sword', isEquipped: true, entity: { item: {}, itemType: 'Weapon' } },
      { name: 'Potion', entity: { item: {}, itemType: 'Potion' } },
      { name: 'Axe', entity: { item: {}, itemType: 'Weapon' } },
      { name: 'Keepsake', isDummy: true },
      { name: 'Unknown item' },
    ] });
    fixture.detectChanges();
    const groups = fixture.componentInstance.inventoryGroups();
    expect(groups.map(group => group.label)).toEqual(['Custom Items', 'Other Items', 'Potion', 'Weapon']);
    expect(groups.find(group => group.label === 'Weapon')?.items.map(item => item.name)).toEqual(['Sword', 'Axe']);
    expect(fixture.nativeElement.querySelectorAll('section > h4').length).toBe(4);
    fixture.componentInstance.inventoryFilter.set('equipped'); fixture.detectChanges();
    expect(fixture.componentInstance.inventoryGroups().map(group => group.label)).toEqual(['Weapon']);
  });
});
