import { CharacterStore } from '../stores/character.store';
import { TestBed } from '@angular/core/testing';
import { SpellsPageComponent } from './spells-page.component';

describe('Spell slot display', () => {
  it('switches from checkboxes to the shared counter at six slots and persists both directions', () => {
    const fixture=TestBed.createComponent(SpellsPageComponent), store=TestBed.inject(CharacterStore);
    const sheet={character:{characterUuid:'slots',spellSlots:{Wizard:[{level:1,total:6,used:1}]}}};
    store.setCharacter(sheet);fixture.componentRef.setInput('characterData',sheet);fixture.detectChanges();
    const tracker=fixture.nativeElement.querySelector('#preparation-spell-slots app-feature-uses');
    expect(tracker.querySelectorAll('input').length).toBe(0);expect(tracker.querySelector('output').textContent).toContain('5/6');
    tracker.querySelector('button[aria-label^="Use one"]').click();fixture.detectChanges();expect(store.characterData()!.character!.spellSlots!['Wizard'][0].used).toBe(2);
    tracker.querySelector('button[aria-label^="Restore one"]').click();fixture.detectChanges();expect(store.characterData()!.character!.spellSlots!['Wizard'][0].used).toBe(1);
    fixture.destroy();
  });
  it('hides the slot section for existing empty source buckets', () => {
    const fixture = TestBed.createComponent(SpellsPageComponent);
    fixture.componentRef.setInput('characterData', { character: { spellSlots: { Fighter: [] } } });
    fixture.detectChanges();
    expect(fixture.componentInstance.spellSlotGroups()).toEqual([]);
    expect(fixture.nativeElement.textContent).not.toContain('Spell Slots');
  });
});
