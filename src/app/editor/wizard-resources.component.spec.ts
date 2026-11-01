import { TestBed } from '@angular/core/testing';
import { WizardResourcesComponent } from './wizard-resources.component';
import { emptyBasicCharacter } from './basic-info';
import { WizardState } from './wizard-prefill';
import { WizardResourceColumn, wizardResourceValues } from './wizard-resources';

describe('Wizard resource mapping', () => {
  it('selects a counter and explicitly joins its dice reminder without importing unrelated columns', async () => {
    const sheet = emptyBasicCharacter();
    const state: WizardState = { revisionId: 'test', classes: [], answers: {}, options: {resourceReminders:true}, baseline: [], protectedPaths: [] };
    const columns: WizardResourceColumn[] = [
      {id:'count',sourceId:'soulknife',owner:'Soulknife',table:'Resources',name:'Number',kind:'counter',value:4},
      {id:'die',sourceId:'soulknife',owner:'Soulknife',table:'Resources',name:'Die Size',kind:'note',value:'D6'},
      {id:'cantrips',sourceId:'rogue',owner:'Rogue',table:'Class Table',name:'Cantrips Known',kind:'counter',value:2},
    ];
    const fixture=TestBed.createComponent(WizardResourcesComponent);
    fixture.componentRef.setInput('sheet',sheet); fixture.componentRef.setInput('state',state); fixture.componentRef.setInput('columns',columns);
    await fixture.whenStable();
    const counter=fixture.nativeElement.querySelector('[aria-label="Import Soulknife: Number"]') as HTMLInputElement;
    expect(counter.checked).toBe(false);
    counter.click();await fixture.whenStable();
    const reminder=fixture.nativeElement.querySelector('select') as HTMLSelectElement;
    expect([...reminder.options].map(option=>option.value)).toEqual(['','die']);
    reminder.value='die';reminder.dispatchEvent(new Event('change'));await fixture.whenStable();
    const name=fixture.nativeElement.querySelector('input:not([type="checkbox"])') as HTMLInputElement;
    name.value='Psionic Energy';name.dispatchEvent(new Event('input'));await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('[aria-label="Import Soulknife: Die Size"]').disabled).toBe(true);
    expect(wizardResourceValues(sheet,state,columns).map(entry=>entry.value)).toEqual([
      expect.objectContaining({id:'count',name:'Psionic Energy',total:4,note:'D6',mode:'both'}),
    ]);
    fixture.destroy();
  });
});
