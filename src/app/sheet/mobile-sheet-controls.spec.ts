import { TestBed } from '@angular/core/testing';
import { SheetAcControlComponent } from './sheet-ac-control.component';
import { MobileCharacterInfoPageComponent } from './mobile-character-info-page.component';
import { MobileSheetStatusComponent } from './mobile-sheet-status.component';

describe('Mobile sheet controls', () => {
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
