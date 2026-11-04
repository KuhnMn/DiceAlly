import { TestBed } from '@angular/core/testing';
import { OverlayContainer } from '@angular/cdk/overlay';
import { ItemRuleTagComponent } from './item-rule-tag.component';
import { itemRuleEntries } from '../content/item-resolver';

describe('Item rule tags', () => {
  it('puts the item-specific range in the tag and keeps only the authored rule in the tooltip without changing saved entries', () => {
    const entry = { type: 'entries', entries: ['Thrown (20/60 ft.)',
      { type: 'entries', name: 'Thrown', entries: ['Throw the weapon to make a ranged attack.'] }] };
    const before=JSON.stringify(entry);
    const fixture=TestBed.createComponent(ItemRuleTagComponent);
    fixture.componentRef.setInput('label','Thrown');fixture.componentRef.setInput('entry',entry);fixture.detectChanges();
    const button=fixture.nativeElement.querySelector('button') as HTMLButtonElement;
    expect(button.textContent).toBe('Thrown (20/60 ft.)');
    button.click();fixture.detectChanges();
    const tooltip=TestBed.inject(OverlayContainer).getContainerElement().querySelector('[role="tooltip"]')!;
    expect(tooltip.textContent).toContain('Throw the weapon to make a ranged attack.');
    expect(tooltip.textContent).not.toContain('20/60');
    expect(tooltip.querySelectorAll('.font-semibold')).toHaveLength(1);
    expect(tooltip.querySelector('strong')).toBeNull();
    expect(JSON.stringify(entry)).toBe(before);
    fixture.componentRef.setInput('entry',{...entry,entries:['Thrown (30/90 ft.)',entry.entries[1]]});fixture.detectChanges();
    expect(button.textContent).toBe('Thrown (30/90 ft.)');
    fixture.destroy();
  });
  it('renders ammunition references in the tag and avoids an empty tooltip when there is only a summary', () => {
    const entries=itemRuleEntries({kind:'itemProperty',key:'ammo',name:'Ammunition',publication:'XDMG',file:'test.json',links:[],
      data:{template:'{{prop_name}} ({{item.range}} ft.; {{item.ammoType}})'}}, {range:'120/360',ammoType:'energy cell|xdmg'});
    const fixture=TestBed.createComponent(ItemRuleTagComponent);
    fixture.componentRef.setInput('label','Ammunition');fixture.componentRef.setInput('entry',{type:'entries',entries});fixture.detectChanges();
    const button=fixture.nativeElement.querySelector('button') as HTMLButtonElement;
    expect(button.textContent).toBe('Ammunition (120/360 ft.; Energy Cell)');
    expect(button.textContent).not.toContain('{@');expect(button.textContent).not.toContain('|xdmg');
    button.click();fixture.detectChanges();
    expect(button.getAttribute('aria-expanded')).toBe('false');
    expect(TestBed.inject(OverlayContainer).getContainerElement().querySelector('[role="tooltip"]')).toBeNull();
    fixture.destroy();
  });
  it('keeps prose and named sections in the tooltip instead of treating their opening text as a tag summary', () => {
    const fixture=TestBed.createComponent(ItemRuleTagComponent);
    fixture.componentRef.setInput('label','Thrown');
    fixture.componentRef.setInput('entry',{type:'entries',name:'Special Rule',entries:['Thrown weapons can be used at range (see below)']});
    fixture.detectChanges();const button=fixture.nativeElement.querySelector('button') as HTMLButtonElement;
    expect(button.textContent).toBe('Thrown');button.click();fixture.detectChanges();
    const tooltip=TestBed.inject(OverlayContainer).getContainerElement().querySelector('[role="tooltip"]')!;
    expect(tooltip.textContent).toContain('Special Rule');
    expect(tooltip.textContent).toContain('Thrown weapons can be used at range (see below)');
    fixture.destroy();
  });
  it('shows item-specific notes even when no shared rule description is saved', () => {
    const fixture = TestBed.createComponent(ItemRuleTagComponent);
    fixture.componentRef.setInput('label', 'Push');
    fixture.componentRef.setInput('notes', ['Only with both hands']);
    fixture.detectChanges(); fixture.nativeElement.querySelector('button').click(); fixture.detectChanges();
    expect(TestBed.inject(OverlayContainer).getContainerElement().textContent).toContain('Only with both hands');
    fixture.destroy();
  });
  it('shows the rule on hover, focus and tap and dismisses it with Escape', () => {
    const fixture = TestBed.createComponent(ItemRuleTagComponent);
    fixture.componentRef.setInput('label', 'Finesse');
    fixture.componentRef.setInput('entry', { text: 'Use Strength or Dexterity.' });
    fixture.detectChanges();
    const button = fixture.nativeElement.querySelector('button') as HTMLButtonElement;
    const overlay = TestBed.inject(OverlayContainer).getContainerElement();
    button.dispatchEvent(new MouseEvent('mouseenter')); fixture.detectChanges();
    expect(overlay.textContent).toContain('Use Strength or Dexterity.');
    button.dispatchEvent(new MouseEvent('mouseleave')); fixture.detectChanges();
    expect(overlay.textContent).not.toContain('Use Strength or Dexterity.');
    button.dispatchEvent(new FocusEvent('focus')); fixture.detectChanges();
    expect(overlay.textContent).toContain('Use Strength or Dexterity.');
    button.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })); fixture.detectChanges();
    expect(overlay.textContent).not.toContain('Use Strength or Dexterity.');
    button.click(); fixture.detectChanges();
    expect(overlay.textContent).toContain('Use Strength or Dexterity.');
    fixture.destroy();
  });
});
