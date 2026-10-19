import 'fake-indexeddb/auto';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { SpellsPageComponent } from './spells-page.component';
import { SpellsEditorComponent } from '../editor/spells-editor.component';
import { emptyBasicCharacter } from '../editor/basic-info';
import { matchesCastingTime, matchesSpellSchool } from '../editor/spell-selection';

describe('Spell preparation views and casting times', () => {
  beforeEach(() => TestBed.configureTestingModule({ providers: [provideRouter([])] }));

  function sheet() {
    const sheet = emptyBasicCharacter();
    sheet.character!.featureSources = [{ name: 'Wizard', useSpellbook: true, isSpellcastingSource: true }];
    sheet.spells = ['KNOWN', 'PREPARED', 'SPELLBOOK'].flatMap(listType => [
      { name: 'Action spell', listType, castingSourceName: 'Wizard', entity: { level: 1, time: [{ number: 1, unit: 'action' }] } },
      { name: 'Bonus spell', listType, castingSourceName: 'Wizard', entity: { level: 2, time: [{ number: 1, unit: 'bonus' }] } },
      { name: 'Reaction spell', listType, castingSourceName: 'Wizard', entity: { level: 1, time: [{ number: 1, unit: 'reaction', condition: 'when hit' }] } },
      { name: 'Long spell', listType, castingSourceName: 'Wizard', entity: { level: 1, time: [{ number: 1, unit: 'minute' }] } },
    ]).map(spell => ({ ...spell, entity: { name: spell.name, school: 'A', source: 'TEST', range: {}, components: {}, duration: [], entries: [], ...spell.entity } }));
    return sheet;
  }

  it('changes preparation views without counting them as filters, mutating data, or changing view on Clear', () => {
    const fixture = TestBed.createComponent(SpellsPageComponent), data = sheet();
    fixture.componentRef.setInput('characterData', data); fixture.detectChanges();
    const page = fixture.componentInstance, before = JSON.stringify(data);
    expect(fixture.nativeElement.querySelector('app-spell-view-switcher h3').textContent).toBe('Spellcasting');
    for (const [label, view] of [['Spelllist', 'KNOWN'], ['Spellbook', 'SPELLBOOK']]) {
      fixture.nativeElement.querySelector(`[aria-label="${label} view"]`).click(); fixture.detectChanges();
      expect(page.spellView()).toBe(view); expect(page.activeFilterCount()).toBe(0);
      expect(fixture.nativeElement.querySelector('app-spell-view-switcher h3').textContent).toBe(label);
      page.spellCastingTimes.set(['reaction']); page.searchQuery.set('Reaction'); fixture.detectChanges();
      fixture.nativeElement.querySelector('[aria-label="Clear filters and search"]').click(); fixture.detectChanges();
      expect(page.spellView()).toBe(view); expect(page.activeFilterCount()).toBe(0);
      expect(page.spells()).toHaveLength(4);
      fixture.nativeElement.querySelector('[aria-label="View prepared spells"]').click(); fixture.detectChanges();
      expect(page.spellView()).toBe('PREPARED');
    }
    expect(JSON.stringify(data)).toBe(before);
  });

  it('combines casting times with OR and other filters with AND, and clears the time selections', () => {
    const fixture = TestBed.createComponent(SpellsPageComponent);
    fixture.componentRef.setInput('characterData', sheet()); fixture.detectChanges();
    const page = fixture.componentInstance;
    fixture.nativeElement.querySelector('app-list-controls button[aria-expanded]').click(); fixture.detectChanges();
    const button = (name: string) => Array.from(fixture.nativeElement.querySelectorAll('[aria-label="Casting time filters"] button'))
      .find(button => (button as HTMLButtonElement).textContent?.trim() === name) as HTMLButtonElement;
    button('Action').click(); button('Bonus').click(); fixture.detectChanges();
    expect(page.spells().map(spell => spell.name)).toEqual(['Action spell', 'Bonus spell']);
    page.spellLevelFilters.set([1]); fixture.detectChanges();
    expect(page.spells().map(spell => spell.name)).toEqual(['Action spell']);
    expect(page.activeFilterCount()).toBe(3);
    button('Action').click(); fixture.detectChanges(); expect(page.spells()).toHaveLength(0);
    button('All').click(); fixture.detectChanges(); expect(page.spells()).toHaveLength(3);
    page.spellCastingTimes.set(['reaction']); page.clearFilters(); expect(page.spellCastingTimes()).toEqual([]);
  });

  it('supports alternative times and keeps slow or unspecified spells available under All', () => {
    const alternate = [{ unit: 'action' }, { unit: 'reaction' }];
    expect(matchesCastingTime(alternate, ['reaction'])).toBe(true);
    expect(matchesCastingTime(alternate, ['bonus'])).toBe(false);
    expect(matchesCastingTime([{ unit: 'minute' }], ['action'])).toBe(false);
    expect(matchesCastingTime(undefined, ['action'])).toBe(false);
    expect(matchesCastingTime(undefined, [])).toBe(true);
  });

  it('shares multi-school filtering across every viewer mode and the editor without changing source context', async () => {
    const data = sheet();
    data.spells!.filter(spell => spell.name === 'Bonus spell').forEach(spell => spell.entity!.school = 'V');
    const fixture = TestBed.createComponent(SpellsPageComponent);
    fixture.componentRef.setInput('characterData', data); fixture.detectChanges();
    const page = fixture.componentInstance;
    for (const view of ['PREPARED', 'KNOWN', 'SPELLBOOK'] as const) {
      page.spellView.set(view); page.spellSchools.set(['V']); fixture.detectChanges();
      expect(page.spells().map(spell => spell.name)).toEqual(['Bonus spell']);
      page.spellSchools.set(['A', 'V']); page.spellLevelFilters.set([1]); fixture.detectChanges();
      expect(page.spells()).toHaveLength(3); expect(page.activeFilterCount()).toBe(3);
      page.clearFilters(); fixture.detectChanges(); expect(page.spells()).toHaveLength(4);
    }
    const editorFixture = TestBed.createComponent(SpellsEditorComponent);
    editorFixture.componentRef.setInput('sheet', data); await editorFixture.whenStable();
    const editor = editorFixture.componentInstance;
    editor.displayedSchools = ['V']; editor.sourceFilter = 'Wizard';
    editorFixture.changeDetectorRef.markForCheck(); editorFixture.detectChanges();
    expect(editor.selected.map(spell => spell.name)).toEqual(['Bonus spell']);
    editorFixture.nativeElement.querySelector('[aria-label="Clear filters and search"]').click(); editorFixture.detectChanges();
    expect(editor.displayedSchools).toEqual([]); expect(editor.sourceFilter).toBe('Wizard');
  });

  it('matches school codes and full names, with custom or missing schools still available under All', () => {
    expect(matchesSpellSchool('v', ['V'])).toBe(true);
    expect(matchesSpellSchool(' Enchantment ', ['V', 'E'])).toBe(true);
    expect(matchesSpellSchool(undefined, ['V'])).toBe(false);
    expect(matchesSpellSchool('Custom', [])).toBe(true);
    expect(matchesSpellSchool(undefined, [])).toBe(true);
  });

  it.each(['KNOWN', 'SPELLBOOK'] as const)('shows only preparation information on %s cards and retains full details', view => {
    const fixture = TestBed.createComponent(SpellsPageComponent), data = sheet();
    const entry = data.spells!.find(spell => spell.listType === view && spell.name === 'Action spell')!;
    entry.source = 'TEST';
    entry.entity!.meta = { ritual: true };
    entry.entity!.duration = [{ type: 'timed', duration: { amount: 1, type: 'minute' }, concentration: true }];
    // Membership identities include the content source, so keep matching copies aligned.
    data.spells!.filter(spell => spell.name === entry.name).forEach(spell => spell.source = 'TEST');
    entry.notes = [{ tag: 'Reminder', notes: ['Keep this note'], isEditable: true }];
    entry.uses = [{ tag: 'Daily', totalFreeUses: 2, usedFreeUses: 1 }];
    const before = JSON.stringify(data);
    fixture.componentRef.setInput('characterData', data);
    fixture.componentInstance.spellView.set(view); fixture.detectChanges();
    const card = fixture.nativeElement.querySelector('.sheet-entry-list > div') as HTMLElement;
    expect(card.textContent).toContain('Action spell'); expect(card.textContent).not.toContain('Level 1');
    expect(fixture.nativeElement.querySelector('.preparation-level').textContent).toContain('Level 1');
    expect(card.querySelector('[aria-label="In Spelllist"]')).toBeNull(); expect(card.querySelector('[aria-label="In Spellbook"]')).not.toBeNull();
    expect(card.textContent).toContain('TEST'); expect(card.textContent).toContain('Wizard');
    expect(card.querySelector('[aria-label^="Action spell is prepared"]')).not.toBeNull();
    expect(card.querySelector('app-spell-summary')).toBeNull(); expect(card.querySelector('app-feature-notes')).toBeNull();
    expect(card.querySelector('app-feature-uses')).toBeNull(); expect(card.textContent).not.toContain('Abjuration');
    expect(card.querySelector('[aria-label="Abjuration"]')?.textContent).toBe('Abj');
    expect(!!card.querySelector('[aria-label="Ritual"]')).toBe(view === 'SPELLBOOK');
    expect(!!card.querySelector('[aria-label="Concentration"]')).toBe(view === 'SPELLBOOK');
    card.querySelector<HTMLButtonElement>('h3 button')!.click(); fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('dialog app-spell-details')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('dialog app-feature-notes').textContent).toContain('Keep this note');
    expect(JSON.stringify(data)).toBe(before);
  });

  it('filters rituals from the toolbar and keeps the source chips and advanced filters in sync', () => {
    const fixture = TestBed.createComponent(SpellsPageComponent), data = sheet();
    data.spells!.filter(spell => spell.name === 'Action spell').forEach(spell => spell.entity!.meta = { ritual: true });
    const before = JSON.stringify(data);
    fixture.componentRef.setInput('characterData', data);
    const page = fixture.componentInstance;
    page.spellView.set('SPELLBOOK'); fixture.detectChanges();
    const ritual = () => fixture.nativeElement.querySelector('[aria-label="Only ritual spells"]') as HTMLButtonElement;
    expect(ritual().closest('app-list-controls')).not.toBeNull();
    ritual().click(); fixture.detectChanges();
    expect(page.spells().map(spell => spell.name)).toEqual(['Action spell']);
    expect(page.activeFilterCount()).toBe(1);
    expect(ritual().getAttribute('aria-pressed')).toBe('true');
    const sources = fixture.nativeElement.querySelector('app-feature-source-picker');
    (Array.from(sources.querySelectorAll('button')) as HTMLButtonElement[]).find(button => button.querySelector('.font-semibold')?.textContent?.trim() === 'Wizard')!.click(); fixture.detectChanges();
    expect(page.spellCastingSourceFilter()).toBe('Wizard'); expect(page.activeFilterCount()).toBe(1);
    page.clearFilters(); fixture.detectChanges();
    expect(ritual().getAttribute('aria-pressed')).toBe('false'); expect(page.spells()).toHaveLength(4);
    ritual().click(); ritual().click(); fixture.detectChanges(); expect(page.spellRitualFilter()).toBe('ALL');
    expect(JSON.stringify(data)).toBe(before);
  });

  it('switches the entire page at the top, omits slots in preparation views, and restores manual slot tracking', () => {
    const fixture = TestBed.createComponent(SpellsPageComponent), data = sheet();
    data.character!.spellSlots = { Wizard: [{ level: 1, total: 4, used: 1 }] };
    fixture.componentRef.setInput('characterData', data); fixture.detectChanges();
    const page = fixture.componentInstance;
    const slots = () => fixture.nativeElement.querySelector('#preparation-spell-slots') as HTMLElement;
    expect(slots()).not.toBeNull();
    const switcher = fixture.nativeElement.querySelector('app-spell-view-switcher') as HTMLElement;
    expect(switcher.closest('section')).toBeNull();
    for (const view of ['KNOWN', 'SPELLBOOK'] as const) {
      page.spellView.set(view); fixture.detectChanges(); expect(slots()).toBeNull();
      expect(fixture.nativeElement.querySelector('.spell-page.spell-preparation-view')).not.toBeNull();
      expect(fixture.nativeElement.querySelector('section.spell-preparation-view')).toBeNull();
      expect(fixture.nativeElement.querySelector('app-feature-source-picker app-source-stats')).toBeNull();
    }
    page.spellView.set('PREPARED'); fixture.detectChanges(); expect(slots()).not.toBeNull();
    page.toggleSpellSlot('Wizard', { level: 1, total: 4, used: 1 }, 1); fixture.detectChanges();
    expect(slots().textContent).toContain('2 / 4');
    expect(fixture.nativeElement.querySelector('app-feature-source-picker app-source-stats')).not.toBeNull();
  });

  it('counts each casting source independently of view, search and filters, including empty and legacy spellbooks', () => {
    const fixture = TestBed.createComponent(SpellsPageComponent), data = sheet();
    data.character!.featureSources!.push({ name: 'Bard', isSpellcastingSource: true }, { name: 'Empty wizard', isSpellcastingSource: true, useSpellbook: true });
    data.spells!.push({ ...structuredClone(data.spells![0]), castingSourceName: 'Bard', listType: 'PREPARED' });
    data.spells!.push({ ...structuredClone(data.spells![0]), castingSourceName: 'Legacy', listType: 'SPELLBOOK' });
    data.spells!.push({ ...structuredClone(data.spells![0]), name: 'Cantrip', listType: 'PREPARED', entity: { ...data.spells![0].entity!, level: 0 } });
    fixture.componentRef.setInput('characterData', data);
    const page = fixture.componentInstance; page.spellView.set('KNOWN'); fixture.detectChanges();
    expect(page.sourceSpellCounts()['Wizard']).toEqual({ prepared: 4, preparedCantrips: 1, spellbook: 4 });
    expect(page.sourceSpellCounts()['Bard']).toEqual({ prepared: 1, preparedCantrips: 0 });
    expect(page.sourceSpellCounts()['Empty wizard']).toEqual({ prepared: 0, preparedCantrips: 0, spellbook: 0 });
    expect(page.sourceSpellCounts()['Legacy']).toEqual({ prepared: 0, preparedCantrips: 0, spellbook: 1 });
    expect(page.sourceSpellCounts()['ALL']).toEqual({ prepared: 5, preparedCantrips: 1, spellbook: 5 });
    const sourceButton = (name: string) => (Array.from(fixture.nativeElement.querySelectorAll('app-feature-source-picker button')) as HTMLButtonElement[]).find(button => button.querySelector('.font-semibold')?.textContent?.trim() === name)!;
    expect(sourceButton('Wizard').querySelector('[aria-label="4 prepared spells"]')).not.toBeNull();
    expect(sourceButton('Wizard').querySelector('[aria-label="1 prepared cantrips"]')).not.toBeNull();
    expect(sourceButton('Wizard').querySelector('[aria-label="4 spells in spellbook"]')).not.toBeNull();
    expect(sourceButton('Bard').querySelector('[title="Spellbook"]')).toBeNull();
    page.searchQuery.set('missing'); page.spellLevelFilters.set([9]); fixture.detectChanges();
    expect(sourceButton('Wizard').querySelector('[aria-label="4 prepared spells"]')).not.toBeNull();
    page.spellCastingSourceFilter.set('Bard'); page.clearFilters(); fixture.detectChanges();
    expect(page.spellCastingSourceFilter()).toBe('Bard'); expect(page.activeFilterCount()).toBe(0);
  });

  it('shows live icon counts alongside casting stats in the creator, independently of list filters', async () => {
    const fixture = TestBed.createComponent(SpellsEditorComponent), data = sheet();
    data.character!.featureSources![0].usesIntelligence = true;
    data.character!.abilityScores!.intelligence = 16;
    data.character!.featureSources!.push({ name: 'Bard', isSpellcastingSource: true });
    const cantrip = { ...structuredClone(data.spells![0]), name: 'Cantrip', listType: 'PREPARED', entity: { ...data.spells![0].entity!, level: 0 } };
    data.spells!.push(cantrip, structuredClone(cantrip));
    fixture.componentRef.setInput('sheet', data); await fixture.whenStable();
    const editor = fixture.componentInstance;
    const source = (name: string) => (Array.from(fixture.nativeElement.querySelectorAll('app-feature-source-picker button')) as HTMLButtonElement[])
      .find(button => button.querySelector('.font-semibold')?.textContent?.trim() === name)!;
    expect(source('Wizard').querySelector('app-source-stats')!.textContent).toContain('INT +3');
    expect(source('Wizard').querySelector('[aria-label="4 prepared spells"] app-ui-icon')!.getAttribute('name')).toBe('clipboard-check');
    expect(source('Wizard').querySelector('[aria-label="1 prepared cantrips"] app-ui-icon')!.getAttribute('name')).toBe('copyright');
    expect([...source('Wizard').querySelectorAll('[role="img"]')].map(icon => icon.getAttribute('title'))).toEqual(['Prepared cantrips', 'Prepared spells (level 1+)', 'Spellbook']);
    expect(source('Wizard').querySelector('[aria-label="4 spells in spellbook"] app-ui-icon')!.getAttribute('name')).toBe('book');
    expect(source('Bard').querySelector('[aria-label="0 prepared spells"]')).not.toBeNull();
    expect(source('Bard').querySelector('[title="Spellbook"]')).toBeNull();
    editor.listSearch = 'missing'; editor.displayedMemberships = ['PREPARED'];
    fixture.changeDetectorRef.markForCheck(); fixture.detectChanges();
    expect(source('Wizard').querySelector('[aria-label="4 prepared spells"]')).not.toBeNull();
    editor.toggleMembership(data.spells![0], 'PREPARED'); fixture.detectChanges();
    expect(source('Wizard').querySelector('[aria-label="3 prepared spells"]')).not.toBeNull();
    expect(source('Wizard').querySelector('[aria-label="1 prepared cantrips"]')).not.toBeNull();
    expect(source('Wizard').querySelector('[aria-label="4 spells in spellbook"]')).not.toBeNull();
    expect(source('Wizard').querySelector('app-source-stats')!.textContent).toContain('INT +3');
  });

  it('uses a unified editor list with membership filters while retaining KNOWN storage', async () => {
    const fixture = TestBed.createComponent(SpellsEditorComponent), data = sheet();
    fixture.componentRef.setInput('sheet', data); await fixture.whenStable();
    const editor = fixture.componentInstance;
    editor.displayedCastingTimes = ['reaction']; fixture.changeDetectorRef.markForCheck(); fixture.detectChanges();
    expect(editor.selected.map(spell => spell.name)).toEqual(['Reaction spell']);
    expect(editor.label('KNOWN')).toBe('Spelllist');
    expect(fixture.nativeElement.querySelector('app-spell-view-switcher')).toBeNull();
    expect(fixture.nativeElement.querySelector('.spell-preparation-view')).toBeNull();
    const membership = fixture.nativeElement.querySelector('[aria-label="Spell membership filters"]');
    (Array.from(membership.querySelectorAll('button')) as HTMLButtonElement[]).find(button => button.textContent?.trim() === 'Spellbook')!.click(); fixture.detectChanges();
    expect(editor.displayedMemberships).toEqual(['SPELLBOOK']);
    fixture.nativeElement.querySelector('[aria-label="Clear filters and search"]').click(); fixture.detectChanges();
    expect(editor.displayedMemberships).toEqual([]); expect(editor.displayedCastingTimes).toEqual([]);
    expect(editor.selected).toHaveLength(4);
    expect(data.spells!.filter(spell => spell.listType === 'KNOWN')).toHaveLength(4);
    expect(fixture.nativeElement.textContent).not.toMatch(/\bKnown\b/);
  });

  it('combines Prepared and Spellbook with OR, deduplicates copies per source, and retains imported entries without Spelllist copies', async () => {
    const fixture = TestBed.createComponent(SpellsEditorComponent), data = sheet(), base = data.spells![0];
    const entry = (name: string, listType: string, castingSourceName = 'Wizard') => ({ ...structuredClone(base), name, listType, castingSourceName });
    data.spells = [entry('Available', 'KNOWN'), entry('Ready', 'PREPARED'), entry('Book', 'SPELLBOOK'), entry('Both', 'KNOWN'), entry('Both', 'SPELLBOOK'), entry('Both', 'PREPARED'), entry('Both', 'KNOWN', 'Bard')];
    const before = JSON.stringify(data);
    fixture.componentRef.setInput('sheet', data); await fixture.whenStable();
    const editor = fixture.componentInstance;
    expect(editor.selected).toHaveLength(5);
    expect(editor.selected.filter(spell => spell.name === 'Both')).toHaveLength(2);
    editor.sourceFilter = 'Wizard'; editor.displayedMemberships = ['PREPARED'];
    expect(editor.selected.map(spell => spell.name)).toEqual(['Both', 'Ready']);
    editor.toggleMembershipFilter('SPELLBOOK');
    expect(editor.selected.map(spell => spell.name)).toEqual(['Book', 'Both', 'Ready']);
    editor.toggleMembershipFilter('PREPARED');
    expect(editor.selected.map(spell => spell.name)).toEqual(['Book', 'Both']);
    editor.displayedSchools = ['V']; expect(editor.selected).toHaveLength(0);
    fixture.changeDetectorRef.markForCheck(); fixture.detectChanges();
    fixture.nativeElement.querySelector('[aria-label="Clear filters and search"]').click(); fixture.detectChanges();
    expect(editor.selected).toHaveLength(4); expect(editor.sourceFilter).toBe('Wizard');
    expect(JSON.stringify(data)).toBe(before);
  });
});
