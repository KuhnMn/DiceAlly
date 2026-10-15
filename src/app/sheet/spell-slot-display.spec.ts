import { TestBed } from '@angular/core/testing';
import { SpellsPageComponent } from './spells-page.component';

describe('Spell slot display', () => {
  it('hides the slot section for existing empty source buckets', () => {
    const fixture = TestBed.createComponent(SpellsPageComponent);
    fixture.componentRef.setInput('characterData', { character: { spellSlots: { Fighter: [] } } });
    fixture.detectChanges();
    expect(fixture.componentInstance.spellSlotGroups()).toEqual([]);
    expect(fixture.nativeElement.textContent).not.toContain('Spell Slots');
  });
});
