import { TestBed } from '@angular/core/testing';
import { Companion, companionHitPoints } from '../models/companions';
import { CompanionHealthActionsComponent } from './companion-health-actions.component';

describe('Companion quick HP actions', () => {
  it.each(['monster', 'object'] as const)('applies damage, healing and temporary HP to a tracked %s', kind => {
    const companion: Companion = kind === 'monster'
      ? { name: 'Wolf', hpEnabled: true, monsterCurrentHP: 12, monsterTempHP: 5, monsterMaxHP: 20, monsterMaxHpOverride: 15 }
      : { kind: 'object', name: 'Cannon', hitPoints: { enabled: true, current: 12, temporary: 5, maximum: 20, maximumOverride: 15 } };
    const fixture = TestBed.createComponent(CompanionHealthActionsComponent);
    fixture.componentRef.setInput('companion', companion); fixture.componentRef.setInput('maximum', 15); fixture.detectChanges();
    const input = fixture.nativeElement.querySelector('input') as HTMLInputElement;
    const buttons = fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>;
    const amount = (value: string) => { input.value = value; input.dispatchEvent(new Event('input')); fixture.detectChanges(); };
    const health = companionHitPoints(companion);
    expect(buttons[0].disabled).toBe(true);
    amount('8'); buttons[0].click(); fixture.detectChanges();
    expect(health.current).toBe(9); expect(health.temporary).toBe(0); expect(input.value).toBe('');
    amount('100'); buttons[1].click(); fixture.detectChanges();
    expect(health.current).toBe(15);
    amount('6'); buttons[2].click(); fixture.detectChanges();
    expect(health.temporary).toBe(6);
    amount('0'); buttons[2].click(); fixture.detectChanges();
    expect(health.temporary).toBe(0);
    amount('100'); buttons[0].click(); fixture.detectChanges();
    expect(health.current).toBe(0);
    amount('-1'); expect(buttons[1].disabled).toBe(true);
    fixture.destroy();
  });

  it('defaults unset current HP to the effective maximum and leaves reference-only companions unchanged', () => {
    const companion: Companion = { name: 'Wolf', hpEnabled: true };
    const fixture = TestBed.createComponent(CompanionHealthActionsComponent);
    fixture.componentRef.setInput('companion', companion); fixture.componentRef.setInput('maximum', 20); fixture.detectChanges();
    fixture.componentInstance.amount.set('5'); fixture.componentInstance.adjust('damage');
    expect(companion.monsterCurrentHP).toBe(15);
    companion.hpEnabled = false;
    fixture.componentInstance.amount.set('10'); fixture.componentInstance.adjust('heal');
    expect(companion.monsterCurrentHP).toBe(15);
    fixture.destroy();
  });
});
