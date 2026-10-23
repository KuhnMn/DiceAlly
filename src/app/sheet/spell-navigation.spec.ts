import { TestBed } from '@angular/core/testing';
import { SpellsPageComponent } from './spells-page.component';
import { CharacterStore } from '../stores/character.store';
import { emptyBasicCharacter } from '../editor/basic-info';
import { SpellEntryFull } from '../models/character.model';

const spell = (editorId: string, listType: string, castingSourceName = 'Wizard'): SpellEntryFull => ({
  editorId, name: 'Flame', source: 'TEST', castingSourceName, listType,
  entity: { name: 'Flame', source: 'TEST', level: 1, school: 'V', time: [{ number: 1, unit: 'action' }],
    range: { type: 'point', distance: { type: 'feet', amount: 60 } }, components: { v: true }, duration: [{ type: 'instant' }], entries: [{ text: 'Flame description.' }] },
});

function setup(spells: SpellEntryFull[], view: 'PREPARED' | 'KNOWN' | 'SPELLBOOK' = 'PREPARED') {
  const fixture = TestBed.createComponent(SpellsPageComponent), sheet = emptyBasicCharacter();
  sheet.spells = spells;
  fixture.componentRef.setInput('characterData', sheet); fixture.componentInstance.spellView.set(view); fixture.detectChanges();
  return { fixture, screen: fixture.componentInstance, store: TestBed.inject(CharacterStore) };
}

describe('Spell bookmark navigation', () => {
  it.each(['KNOWN', 'SPELLBOOK'])('keeps Prepared when the bookmark points to a %s copy of a prepared spell', list => {
    const prepared = spell('prepared', 'PREPARED');
    const { fixture, screen, store } = setup([spell('bookmarked', list), prepared]);
    screen.searchQuery.set('Other spell'); screen.spellCastingSourceFilter.set('Other source');
    store.setFeatureScrollTarget('spell-bookmarked'); fixture.detectChanges();
    expect(screen.spellView()).toBe('PREPARED');
    expect(screen.spells()).toEqual([prepared]); expect(screen.isExpanded(screen.spellExpansionId(prepared))).toBe(true);
    expect(fixture.nativeElement.querySelector('dialog')?.textContent).toContain('Flame description.');
    fixture.destroy();
  });

  it.each(['KNOWN', 'SPELLBOOK'] as const)('preserves the current %s list when it already contains a copy of the prepared spell', view => {
    const copy = spell('current', view);
    const { fixture, screen, store } = setup([spell('prepared', 'PREPARED'), copy], view);
    store.setFeatureScrollTarget('spell-prepared'); fixture.detectChanges();
    expect(screen.spellView()).toBe(view); expect(screen.spells()).toEqual([copy]);
    expect(screen.isExpanded(screen.spellExpansionId(copy))).toBe(true); fixture.destroy();
  });

  it.each(['KNOWN', 'SPELLBOOK'])('opens the %s list when a spell is not prepared', list => {
    const target = spell('bookmarked', list);
    const { fixture, screen, store } = setup([target]);
    store.setFeatureScrollTarget('spell-bookmarked'); fixture.detectChanges();
    expect(screen.spellView()).toBe(list); expect(screen.spells()).toEqual([target]);
    expect(screen.isExpanded(screen.spellExpansionId(target))).toBe(true); fixture.destroy();
  });

  it('does not mistake another casting source’s prepared copy for this bookmark', () => {
    const target = spell('bookmarked', 'SPELLBOOK', 'Wizard');
    const { fixture, screen, store } = setup([spell('prepared', 'PREPARED', 'Cleric'), target]);
    store.setFeatureScrollTarget('spell-bookmarked'); fixture.detectChanges();
    expect(screen.spellView()).toBe('SPELLBOOK'); expect(screen.spells()).toEqual([target]); fixture.destroy();
  });
});
