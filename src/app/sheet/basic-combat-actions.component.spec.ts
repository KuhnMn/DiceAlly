import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { OverlayContainer } from '@angular/cdk/overlay';
import { CharacterInfoPageComponent } from './character-info-page.component';
import { MobileCombatPageComponent } from './mobile-combat-page.component';
import { RuleReferenceComponent } from './rule-reference.component';
import { emptyBasicCharacter } from '../editor/basic-info';
import type { BasicActionDescription } from '../models/character-references';

const actions: BasicActionDescription[] = [
  { name: 'Attack', source: 'XPHB', entries: ['Make an attack.'], actionTypes: ['ACTION'] },
  { name: 'Two-Weapon Fighting', source: 'XPHB', entries: ['Make an extra attack.'], actionTypes: ['BONUS'] },
  { name: 'Opportunity Attack', source: 'XPHB', entries: ['React to a departing enemy.'], actionTypes: ['REACTION'] },
];

describe('Basic actions in combat', () => {
  it.each([CharacterInfoPageComponent, MobileCombatPageComponent])('keeps collapsed Basic groups visible without character actions in %s', component => {
    const fixture = TestBed.createComponent(component), sheet = emptyBasicCharacter();
    sheet.basicActions = structuredClone(actions);
    fixture.componentRef.setInput('characterData', sheet); fixture.detectChanges();
    const groups = fixture.nativeElement.querySelectorAll('app-basic-combat-actions') as NodeListOf<HTMLElement>;
    expect(groups.length).toBe(3);
    expect([...groups].every(group => group.querySelector('summary')?.textContent === 'Basic')).toBe(true);
    expect([...groups].every(group => !group.querySelector('details')!.open)).toBe(true);
    expect(fixture.nativeElement.textContent).not.toContain('No combat actions');
    for (const group of groups) {
      const row = group.querySelector('app-rule-reference')!;
      expect(row.querySelectorAll('button').length).toBe(1);
      expect(row.querySelector('span.border-tertiary')).not.toBeNull();
    }
  });

  it('puts Basic before authored actions and opens help only from the info control', () => {
    const fixture = TestBed.createComponent(CharacterInfoPageComponent), sheet = emptyBasicCharacter();
    sheet.basicActions = structuredClone(actions);
    sheet.combatActions = [{ name: 'My Action', actionType: 'ACTION' }];
    const before = structuredClone(sheet);
    fixture.componentRef.setInput('characterData', sheet); fixture.detectChanges();
    const group = fixture.nativeElement.querySelector('app-basic-combat-actions') as HTMLElement;
    expect(group.parentElement!.textContent!.indexOf('Basic')).toBeLessThan(group.parentElement!.textContent!.indexOf('My Action'));
    const reference = fixture.debugElement.queryAll(By.directive(RuleReferenceComponent))
      .map(node => node.componentInstance as RuleReferenceComponent).find(reference => reference.appearance() === 'combat')!;
    reference.desktop.set(true); fixture.detectChanges();
    const info = group.querySelector('button')!;
    group.querySelector('span.border-tertiary')!.dispatchEvent(new MouseEvent('mouseenter')); fixture.detectChanges();
    const overlay = TestBed.inject(OverlayContainer).getContainerElement();
    expect(overlay.querySelector('[role="tooltip"]')).toBeNull();
    info.dispatchEvent(new MouseEvent('mouseenter')); fixture.detectChanges();
    expect(overlay.querySelector('[role="tooltip"]')?.textContent).toContain('Make an attack.');
    reference.close(); reference.desktop.set(false); fixture.detectChanges();
    info.click(); fixture.detectChanges();
    expect(group.querySelector('dialog')?.textContent).toContain('Make an attack.');
    expect(sheet).toEqual(before);
  });
});
