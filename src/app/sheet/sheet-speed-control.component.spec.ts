import { TestBed } from '@angular/core/testing';
import { SheetSpeedControlComponent } from './sheet-speed-control.component';
import { CharacterSpeed, walkingSpeedEntry } from '../models/character-speed';
import { CharacterStore } from '../stores/character.store';

describe('Sheet speed overrides', () => {
  it('edits, persists, cancels, validates and resets walking and referenced flight speeds', async () => {
    const fixture = TestBed.createComponent(SheetSpeedControlComponent);
    const walk = walkingSpeedEntry();
    const fly: CharacterSpeed = { id: 'fly', type: 'fly', value: { kind: 'walkingSpeed' }, canHover: true, condition: 'without armor' };
    const sheet = { character: { speeds: [walk, fly] } };
    const publish = vi.spyOn(TestBed.inject(CharacterStore), 'setCharacter');
    fixture.componentRef.setInput('sheet', sheet); fixture.detectChanges();
    const component = fixture.componentInstance;
    const edit = async (label: string, value: string, key = 'Enter') => {
      fixture.nativeElement.querySelector(`button[aria-label${label === 'Walk' ? '^="Walking speed"' : '="Override fly speed"'}]`).click();
      fixture.detectChanges(); await fixture.whenStable();
      const input = fixture.nativeElement.querySelector('input') as HTMLInputElement;
      input.value = value; input.dispatchEvent(new Event('input')); fixture.detectChanges(); await fixture.whenStable();
      input.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true })); fixture.detectChanges();
    };
    await edit('Walk', '45');
    expect(walk.overrideFeet).toBe(45); expect(publish).toHaveBeenCalled();
    await edit('Walk', '70', 'Escape'); expect(walk.overrideFeet).toBe(45);
    fixture.nativeElement.querySelector('button[aria-label="Show other speeds"]').click(); fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('45 ft.');
    expect(fixture.nativeElement.querySelector('[aria-label="Equal to walking speed"] app-ui-icon[name="walk"] svg')).not.toBeNull();
    expect(fixture.nativeElement.textContent).not.toContain('🏃');
    expect(fixture.nativeElement.textContent).toContain('without armor');
    await edit('Fly', '0'); expect(fly.overrideFeet).toBe(0);
    fixture.nativeElement.querySelector('button[aria-label="Reset fly speed override"]').click(); fixture.detectChanges();
    expect(fly.overrideFeet).toBeUndefined(); expect(component.feet(fly)).toBe(45);
    await edit('Walk', '-1'); expect(walk.overrideFeet).toBe(45); expect(component.feedback()).toContain('nonnegative');
    component.inputValue.set('50');
    document.body.dispatchEvent(new Event('pointerdown', { bubbles: true })); fixture.detectChanges();
    expect(walk.overrideFeet).toBe(50);
    fixture.nativeElement.querySelector('button[aria-label="Reset walking speed override"]').click(); fixture.detectChanges();
    expect(walk.overrideFeet).toBeUndefined(); expect(component.feet(fly)).toBe(30);
  });
});
