import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { emptyBasicCharacter } from '../editor/basic-info';
import { applyAbilityBonuses } from '../models/ability-score-bonuses';
import { CharacterInfoPageComponent } from './character-info-page.component';
import { MobileCharacterInfoPageComponent } from './mobile-character-info-page.component';
import { SheetStatTooltipComponent } from './sheet-stat-tooltip.component';
import { AbilityBonusSummaryComponent } from './ability-bonus-summary.component';

function character() {
  const sheet = emptyBasicCharacter();
  sheet.abilityBonuses!.base.strength = 19;
  sheet.features = [{ editorId: 'feat', name: 'Strong feat', featureType: 'FEAT',
    featEntity: { name: 'Strong feat', source: 'TEST', entries: [], ability: [{ str: 2 }] } }];
  applyAbilityBonuses(sheet);
  return sheet;
}

describe('Ability bonus sheet presentation', () => {
  beforeEach(() => TestBed.configureTestingModule({ providers: [provideRouter([])] }));
  for (const page of [CharacterInfoPageComponent, MobileCharacterInfoPageComponent]) {
    it(`explains capped score bonuses through hover and focus on ${page.name}`, () => {
      const fixture = TestBed.createComponent(page), sheet = character();
      fixture.componentRef.setInput('characterData', sheet); fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('app-ability-bonus-summary')).toBeNull();
      const score = fixture.debugElement.queryAll(By.directive(SheetStatTooltipComponent))
        .find(entry => entry.componentInstance.text().startsWith('19 Base'))!;
      const trigger = score.nativeElement.querySelector('[tabindex="0"]') as HTMLElement;
      trigger.dispatchEvent(new MouseEvent('mouseenter')); fixture.detectChanges();
      expect(document.querySelector('[role="tooltip"]')!.textContent).toBe('19 Base + 1 Strong feat (capped) = 20');
      trigger.dispatchEvent(new MouseEvent('mouseleave')); fixture.detectChanges();
      expect(document.querySelector('[role="tooltip"]')).toBeNull();
      trigger.dispatchEvent(new FocusEvent('focusin')); fixture.detectChanges();
      expect(document.querySelector('[role="tooltip"]')).not.toBeNull();
      trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); fixture.detectChanges();
      expect(document.querySelector('[role="tooltip"]')).toBeNull();
      fixture.destroy();
    });
  }

  it('renders confirmed allocations as read-only note cards and hides incomplete allocations', async () => {
    const fixture = TestBed.createComponent(AbilityBonusSummaryComponent), sheet = character();
    sheet.features![0].featEntity!.ability = [{ choose: { from: ['str', 'dex'], amount: 2 } }];
    fixture.componentRef.setInput('sheet', sheet);
    fixture.componentRef.setInput('sourceId', 'feature:feat');
    fixture.componentRef.setInput('card', true);
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('app-feature-notes')).toBeNull();
    sheet.abilityBonuses!.choices['feature:feat'] = { chosen: ['str'] };
    applyAbilityBonuses(sheet);
    fixture.componentRef.setInput('sheet', { ...sheet }); await fixture.whenStable();
    const card = fixture.nativeElement.querySelector('app-feature-notes') as HTMLElement;
    expect(card.textContent).toContain('Ability Bonuses');
    expect(card.textContent).toContain('+1 STR (capped)');
    expect(card.querySelector('button')).toBeNull();
    fixture.destroy();
  });
});
