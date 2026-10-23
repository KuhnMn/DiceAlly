import { TestBed } from '@angular/core/testing';
import { CharacterInfoPageComponent } from './character-info-page.component';
import { MobileCombatPageComponent } from './mobile-combat-page.component';
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
      const row = group.querySelector('button')!;
      expect(row.disabled).toBe(false);
      expect(group.querySelector('span.border-tertiary')).not.toBeNull();
    }
  });

  it.each([CharacterInfoPageComponent, MobileCombatPageComponent])('opens the description from the whole Basic row in %s without changing the sheet', component => {
    const fixture = TestBed.createComponent(component), sheet = emptyBasicCharacter();
    sheet.basicActions = structuredClone(actions);
    sheet.combatActions = [{ name: 'My Action', actionType: 'ACTION' }];
    const before = structuredClone(sheet);
    fixture.componentRef.setInput('characterData', sheet); fixture.detectChanges();
    const group = fixture.nativeElement.querySelector('app-basic-combat-actions') as HTMLElement;
    expect(group.parentElement!.textContent!.indexOf('Basic')).toBeLessThan(group.parentElement!.textContent!.indexOf('My Action'));
    const row = group.querySelector('button')!;
    row.querySelector('span')!.click(); fixture.detectChanges();
    expect(group.querySelector('dialog')?.textContent).toContain('Make an attack.');
    group.querySelector('dialog')!.dispatchEvent(new Event('close')); fixture.detectChanges();
    row.querySelector('app-ui-icon')!.dispatchEvent(new MouseEvent('click', { bubbles: true })); fixture.detectChanges();
    expect(group.querySelector('dialog')?.textContent).toContain('Make an attack.');
    expect(sheet).toEqual(before);
    fixture.destroy();
  });
});
