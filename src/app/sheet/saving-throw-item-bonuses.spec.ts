import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { emptyBasicCharacter } from '../editor/basic-info';
import { InventoryItem } from '../models/character.model';
import { CharacterHelpersService } from './character-helpers.service';
import { CharacterInfoPageComponent } from './character-info-page.component';
import { MobileCharacterInfoPageComponent } from './mobile-character-info-page.component';

function item(name: string, bonusSavingThrow: string, overrides: Partial<InventoryItem> = {}): InventoryItem {
  return { name, source: 'XDMG', isEquipped: true, isAttuned: true,
    entity: { item: { name, source: 'XDMG', reqAttune: 'by anyone', bonusSavingThrow } }, ...overrides };
}

function sheet() {
  const data = emptyBasicCharacter();
  Object.assign(data.character!, { level: 5, calculateSavingThrowBonuses: true,
    abilityScores: { ...data.character!.abilityScores, wisdom: 16 },
    proficiencies: { savingThrows: ['WIS'], saveMiscBonuses: { wis: -1 } } });
  data.inventory = [item('Ring of Protection', '+1'), item('Cloak of Protection', '+2')];
  return data;
}

describe('Automatic item saving throw bonuses', () => {
  beforeEach(() => TestBed.configureTestingModule({ providers: [provideRouter([])] }));

  it('adds active numeric bonuses to ability, proficiency and manual bonuses and explains each contribution', () => {
    const data = sheet(), helpers = TestBed.inject(CharacterHelpersService);
    const result = helpers.savingThrowCalculation(data.character!, 'wisdom', data.inventory!);
    expect(result.value).toBe(8);
    expect(result.source).toBe('Wisdom Modifier (+3) + Proficiency (+3) + Manual Bonus (-1) + Ring of Protection (+1) + Cloak of Protection (+2) = +8');
    expect(helpers.savingThrowValue(data.character!, 'strength', data.inventory!)).toBe(3);
    expect(helpers.savingThrowValue(data.character!, 'WIS', data.inventory!)).toBe(8);
  });

  it('only applies equipped items with required attunement, ignoring formulas and prose', () => {
    const data = sheet(), helpers = TestBed.inject(CharacterHelpersService);
    data.inventory = [item('Unequipped', '+5', { isEquipped: false }), item('Unattuned', '+5', { isAttuned: false }),
      item('Formula', '+PB'), item('Conditional', '+2 against spells'), item('Zero', '0'), item('Malformed', '1.5'),
      item('Penalty', '-1'), item('No Attunement', ' +2 ', { isAttuned: false,
        entity: { item: { name: 'No Attunement', source: 'XDMG', reqAttune: null, bonusSavingThrow: ' +2 ' } } })];
    const before = JSON.stringify(data);
    const result = helpers.savingThrowCalculation(data.character!, 'wisdom', data.inventory);
    expect(result.value).toBe(6);
    expect(result.itemBonuses.map(bonus => bonus.name)).toEqual(['Penalty', 'No Attunement']);
    expect(JSON.stringify(data)).toBe(before);
  });

  it('preserves manual totals when disabled or absent on older characters', () => {
    const data = sheet(), helpers = TestBed.inject(CharacterHelpersService);
    for (const enabled of [false, undefined]) {
      data.character!.calculateSavingThrowBonuses = enabled;
      expect(helpers.savingThrowValue(data.character!, 'wisdom', data.inventory!)).toBe(5);
      expect(helpers.savingThrowCalculation(data.character!, 'wisdom', data.inventory!).itemBonuses).toEqual([]);
    }
  });

  for (const page of [CharacterInfoPageComponent, MobileCharacterInfoPageComponent]) {
    it(`shows an equipment icon before proficiency and updates totals on ${page.name}`, () => {
      const fixture = TestBed.createComponent(page), data = sheet();
      fixture.componentRef.setInput('characterData', data); fixture.detectChanges();
      const root = fixture.nativeElement as HTMLElement;
      const value = () => root.querySelector('[aria-label^="wisdom saving throw "]')!;
      expect(value().textContent).toBe('+8');
      const save = value().closest('app-sheet-saving-throw')!;
      const equipment = save.querySelector('[aria-label^="Equipment bonuses apply"]')!;
      expect(save.querySelector('[title]')).toBeNull();
      const trigger = save.querySelector<HTMLElement>('[tabindex="0"]')!;
      trigger.dispatchEvent(new MouseEvent('mouseenter')); fixture.detectChanges();
      const tooltip = document.querySelector('[role="tooltip"]')!;
      expect(tooltip.textContent).toContain('Ring of Protection (+1)');
      expect(tooltip.textContent).toContain('Cloak of Protection (+2)');
      expect(trigger.getAttribute('aria-describedby')).toBe(tooltip.id);
      trigger.dispatchEvent(new MouseEvent('mouseleave')); fixture.detectChanges();
      expect(document.querySelector('[role="tooltip"]')).toBeNull();
      trigger.dispatchEvent(new FocusEvent('focusin')); fixture.detectChanges();
      expect(document.querySelector('[role="tooltip"]')).not.toBeNull();
      trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); fixture.detectChanges();
      expect(document.querySelector('[role="tooltip"]')).toBeNull();
      expect(equipment.nextElementSibling?.getAttribute('aria-label')).toBe('Proficient');

      fixture.componentRef.setInput('characterData', { ...data, inventory: data.inventory!.map(entry => ({ ...entry, isEquipped: false })) }); fixture.detectChanges();
      expect(value().textContent).toBe('+5');
      expect(save.querySelector('[aria-label^="Equipment bonuses apply"]')).toBeNull();

      fixture.componentRef.setInput('characterData', { ...data, character: { ...data.character, calculateSavingThrowBonuses: false } }); fixture.detectChanges();
      expect(value().textContent).toBe('+5');
      expect(save.querySelector('[aria-label^="Equipment bonuses apply"]')).toBeNull();
      fixture.destroy();
    });
  }
});
