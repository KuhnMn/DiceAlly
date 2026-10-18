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
    const groups = fixture.componentInstance.featureGroups();
    expect(groups.map(group => group.label)).toEqual([
      'Class Features · Level 2', 'Class Features · Level 10', 'Feats · G', 'Feats · O', 'Optional Features · EI, MM',
    ]);
    expect(groups.flatMap(group => group.features)).toHaveLength(6);
    expect(fixture.nativeElement.querySelectorAll('section > h4').length).toBe(5);
    fixture.componentInstance.searchQuery.set('Origin'); fixture.detectChanges();
    expect(fixture.componentInstance.featureGroups().map(group => group.label)).toEqual(['Feats · O']);
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
