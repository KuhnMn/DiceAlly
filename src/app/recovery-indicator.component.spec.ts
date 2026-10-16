import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { RecoveryIndicatorComponent } from './recovery-indicator.component';
import { UiIconComponent } from './ui-icon.component';

describe('Recovery indicators', () => {
  it('uses the same accessible icons and +1 marker for all recovery types', () => {
    const fixture = TestBed.createComponent(RecoveryIndicatorComponent);
    for (const [condition, icon, label] of [
      ['LONG_REST', 'rest', 'Long Rest'],
      ['SHORT_REST', 'campfire', 'Short Rest'],
      ['SHORT_REST_ONE', 'campfire', '1 use per Short Rest'],
      ['MANUAL', 'hand', 'Manually'],
    ]) {
      fixture.componentRef.setInput('condition', condition); fixture.detectChanges();
      const badge = fixture.nativeElement.querySelector('[role="img"]');
      expect(badge.getAttribute('aria-label')).toBe('Regain: ' + label);
      expect(badge.title).toBe('Regain: ' + label);
      expect(fixture.debugElement.query(By.directive(UiIconComponent)).componentInstance.name()).toBe(icon);
      expect(fixture.nativeElement.textContent.includes('+1')).toBe(condition === 'SHORT_REST_ONE');
      expect(fixture.nativeElement.textContent).not.toContain(label);
    }
  });

  it('keeps text in editor previews and defaults missing recovery to a long rest', () => {
    const fixture = TestBed.createComponent(RecoveryIndicatorComponent);
    fixture.componentRef.setInput('showText', true); fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Long Rest');
    fixture.componentRef.setInput('condition', 'SHORT_REST'); fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Short Rest');
  });

  it('preserves custom recovery descriptions instead of replacing them with an unexplained icon', () => {
    const fixture = TestBed.createComponent(RecoveryIndicatorComponent);
    fixture.componentRef.setInput('condition', 'At dawn'); fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('At dawn');
  });
});
