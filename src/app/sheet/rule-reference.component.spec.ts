import { TestBed } from '@angular/core/testing';
import { OverlayContainer } from '@angular/cdk/overlay';
import { RuleReferenceComponent } from './rule-reference.component';
import { ConditionsComponent } from './conditions.component';
import { MobileCharacterInfoPageComponent } from './mobile-character-info-page.component';

const definition = { name: 'Blinded', source: 'XPHB', entries: ['A blinded creature cannot see.'] };

describe('Offline rule reference controls', () => {
  it('opens desktop references on hover/focus, keeps long entries scrollable, and dismisses with Escape', () => {
    const fixture = TestBed.createComponent(RuleReferenceComponent);
    fixture.componentRef.setInput('reference', definition); fixture.componentInstance.desktop.set(true); fixture.detectChanges();
    const origin = fixture.nativeElement.querySelector('span') as HTMLElement;
    const info = fixture.nativeElement.querySelector('button[aria-label="About Blinded"]') as HTMLButtonElement;
    const overlay = TestBed.inject(OverlayContainer).getContainerElement();
    origin.dispatchEvent(new MouseEvent('mouseenter')); fixture.detectChanges();
    expect(overlay.querySelector('[role="tooltip"]')).toBeNull();
    origin.dispatchEvent(new FocusEvent('focusin')); fixture.detectChanges();
    expect(overlay.querySelector('[role="tooltip"]')).toBeNull();
    info.dispatchEvent(new MouseEvent('mouseenter')); fixture.detectChanges();
    expect(overlay.querySelector('[role="tooltip"]')?.textContent).toContain('cannot see');
    expect(overlay.querySelector('[role="tooltip"]')?.classList.contains('overflow-auto')).toBe(true);
    origin.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); fixture.detectChanges();
    expect(overlay.querySelector('[role="tooltip"]')).toBeNull();
    info.dispatchEvent(new FocusEvent('focus')); fixture.detectChanges();
    expect(overlay.textContent).toContain('cannot see');
    expect(info.querySelector('app-ui-icon')).not.toBeNull();
    info.click(); fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('dialog')).toBeNull();
    fixture.destroy();
  });

  it('opens mobile condition help without adding/removing a condition or executing effects', () => {
    const fixture = TestBed.createComponent(ConditionsComponent);
    fixture.componentRef.setInput('descriptions', [definition]); fixture.componentRef.setInput('activeConditions', ['BLINDED', 'Custom effect']); fixture.detectChanges();
    const changes = vi.fn(); fixture.componentInstance.conditionsChanged.subscribe(changes);
    fixture.nativeElement.querySelector('button[aria-label="About Blinded"]').click(); fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('dialog')?.textContent).toContain('cannot see');
    expect(changes).not.toHaveBeenCalled();
    expect(fixture.nativeElement.querySelector('button[aria-label="About Custom effect"]')).toBeNull();
    fixture.nativeElement.querySelector('dialog').dispatchEvent(new Event('close')); fixture.detectChanges();
    fixture.nativeElement.querySelector('button[aria-label="Remove Blinded"]').click();
    expect(changes).toHaveBeenCalledWith(['Custom effect']);
    fixture.componentInstance.showDropdown.set(true); fixture.componentRef.setInput('activeConditions', []); fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('button[aria-label="About Blinded"]')).not.toBeNull();
  });

  it('shows skill and sense help using snapshot descriptions without changing modifiers or ranges', () => {
    const fixture = TestBed.createComponent(MobileCharacterInfoPageComponent);
    const sheet = { character: { abilityScores: { intelligence: 14 }, senses: { Darkvision: 60 } }, referenceDescriptions: {
      skills: [{ name: 'Arcana', source: 'XPHB', entries: ['Recall magical lore.'] }],
      senses: [{ name: 'Darkvision', source: 'XPHB', entries: ['Rules about darkness.'] }], conditions: [],
    } };
    const before = structuredClone(sheet);
    fixture.componentRef.setInput('characterData', sheet); fixture.detectChanges();
    fixture.nativeElement.querySelector('button[aria-label="About Arcana"]').click(); fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('dialog')?.textContent).toContain('magical lore');
    fixture.nativeElement.querySelector('dialog').dispatchEvent(new Event('close')); fixture.detectChanges();
    fixture.nativeElement.querySelector('button[aria-label="About Darkvision"]').click(); fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('dialog')?.textContent).toContain('Rules about darkness');
    expect(fixture.nativeElement.textContent).toContain('Darkvision: 60 ft.');
    expect(sheet).toEqual(before);
  });
});
