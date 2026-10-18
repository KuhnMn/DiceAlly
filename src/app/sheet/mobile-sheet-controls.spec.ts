import { TestBed } from '@angular/core/testing';
import { SheetAcControlComponent } from './sheet-ac-control.component';
import { MobileCharacterInfoPageComponent } from './mobile-character-info-page.component';
import { MobileSheetStatusComponent } from './mobile-sheet-status.component';

describe('Mobile sheet controls', () => {
  it('opens other movement speeds on tap and dismisses them outside or with Escape', () => {
    const fixture = TestBed.createComponent(MobileSheetStatusComponent);
    fixture.componentRef.setInput('sheet', { character: { speeds: { walk: 30, fly: 60, swim: 20, climb: 0 } } });
    fixture.detectChanges();
    const button = fixture.nativeElement.querySelector('button[aria-label^="Walking speed"]') as HTMLButtonElement;
    expect(button.textContent).toContain('30');
    expect(button.querySelector('app-ui-icon')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('[aria-label="Other speeds"]')).toBeNull();
    button.click(); fixture.detectChanges();
    const speeds = fixture.nativeElement.querySelector('[aria-label="Other speeds"]');
    expect(speeds.textContent).toContain('fly: 60 ft.');
    expect(speeds.textContent).toContain('swim: 20 ft.');
    expect(speeds.textContent).not.toContain('climb');
    expect(button.getAttribute('aria-expanded')).toBe('true');
    document.dispatchEvent(new Event('pointerdown', { bubbles: true })); fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[aria-label="Other speeds"]')).toBeNull();
    button.click(); fixture.detectChanges();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); fixture.detectChanges();
    expect(button.getAttribute('aria-expanded')).toBe('false');
  });

  it('shows walking speed without an expansion indicator when no other speeds are available', () => {
    const fixture = TestBed.createComponent(MobileSheetStatusComponent);
    fixture.componentRef.setInput('sheet', { character: { speeds: { walk: 25 } } }); fixture.detectChanges();
    const button = fixture.nativeElement.querySelector('button[aria-label^="Walking speed"]') as HTMLButtonElement;
    expect(button.textContent).toContain('25');
    expect(button.disabled).toBe(true);
    expect(button.querySelector('app-ui-icon')).toBeNull();
  });

  it('offers short and long rests from the status icon row', () => {
    const fixture = TestBed.createComponent(MobileSheetStatusComponent);
    fixture.componentRef.setInput('sheet', { character: {} }); fixture.detectChanges();
    const rests: string[] = [];
    fixture.componentInstance.shortRest.subscribe(() => rests.push('short'));
    fixture.componentInstance.longRest.subscribe(() => rests.push('long'));
    const menu = fixture.nativeElement.querySelector('details') as HTMLDetailsElement;
    expect(menu.querySelector('summary')?.getAttribute('aria-label')).toBe('Rest');
    const buttons = menu.querySelectorAll('button');
    menu.open = true; buttons[0].click();
    expect(menu.open).toBe(false);
    menu.open = true; buttons[1].click();
    expect(rests).toEqual(['short', 'long']);
    expect(menu.open).toBe(false);
  });
  it('adds a proportional temporary HP segment without overflowing or dividing by zero', () => {
    const fixture = TestBed.createComponent(MobileSheetStatusComponent);
    const character = { currentHp: 94, maxHp: 94, tempHp: 5 };
    fixture.componentRef.setInput('sheet', { character }); fixture.detectChanges();
    const component = fixture.componentInstance;
    expect(component.healthPercent()).toBeCloseTo(94 / 99 * 100);
    expect(component.temporaryHealthPercent()).toBeCloseTo(5 / 99 * 100);
    const button = fixture.nativeElement.querySelector('button[aria-label^="Adjust health"]');
    expect(button.querySelector('.bg-green')).not.toBeNull();
    expect(button.textContent).not.toContain('temp');
    expect(button.getAttribute('aria-label')).toContain('5 temporary HP');
    character.currentHp = 47;
    expect(component.healthPercent()).toBeCloseTo(47 / 99 * 100);
    character.tempHp = 0;
    expect(component.healthPercent()).toBe(50);
    expect(component.temporaryHealthPercent()).toBe(0);
    character.maxHp = 0;
    expect(component.healthPercent()).toBe(0);
    expect(component.temporaryHealthPercent()).toBe(0);
    character.tempHp = 10;
    expect(component.temporaryHealthPercent()).toBe(100);
  });
  it('edits AC on click, saves on Enter or blur, cancels on Escape, and resets to the original AC', async () => {
    const fixture = TestBed.createComponent(SheetAcControlComponent);
    const character = { armorClass: 12, armorClassOverride: null as number | null };
    fixture.componentRef.setInput('characterData', { character }); fixture.detectChanges();
    const edit = async (value: string, key?: string) => {
      fixture.nativeElement.querySelector('button[aria-label="Set armor class override"]').click(); fixture.detectChanges();
      const input = fixture.nativeElement.querySelector('input') as HTMLInputElement;
      input.value = value; input.dispatchEvent(new Event('input')); fixture.detectChanges();
      await fixture.whenStable();
      if (key) input.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
      else input.dispatchEvent(new Event('blur'));
      fixture.detectChanges();
    };
    await edit('18', 'Enter');
    expect(character.armorClassOverride).toBe(18);
    await edit('22', 'Escape');
    expect(character.armorClassOverride).toBe(18);
    await edit('16');
    expect(character.armorClassOverride).toBe(16);
    fixture.nativeElement.querySelector('button[aria-label="Reset armor class override"]').click(); fixture.detectChanges();
    expect(character.armorClassOverride).toBeNull();
    expect(fixture.componentInstance.armorClassInfo().ac).toBe(12);
  });

  it('keeps every skill visible with proficiency markers and removes inline health details', () => {
    const fixture = TestBed.createComponent(MobileCharacterInfoPageComponent);
    fixture.componentRef.setInput('characterData', { character: { abilityScores: { dexterity: 14 }, proficiencies: { skills: { STEALTH: 'PROFICIENT' } } } });
    fixture.detectChanges();
    const skills = fixture.nativeElement.querySelector('section[aria-label="Skills"]');
    expect(skills.closest('details')).toBeNull();
    expect(skills.querySelectorAll('li').length).toBe(18);
    expect(skills.querySelector('.rounded-full')).not.toBeNull();
    expect(fixture.nativeElement.textContent).not.toContain('Health details & death saves');
  });

  it('keeps HP adjustments, maximum HP override, death saves and hit dice in the popup without a duplicate current-HP field', () => {
    const fixture = TestBed.createComponent(MobileSheetStatusComponent);
    const character = { currentHp: 20, maxHp: 30, deathSavesFailures: 0 };
    fixture.componentRef.setInput('sheet', { character }); fixture.detectChanges();
    const popup = fixture.nativeElement.querySelector('dialog');
    expect(popup.querySelector('app-sheet-health-details')).not.toBeNull();
    expect(popup.querySelector('app-hit-dice-tracker')).not.toBeNull();
    popup.querySelector('input[aria-label="Death save failure 2"]').click(); fixture.detectChanges();
    expect(character.deathSavesFailures).toBe(2);
    expect(popup.querySelector('#popup-current-hp')).toBeNull();
    expect(popup.querySelector('input[aria-label="Maximum HP override"]')).not.toBeNull();
    expect(popup.querySelector('button').textContent).toBeDefined();
  });
});
