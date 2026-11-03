import { TestBed } from '@angular/core/testing';
import { EquipmentPageComponent } from './equipment-page.component';

describe('Equipment details', () => {
  it('toggles equipped and attuned quick filters alongside search and hidden items without changing the inventory', () => {
    const fixture = TestBed.createComponent(EquipmentPageComponent);
    const sheet = { character: {}, inventory: [
      { name: 'Worn Cloak', isEquipped: true },
      { name: 'Attuned Ring', isAttuned: true },
      { name: 'Worn Ring', isEquipped: true, isAttuned: true },
      { name: 'Hidden Cloak', isEquipped: true, hidden: true },
      { name: 'Rope' },
    ] };
    const before = structuredClone(sheet);
    fixture.componentRef.setInput('characterData', sheet); fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    const button = (label: string) => root.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`)!;
    const names = () => fixture.componentInstance.visibleInventory().map(item => item.name).sort();
    const equipped = button('Show equipped items'), attuned = button('Show attuned items');
    equipped.click(); fixture.detectChanges();
    expect(names()).toEqual(['Worn Cloak', 'Worn Ring']);
    expect(equipped.getAttribute('aria-pressed')).toBe('true');
    expect(root.querySelector('app-list-controls button[aria-expanded]')!.textContent).toContain('(1)');
    attuned.click(); fixture.detectChanges();
    expect(names()).toEqual(['Attuned Ring', 'Worn Ring']);
    expect(equipped.getAttribute('aria-pressed')).toBe('false'); expect(attuned.getAttribute('aria-pressed')).toBe('true');
    attuned.click(); fixture.detectChanges();
    expect(names()).toEqual(['Attuned Ring', 'Rope', 'Worn Cloak', 'Worn Ring']);
    equipped.click(); button('Show hidden entries').click(); fixture.detectChanges();
    expect(names()).toEqual(['Hidden Cloak', 'Worn Cloak', 'Worn Ring']);
    fixture.componentInstance.searchQuery.set('cloak'); fixture.detectChanges();
    expect(names()).toEqual(['Hidden Cloak', 'Worn Cloak']);
    button('Clear filters and search').click(); fixture.detectChanges();
    expect(fixture.componentInstance.searchQuery()).toBe('');
    expect(fixture.componentInstance.inventoryFilter()).toBe('all');
    expect(equipped.getAttribute('aria-pressed')).toBe('false');
    expect(sheet).toEqual(before);
    fixture.destroy();
  });

  it('omits an empty combat-statistics row for gear while retaining its details and controls', () => {
    const fixture = TestBed.createComponent(EquipmentPageComponent);
    const item = { editorId: 'fire', name: "Alchemist's Fire", source: 'XPHB', entity: {
      itemType: 'Adventuring Gear', item: { name: "Alchemist's Fire", source: 'XPHB', rarity: 'none', weight: 1, value: 5000, entries: ['Throw the flask.'] },
    } };
    fixture.componentRef.setInput('characterData', { character: {}, inventory: [item] });
    fixture.detectChanges();
    fixture.componentInstance.toggleExpanded(fixture.componentInstance.itemKey(item)); fixture.detectChanges();
    const dialog = fixture.nativeElement.querySelector('dialog') as HTMLDialogElement;
    const summary = dialog.querySelector('[aria-label="Item summary"]')!;
    expect(summary.parentElement!.firstElementChild).toBe(summary);
    const header = dialog.querySelector('header')!;
    expect(header.textContent).toContain('Adventuring Gear');
    expect(header.textContent).toContain('XPHB');
    expect(header.textContent).not.toContain('none');
    expect(dialog.querySelector('[aria-label="Item combat statistics"]')).toBeNull();
    expect(dialog.textContent).toContain('Equipped');
    expect(dialog.textContent).toContain('Weight: 1 lb.');
    expect(dialog.textContent).toContain('Value: 50.00 gp');
    expect(dialog.textContent).toContain('Throw the flask.');
  });

  it('retains the combat summary when a weapon supplies damage and range', () => {
    const fixture = TestBed.createComponent(EquipmentPageComponent);
    const item = { editorId: 'bow', name: 'Bow', entity: { item: { name: 'Bow', source: 'XPHB', dmg1: '1d8', dmgType: 'P', range: '150/600' } } };
    fixture.componentRef.setInput('characterData', { character: {}, inventory: [item] });
    fixture.detectChanges();
    fixture.componentInstance.toggleExpanded(fixture.componentInstance.itemKey(item)); fixture.detectChanges();
    const summary = fixture.nativeElement.querySelector('dialog [aria-label="Item combat statistics"]');
    expect(summary.textContent).toContain('1d8 P');
    expect(summary.textContent).toContain('150/600 ft.');
  });

  it('formats item prices from copper pieces without changing their stored values', () => {
    const fixture = TestBed.createComponent(EquipmentPageComponent);
    fixture.componentRef.setInput('characterData', { character: {} });
    const component = fixture.componentInstance;
    for (const [value, expected] of [[5000, '50.00 gp'], [100, '1.00 gp'], [50, '5.0 sp'], [10, '1.0 sp'], [5, '5 cp'], [0, '0 cp']] as const) {
      expect(component.formatGold(value)).toBe(expected);
    }
    expect(component.formatGold(undefined)).toBe('—');
    expect(component.formatGold(Infinity)).toBe('—');
  });
});
