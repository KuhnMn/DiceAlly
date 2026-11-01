import { TestBed } from '@angular/core/testing';
import { WizardResourcesComponent } from './wizard-resources.component';
import { emptyBasicCharacter } from './basic-info';
import { WizardState } from './wizard-prefill';
import { seedResourceImports, WizardResourceColumn, wizardResourceValues } from './wizard-resources';

describe('Wizard resource mapping', () => {
  it('selects a counter and explicitly joins its dice reminder without importing unrelated columns', async () => {
    const sheet = emptyBasicCharacter();
    const state: WizardState = { revisionId: 'test', classes: [], answers: {}, options: {resourceReminders:true}, baseline: [], protectedPaths: [],
      resourceImports:{die:{enabled:false,name:'Inherited resource'}} };
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
    const reminder=fixture.nativeElement.querySelector('[aria-label="Reminder for Number"]') as HTMLSelectElement;
    expect([...reminder.options].map(option=>option.value)).toEqual(['','die']);
    reminder.value='die';reminder.dispatchEvent(new Event('change'));await fixture.whenStable();
    const name=fixture.nativeElement.querySelector('input:not([type="checkbox"])') as HTMLInputElement;
    expect(name.value).toBe('Inherited resource');
    for (const draft of ['', 'Psionic ', 'Number', 'Psionic Energy']) {
      name.value=draft;name.dispatchEvent(new Event('input'));await fixture.whenStable();
      expect(name.value).toBe(draft);
      expect(state.resourceImports!['count'].name).toBe(draft);
      if (!draft) expect(wizardResourceValues(sheet,state,columns)[0].value).toMatchObject({name:'Inherited resource'});
    }
    const recovery=fixture.nativeElement.querySelector('[aria-label="Recovery for Number"]') as HTMLSelectElement;
    recovery.value='SHORT_REST';recovery.dispatchEvent(new Event('change'));await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('[aria-label="Import Soulknife: Die Size"]').disabled).toBe(true);
    expect(wizardResourceValues(sheet,state,columns).map(entry=>entry.value)).toEqual([
      expect.objectContaining({id:'count',name:'Psionic Energy',total:4,note:'D6',mode:'both',recovery:'SHORT_REST'}),
    ]);
    fixture.destroy();
  });
  it('prefills current editor settings on reopen and keeps changes made inside the wizard', async () => {
    const sheet=emptyBasicCharacter();
    const columns: WizardResourceColumn[]=[{id:'count',sourceId:'rogue',owner:'Rogue',table:'Resources',name:'Number',kind:'counter',value:6}];
    sheet.resources=[{id:'count',sourceId:'rogue',name:'Editor name',mode:'counter',note:'',total:4,used:2,recovery:'SHORT_REST',features:true,spells:false}];
    sheet.creatorWizard={revisionId:'test',classes:[],answers:{},options:{resourceReminders:true},baseline:[],protectedPaths:[],
      resourceImports:{count:{enabled:true,name:'Previous wizard name',recovery:'LONG_REST'}}};
    const state=structuredClone(sheet.creatorWizard);
    seedResourceImports(sheet,state,columns);
    const fixture=TestBed.createComponent(WizardResourcesComponent);
    fixture.componentRef.setInput('sheet',sheet);fixture.componentRef.setInput('state',state);fixture.componentRef.setInput('columns',columns);
    await fixture.whenStable();
    const name=fixture.nativeElement.querySelector('input:not([type="checkbox"])') as HTMLInputElement;
    const recovery=fixture.nativeElement.querySelector('[aria-label="Recovery for Number"]') as HTMLSelectElement;
    expect(name.value).toBe('Editor name');expect(recovery.value).toBe('SHORT_REST');
    recovery.value='LONG_REST';recovery.dispatchEvent(new Event('change'));await fixture.whenStable();
    expect(recovery.value).toBe('LONG_REST');expect(state.resourceImports!['count'].recovery).toBe('LONG_REST');
    const next=wizardResourceValues(sheet,state,columns)[0].value;
    expect(next).toMatchObject({name:'Editor name',total:6,recovery:'LONG_REST'});
    expect(sheet.resources[0].recovery).toBe('SHORT_REST');
    fixture.destroy();
  });
});
