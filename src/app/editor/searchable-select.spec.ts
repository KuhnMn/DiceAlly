import { TestBed } from '@angular/core/testing';
import { SearchableSelectComponent } from './searchable-select.component';

describe('Shared searchable dropdown', () => {
  it('searches inside the popup, skips disabled options and restores trigger focus after selection', async () => {
    const fixture = TestBed.createComponent(SearchableSelectComponent);
    fixture.componentRef.setInput('options', [
      { value: 'disabled', label: 'Wizard (Unavailable)', disabled: true },
      { value: 'wizard', label: 'Wizard (PHB)' },
      { value: 'cleric', label: 'Cleric (PHB)' },
    ]);
    const selections: string[] = [];
    fixture.componentInstance.selected.subscribe(value => selections.push(value));
    await fixture.whenStable();
    const trigger = fixture.nativeElement.querySelector('button') as HTMLButtonElement;
    expect(fixture.nativeElement.querySelector('input')).toBeNull();
    trigger.click(); await fixture.whenStable();
    const search = fixture.nativeElement.querySelector('input') as HTMLInputElement;
    expect(document.activeElement).toBe(search);
    search.value = 'Wizard'; search.dispatchEvent(new Event('input', { bubbles: true }));
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelectorAll('[role="option"]').length).toBe(2);
    search.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    await fixture.whenStable();
    expect(selections).toEqual(['wizard']);
    expect(fixture.nativeElement.querySelector('[role="dialog"]')).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it('closes on Escape without propagating Escape to the containing wizard', async () => {
    const fixture = TestBed.createComponent(SearchableSelectComponent);
    fixture.componentRef.setInput('options', [{ value: 'tool', label: 'Tool' }]);
    await fixture.whenStable();
    fixture.nativeElement.querySelector('button').click(); await fixture.whenStable();
    let propagated = false;
    const listener = () => { propagated = true; };
    fixture.nativeElement.addEventListener('keydown', listener);
    fixture.nativeElement.querySelector('input').dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await fixture.whenStable();
    expect(fixture.componentInstance.open).toBe(false);
    expect(propagated).toBe(false);
    fixture.nativeElement.removeEventListener('keydown', listener);
  });
});
