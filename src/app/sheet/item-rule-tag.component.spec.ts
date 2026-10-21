import { TestBed } from '@angular/core/testing';
import { OverlayContainer } from '@angular/cdk/overlay';
import { ItemRuleTagComponent } from './item-rule-tag.component';

describe('Item rule tags', () => {
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
