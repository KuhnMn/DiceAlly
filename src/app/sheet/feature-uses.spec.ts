import { TestBed } from '@angular/core/testing';
import { FeatureUsesComponent } from './feature-uses.component';

describe('Use tracker controls', () => {
  it('shows the default recovery and explicit recovery conditions for both tracker layouts', () => {
    const fixture = TestBed.createComponent(FeatureUsesComponent);
    for (const total of [3, 10]) {
      for (const [condition, label] of [[undefined, 'Long Rest'], ['LONG_REST', 'Long Rest'], ['SHORT_REST', 'Short Rest'], ['SHORT_REST_ONE', '1 use per Short Rest'], ['MANUAL', 'Manually']]) {
        fixture.componentRef.setInput('uses', { totalFreeUses: total, usedFreeUses: 0, freeUsesRegainCondition: condition });
        fixture.detectChanges();
        expect(fixture.nativeElement.querySelector('[role="img"]')?.getAttribute('aria-label')).toBe('Regain: ' + label);
      }
    }
  });
  function setup(total: number, used = 0) {
    const fixture = TestBed.createComponent(FeatureUsesComponent);
    fixture.componentRef.setInput('uses', { tag: 'Charges', totalFreeUses: total, usedFreeUses: used });
    fixture.detectChanges();
    const changes: number[] = [];
    fixture.componentInstance.usesUpdated.subscribe(event => changes.push(event.usedFreeUses));
    return { fixture, changes, component: fixture.componentInstance };
  }

  it('uses checkboxes without a counter for up to five uses', () => {
    const { fixture, component, changes } = setup(5);
    expect(fixture.nativeElement.querySelectorAll('input[type="checkbox"]').length).toBe(5);
    expect(fixture.nativeElement.querySelector('output')).toBeNull();
    expect(fixture.nativeElement.querySelector('button')).toBeNull();
    fixture.nativeElement.querySelector('input').click(); fixture.detectChanges();
    expect(component.usedCount()).toBe(1);
    expect(changes).toEqual([1]);
  });

  it('switches to a counter at six uses', () => {
    const { fixture } = setup(6, 2);
    expect(fixture.nativeElement.querySelector('output').textContent.trim()).toBe('4/6');
    expect(fixture.nativeElement.querySelector('input')).toBeNull();
    expect(fixture.nativeElement.textContent).not.toContain('left');
  });

  it('decreases remaining uses on the left and restores them on the right', () => {
    const { fixture, changes } = setup(10, 2);
    expect(fixture.nativeElement.querySelector('output').textContent.trim()).toBe('8/10');
    fixture.nativeElement.querySelector('button[aria-label="Use one Charges"]').click(); fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('output').textContent.trim()).toBe('7/10');
    fixture.nativeElement.querySelector('button[aria-label="Restore one Charges"]').click(); fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('output').textContent.trim()).toBe('8/10');
    expect(changes).toEqual([3, 2]);
  });

  it('stays within zero and the total and updates after rest or an input replacement', () => {
    const { fixture, component, changes } = setup(6, 6);
    expect(fixture.nativeElement.querySelector('button[aria-label="Use one Charges"]').disabled).toBe(true);
    component.adjustRemaining(-1);
    expect(changes).toEqual([]);
    fixture.componentRef.setInput('uses', { tag: 'Charges', totalFreeUses: 6, usedFreeUses: 0 }); fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('output').textContent.trim()).toBe('6/6');
    expect(fixture.nativeElement.querySelector('button[aria-label="Restore one Charges"]').disabled).toBe(true);
    component.adjustRemaining(1);
    expect(changes).toEqual([]);
  });
});
