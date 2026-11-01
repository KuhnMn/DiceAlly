import { TestBed } from '@angular/core/testing';
import { ResourceUseComponent } from './resource-use.component';
import { CharacterStore } from '../stores/character.store';
import { emptyBasicCharacter } from '../editor/basic-info';
import { ResourceCost } from '../models/source-resources';

function setup(links: ResourceCost[]) {
  const sheet=emptyBasicCharacter();
  sheet.resources=[
    {id:'focus',sourceId:'source',name:'Focus',mode:'counter',note:'',total:8,used:3,recovery:'SHORT_REST',features:true,spells:false},
    {id:'psi',sourceId:'source',name:'Psionic Energy',mode:'both',note:'d6',total:6,used:0,recovery:'LONG_REST',features:true,spells:false},
  ];
  const store=TestBed.inject(CharacterStore);store.setCharacter(sheet);
  const fixture=TestBed.createComponent(ResourceUseComponent);
  fixture.componentRef.setInput('sheet',sheet);fixture.componentRef.setInput('links',links);fixture.detectChanges();
  return {sheet,store,fixture,control:fixture.componentInstance};
}
describe('Resource use control',()=>{
  it('shows one linked pool without a dropdown and spends its exact cost using the latest balance',()=>{
    const {fixture,store}=setup([{resourceId:'focus',amount:2}]);
    expect(fixture.nativeElement.querySelector('select')).toBeNull();
    expect(fixture.nativeElement.querySelector('output').textContent).toContain('Focus');
    expect(fixture.nativeElement.querySelector('output').textContent).toContain('5/8');
    const button=fixture.nativeElement.querySelector('button') as HTMLButtonElement;
    expect(button.textContent).toContain('(2)');
    expect(button.getAttribute('aria-label')).toBe('Use 2 Focus');
    button.click();fixture.detectChanges();
    expect(store.characterData()!.resources![0].used).toBe(5);
    expect(fixture.nativeElement.querySelector('output').textContent).toContain('3/8');
    button.click();fixture.detectChanges();
    expect(store.characterData()!.resources![0].used).toBe(7);expect(button.disabled).toBe(true);
    button.click();expect(store.characterData()!.resources![0].used).toBe(7);
    fixture.destroy();
  });
  it('selects among linked pools, retains that selection after spending and refuses removed links',()=>{
    const links=[{resourceId:'focus',amount:2},{resourceId:'psi',amount:3}];
    const {fixture,store,control}=setup(links);
    const longName='Psionic Energy Dice with a very long custom resource name';
    const current=store.characterData()!;
    store.setCharacter({...current,resources:current.resources!.map(resource=>resource.id==='psi'?{...resource,name:longName}:resource)});
    fixture.detectChanges();
    const select=fixture.nativeElement.querySelector('select') as HTMLSelectElement;
    expect(select.options).toHaveLength(2);
    expect(select.options[1].textContent).toContain('… · 6/6');
    expect(select.options[1].getAttribute('aria-label')).toContain(longName);
    expect(select.options[1].textContent).not.toContain('Cost');
    select.value='psi';select.dispatchEvent(new Event('change'));fixture.detectChanges();
    const button=fixture.nativeElement.querySelector('button') as HTMLButtonElement;
    expect(button.textContent).toContain('(3)');
    expect(button.getAttribute('aria-label')).toBe('Use 3 '+longName);
    button.click();fixture.detectChanges();
    expect(store.characterData()!.resources!.map(resource=>resource.used)).toEqual([3,3]);
    expect(select.value).toBe('psi');expect(select.selectedOptions[0].textContent).toContain('3/6');
    button.click();fixture.detectChanges();expect(button.disabled).toBe(true);
    expect(store.characterData()!.resources![1].used).toBe(6);
    fixture.componentRef.setInput('links',[links[0]]);fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('select')).toBeNull();
    expect(fixture.nativeElement.querySelector('output').textContent).toContain('Focus');
    control.use(links[1]);expect(store.characterData()!.resources![1].used).toBe(6);
    fixture.nativeElement.querySelector('button').click();expect(store.characterData()!.resources![0].used).toBe(5);
    fixture.destroy();
  });
  it('disables missing and reminder-only pools and guards against switching characters',()=>{
    const {fixture,store,control}=setup([{resourceId:'missing',amount:1},{resourceId:'psi',amount:1}]);
    const button=fixture.nativeElement.querySelector('button') as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    const current=store.characterData()!;
    store.setCharacter({...current,resources:current.resources!.map(resource=>({...resource,mode:'note'}))});
    control.select('psi');fixture.detectChanges();expect(button.disabled).toBe(true);
    const other=emptyBasicCharacter();store.setCharacter(other);
    control.use();expect(store.characterData()).toBe(other);
    fixture.destroy();
  });
});
