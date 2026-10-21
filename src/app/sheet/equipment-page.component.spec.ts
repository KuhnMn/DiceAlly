import { TestBed } from '@angular/core/testing';
import { EquipmentPageComponent } from './equipment-page.component';

describe('Equipment details', () => {
  it('omits an empty combat-statistics row for gear while retaining its details and controls', () => {
    const fixture = TestBed.createComponent(EquipmentPageComponent);
    const item = { editorId: 'fire', name: "Alchemist's Fire", source: 'XPHB', entity: {
      itemType: 'Adventuring Gear', item: { name: "Alchemist's Fire", source: 'XPHB', weight: 1, value: 5000, entries: ['Throw the flask.'] },
    } };
    fixture.componentRef.setInput('characterData', { character: {}, inventory: [item] });
    fixture.detectChanges();
    fixture.componentInstance.toggleExpanded(fixture.componentInstance.itemKey(item)); fixture.detectChanges();
    const dialog = fixture.nativeElement.querySelector('dialog') as HTMLDialogElement;
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
