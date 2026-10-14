import { TestBed } from '@angular/core/testing';
import { emptyBasicCharacter } from './basic-info';
import { FeatureSourcePickerComponent } from './feature-source-picker.component';

describe('Shared source picker', () => {
  it('uses the same options for filter cards and searchable assignment, without assigning All', async () => {
    const fixture = TestBed.createComponent(FeatureSourcePickerComponent);
    fixture.componentRef.setInput('character', emptyBasicCharacter().character);
    fixture.componentRef.setInput('sources', [{ name: 'Wizard' }, { name: 'Cleric' }]);
    fixture.componentRef.setInput('value', 'Wizard');
    await fixture.whenStable();
    const picker = fixture.componentInstance;
    expect(picker.options.map(option => option.value)).toEqual(['ALL', 'Wizard', 'Cleric']);
    fixture.componentRef.setInput('mode', 'dropdown');
    fixture.componentRef.setInput('allowUnassigned', true);
    await fixture.whenStable();
    expect(picker.options.map(option => option.value)).toEqual(['', 'Wizard', 'Cleric']);
    const selected: string[] = [];
    picker.selected.subscribe(value => selected.push(value));
    fixture.nativeElement.querySelector('app-searchable-select button').click(); await fixture.whenStable();
    const input = fixture.nativeElement.querySelector('input') as HTMLInputElement;
    input.value = 'Cleric'; input.dispatchEvent(new Event('input', { bubbles: true }));
    await fixture.whenStable();
    fixture.nativeElement.querySelector('[role="option"]').click(); await fixture.whenStable();
    expect(selected).toEqual(['Cleric']);
    expect(fixture.nativeElement.querySelector('[role="dialog"]')).toBeNull();
  });

  it('retains an existing missing source while excluding Unassigned for spell-slot assignment', async () => {
    const fixture = TestBed.createComponent(FeatureSourcePickerComponent);
    fixture.componentRef.setInput('character', emptyBasicCharacter().character);
    fixture.componentRef.setInput('sources', [{ name: 'Wizard' }]);
    fixture.componentRef.setInput('mode', 'dropdown');
    fixture.componentRef.setInput('value', 'Legacy Source');
    await fixture.whenStable();
    expect(fixture.componentInstance.options.map(option => option.value)).toEqual(['Wizard', 'Legacy Source']);
    expect(fixture.nativeElement.textContent).toContain('Legacy Source');
  });

  it('disables assignment while a bulk spell addition is in progress', async () => {
    const fixture = TestBed.createComponent(FeatureSourcePickerComponent);
    fixture.componentRef.setInput('character', emptyBasicCharacter().character);
    fixture.componentRef.setInput('sources', [{ name: 'Wizard' }]);
    fixture.componentRef.setInput('mode', 'dropdown');
    fixture.componentRef.setInput('disabled', true);
    await fixture.whenStable();
    const trigger = fixture.nativeElement.querySelector('app-searchable-select button') as HTMLButtonElement;
    expect(fixture.componentInstance.options.map(option => option.value)).toEqual(['Wizard']);
    expect(trigger.disabled).toBe(true);
    trigger.click(); await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('[role="dialog"]')).toBeNull();
  });
});
