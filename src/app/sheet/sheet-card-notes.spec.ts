import { TestBed } from '@angular/core/testing';
import { FeaturesPageComponent } from './features-page.component';
import { SpellsPageComponent } from './spells-page.component';
import { EquipmentPageComponent } from './equipment-page.component';
import { MonstersPageComponent } from './monsters-page.component';

const notes = () => [{ tag: 'Created Elixirs', notes: ['Healing'], isEditable: true }];

describe('Notes on sheet cards', () => {
  it('shows species and feature notes without opening details and retains edits in the overlay', () => {
    const fixture = TestBed.createComponent(FeaturesPageComponent);
    const feature = { editorId: 'elixirs', name: 'Elixirs', notes: notes() };
    fixture.componentRef.setInput('characterData', { character: {}, species: { name: 'Species', notes: notes() }, features: [feature] });
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('app-feature-notes').length).toBe(2);
    expect(fixture.nativeElement.querySelector('dialog')).toBeNull();
    const card = fixture.nativeElement.querySelector('#feature-elixirs');
    card.querySelector('button[aria-label="Healing, remove note"]').click(); fixture.detectChanges();
    expect(feature.notes[0].notes).toEqual([]);
    fixture.componentInstance.toggleExpanded('feature-elixirs'); fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('dialog app-feature-notes').textContent).not.toContain('Healing');
    fixture.nativeElement.querySelector('dialog app-feature-notes button').click(); fixture.detectChanges();
    const input = fixture.nativeElement.querySelector('dialog app-feature-notes input') as HTMLInputElement;
    input.value = 'Flight'; input.dispatchEvent(new Event('input'));
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); fixture.detectChanges();
    fixture.componentInstance.toggleExpanded('feature-elixirs'); fixture.detectChanges();
    expect(card.querySelector('app-feature-notes').textContent).toContain('Flight');
  });

  it('shows notes on known spells as well as prepared spells', () => {
    const fixture = TestBed.createComponent(SpellsPageComponent);
    fixture.componentRef.setInput('characterData', { character: {}, spells: [
      { editorId: 'known', name: 'Known Spell', listType: 'KNOWN', notes: notes() },
      { editorId: 'prepared', name: 'Prepared Spell', listType: 'PREPARED', notes: notes() },
    ] });
    for (const type of ['PREPARED', 'KNOWN'] as const) {
      fixture.componentInstance.spellListTypeFilter.set(type); fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('dialog')).toBeNull();
      expect(fixture.nativeElement.querySelector('app-feature-notes').textContent).toContain('Healing');
    }
  });

  it('places editable item and monster notes after their use trackers on the compact cards', () => {
    for (const create of [() => TestBed.createComponent(EquipmentPageComponent), () => TestBed.createComponent(MonstersPageComponent)]) {
      const fixture = create();
      const entry = { editorId: 'entry', name: 'Entry', notes: notes(), uses: [{ totalFreeUses: 1, usedFreeUses: 0 }] };
      fixture.componentRef.setInput('characterData', { character: {}, inventory: [entry], monsters: [entry] });
      fixture.detectChanges();
      const tracker = fixture.nativeElement.querySelector('article app-feature-uses');
      const annotation = fixture.nativeElement.querySelector('article app-feature-notes');
      expect(tracker.compareDocumentPosition(annotation) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      annotation.querySelector('button[aria-label="Healing, remove note"]').click(); fixture.detectChanges();
      expect(entry.notes[0].notes).toEqual([]);
    }
  });
});
