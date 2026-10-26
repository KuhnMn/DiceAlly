import { ensureBrowseSummary } from '../content/content-browse-summary';
import 'fake-indexeddb/auto';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { vi } from 'vitest';
import { BreakpointObserver } from '@angular/cdk/layout';
import { CompendiumComponent } from './compendium.component';
import { CONTENT_TYPES, facetLabel, matchesFilters, recordFacets } from './compendium-catalog';
import { ContentRecord, ImportRevision, ADAPTER_VERSION, DEFAULT_CONTENT_SOURCE, sourceIdentity } from '../content/content.model';
import { IndexedDbContentCache } from '../content/content-cache';
import { mapContent } from '../content/content-adapter';
import { SOURCE_KINDS } from '../content/generated/schema-registry';
import { SourceBookFilterService } from '../editor/source-book-filter.service';
import { SourceBookFilterComponent } from '../editor/source-book-filter.component';
import { By } from '@angular/platform-browser';
import { CompendiumDetailsComponent } from './compendium-details.component';
import { CompendiumSourceFilterComponent } from './compendium-source-filter.component';
import { filterGroupSummary } from './active-filter-chips.component';
import { materializeContent } from '../content/content-materializer';
import { ImportDiagnostic } from '../content/content.model';

describe('Compendium catalog', () => {
  it('exposes charms and rewards with their source-defined types', () => {
    const reward = mapContent({reward: [{name: 'Blasphemous Charm', source: 'RHW', type: 'Charm', entries: ['A magical charm.']}]}, 'rewards.json').records[0];
    expect(CONTENT_TYPES.find(type => type.id === 'reward')?.kinds).toEqual(['reward']);
    expect(recordFacets(reward).category).toEqual(['Charm']);
  });
  it('places Classes first and gives facilities their own category', () => {
    expect(CONTENT_TYPES[0].id).toBe('class');
    expect(CONTENT_TYPES.filter(type => (type.kinds as readonly string[]).includes('facility')).map(type => type.id)).toEqual(['facility']);
    expect(CONTENT_TYPES.find(type => type.id === 'world')?.kinds).toEqual(['object', 'vehicle']);
  });

  it('reads canonical facility types and levels and keeps unlisted levels distinct from zero', () => {
    const special: ContentRecord = { key: 'study', kind: 'facility', name: 'Arcane Study', publication: 'TEST', file: 'bastions.json', links: [], data: {},
      referenceDefinition: { version: 1, kind: 'facility', name: 'Arcane Study', source: 'TEST', facilityType: 'special', level: 5, entries: [] } };
    const basic: ContentRecord = { ...special, key: 'bedroom', name: 'Bedroom', referenceDefinition: undefined, data: { facilityType: 'basic' } };
    expect(recordFacets(special)).toMatchObject({ facilityType: ['special'], facilityLevel: ['5'] });
    expect(recordFacets(basic)).toMatchObject({ facilityType: ['basic'], facilityLevel: ['unspecified'] });
    expect(recordFacets(special).level).toBeUndefined();
    expect(matchesFilters(special, { facilityType: ['special'], facilityLevel: ['5'] })).toBe(true);
    expect(matchesFilters(basic, { facilityType: ['basic'], facilityLevel: ['5'] })).toBe(false);
    expect(facetLabel('facilityLevel', '0')).toBe('Level 0');
    expect(facetLabel('facilityLevel', 'unspecified')).toBe('No Level Listed');
  });
  const records = () => mapContent({ spell: [
    { name: 'Fire Ward', source: 'PHB', level: 1, school: 'A', time: [{ number: 1, unit: 'reaction' }],
      meta: { ritual: true }, duration: [{ type: 'timed', duration: { type: 'minute', amount: 1 }, concentration: true }],
      classes: { fromClassList: [{ name: 'Wizard', source: 'PHB' }] }, entries: ['A protective ward.'] },
    { name: 'Frost Ray', source: 'XPHB', level: 0, school: 'V', entries: ['A cold ray.'] },
  ], feat: [{ name: 'Alert', source: 'XPHB', category: 'O', prerequisite: [{ level: 1 }], entries: ['Stay alert.'] }] }, 'fixtures.json').records;

  it('reads canonical spell fields and combines facets with OR within and AND between groups', () => {
    const spell = records().find(record => record.name === 'Fire Ward')!;
    expect(recordFacets(spell)).toMatchObject({ source: ['PHB'], school: ['A'], level: ['1'], class: ['Wizard'], ritual: ['Yes'], concentration: ['Yes'], casting: ['reaction'] });
    expect(matchesFilters(spell, { source: ['PHB', 'XPHB'], level: ['1'], school: ['A'] })).toBe(true);
    expect(matchesFilters(spell, { class: ['Wizard'], level: ['0'] })).toBe(false);
    expect(facetLabel('school', 'A')).toBe('Abjuration');
    expect(facetLabel('category', 'O')).toBe('Origin');
  });

  it('recognizes homebrew and feat prerequisites without mutating the stored record', () => {
    const feat = records().find(record => record.kind === 'feat')!;
    feat.file = 'homebrew/test/feats.json';
    const before = structuredClone(feat);
    expect(recordFacets(feat)).toMatchObject({ origin: ['Homebrew'], prerequisite: ['Has Prerequisites'], category: ['O'], level: ['1'] });
    expect(feat).toEqual(before);
    for (const record of records()) expect(CONTENT_TYPES.some(type => (type.kinds as readonly string[]).includes(record.kind))).toBe(true);
    for (const kind of SOURCE_KINDS) {
      const playableKind = kind === 'race' || kind === 'subrace' ? 'species' : kind;
      expect(CONTENT_TYPES.some(type => (type.kinds as readonly string[]).includes(playableKind))).toBe(true);
    }
  });
});

describe('Compendium screen', () => {
  let params: BehaviorSubject<ReturnType<typeof convertToParamMap>>;
  let cache: IndexedDbContentCache;
  let revision: ImportRevision;
  let data: ContentRecord[];
  const breakpoint = new BehaviorSubject({ matches: false, breakpoints: {} });

  beforeEach(async () => {
    localStorage.removeItem('ally-creator-source-books');
    params = new BehaviorSubject(convertToParamMap({}));
    breakpoint.next({ matches: false, breakpoints: {} });
    TestBed.configureTestingModule({ providers: [provideRouter([]),
      { provide: ActivatedRoute, useValue: { paramMap: params, snapshot: { paramMap: convertToParamMap({}) } } },
      { provide: BreakpointObserver, useValue: { observe: () => breakpoint } },
    ] });
    const source = { ...DEFAULT_CONTENT_SOURCE, owner: `compendium-${crypto.randomUUID()}` };
    revision = { id: crypto.randomUUID(), namespace: 'development-local', source, sourceIdentity: sourceIdentity(source),
      commit: 'a'.repeat(40), adapterVersion: ADAPTER_VERSION, status: 'staging', createdAt: new Date().toISOString(),
      files: [], diagnostics: [], metrics: { bytes: 0, records: 33, mappedBytes: 0, elapsedMs: 0 } };
    data = mapContent({ spell: Array.from({ length: 32 }, (_, i) => ({ name: `Spell ${String(i).padStart(2, '0')}`,
      source: i % 2 ? 'XPHB' : 'PHB', level: i % 2, school: i % 2 ? 'V' : 'A', damageInflict: [i % 2 ? 'fire' : 'cold'], entries: [`Description ${i}`] })),
      feat: [{ name: 'Alert', source: 'XPHB', category: 'O', entries: ['Stay alert.'] }] }, 'fixtures.json').records;
    cache = new IndexedDbContentCache();
    await cache.stage(revision); await cache.put(revision.id, data); await cache.activate(revision); await cache.saveSource('development-local', source);
  });
  afterEach(() => { vi.restoreAllMocks(); });

  async function setup(waitForCounts = true) {
    const fixture = TestBed.createComponent(CompendiumComponent);
    fixture.detectChanges();
    // IndexedDB work is not covered by Angular's stability promise.
    await vi.waitFor(() => expect(fixture.componentInstance.loading()).toBe(false));
    if (waitForCounts && !fixture.componentInstance.type()) await vi.waitFor(() => expect(fixture.componentInstance.countsLoading()).toBe(false));
    return { fixture, screen: fixture.componentInstance };
  }

  it('shows the requested category before library loading and keeps the latest navigation without scanning all records', async () => {
    let release!: (value: typeof revision.source) => void;
    const gate = new Promise<typeof revision.source>(resolve => release = resolve);
    vi.spyOn(IndexedDbContentCache.prototype, 'savedSource').mockReturnValue(gate);
    const visit = vi.spyOn(IndexedDbContentCache.prototype, 'visit');
    params.next(convertToParamMap({type: 'spell'}));
    const fixture = TestBed.createComponent(CompendiumComponent); fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('h1').textContent).toBe('Spells');
    expect(fixture.nativeElement.querySelector('[aria-label="Compendium categories"]')).toBeNull();
    expect(fixture.componentInstance.loading()).toBe(true);
    params.next(convertToParamMap({type: 'feat'})); fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('h1').textContent).toBe('Feats');
    release(revision.source);
    await vi.waitFor(() => expect(fixture.componentInstance.loading()).toBe(false));
    expect(fixture.componentInstance.type()?.id).toBe('feat');
    expect(fixture.componentInstance.results().map(entry => entry.name)).toEqual(['Alert']);
    expect(visit).not.toHaveBeenCalled();
  });

  it('starts with category tiles and loads only the selected category with pagination', async () => {
    const { fixture, screen } = await setup();
    expect(screen.type()).toBeNull();
    await vi.waitFor(() => expect(screen.countsLoading()).toBe(false));
    expect(screen.count(CONTENT_TYPES.find(type => type.id === 'spell')!)).toBe(32);
    expect(screen.results()).toEqual([]);
    await screen.chooseType('spell');
    expect(screen.total()).toBe(32); expect(screen.results()).toHaveLength(30);
    await screen.turnPage(1);
    expect(screen.results().map(record => record.name)).toEqual(['Spell 30', 'Spell 31']);
    await screen.chooseType('feat');
    expect(screen.total()).toBe(1); expect(screen.offset).toBe(0); expect(screen.results()[0].name).toBe('Alert');
    fixture.destroy();
  });

  it('keeps tiles usable while old-library counts are still loading', async () => {
    let release!: () => void;
    const gate = new Promise<void>(resolve => release = resolve);
    const original = IndexedDbContentCache.prototype.visit;
    vi.spyOn(IndexedDbContentCache.prototype, 'visit').mockImplementation(async function (this: IndexedDbContentCache, id, visitor) {
      await gate; return original.call(this, id, visitor);
    });
    const { fixture, screen } = await setup(false);
    fixture.detectChanges();
    expect(screen.countsLoading()).toBe(true);
    expect(fixture.nativeElement.querySelectorAll('.category-card').length).toBe(CONTENT_TYPES.length);
    await screen.chooseType('spell');
    expect(screen.results()).toHaveLength(30); expect(screen.loading()).toBe(false);
    release();
    await vi.waitFor(() => expect(screen.countsLoading()).toBe(false));
    fixture.destroy();
  });

  it('uses cached facets and reads only the selected category for results', async () => {
    await ensureBrowseSummary(cache, revision.id);
    params.next(convertToParamMap({ type: 'spell' }));
    const read = vi.spyOn(IndexedDbContentCache.prototype, 'searchCategory');
    const visit = vi.spyOn(IndexedDbContentCache.prototype, 'visit');
    const { fixture, screen } = await setup();
    expect(screen.total()).toBe(32);
    expect(screen.facets().find(facet => facet.key === 'source')?.values).toEqual(['PHB', 'XPHB']);
    expect(read).toHaveBeenCalledTimes(1); expect(visit).not.toHaveBeenCalled();
    fixture.destroy();
  });

  it('combines name search and source/school filters, supports clearing, and leaves editor preferences untouched', async () => {
    const { fixture, screen } = await setup();
    localStorage.setItem('ally-creator-source-books', '["KEEP"]');
    await screen.chooseType('spell');
    screen.query = 'Spell 0'; screen.filters = { source: ['PHB'], school: ['A'] };
    await screen.search();
    expect(screen.results().map(record => record.name).sort()).toEqual([
      'Spell 00', 'Spell 02', 'Spell 04', 'Spell 06', 'Spell 08', 'Spell 10', 'Spell 20', 'Spell 30',
    ]);
    expect(screen.results().every(record => record.publication === 'PHB')).toBe(true);
    screen.filters.school = ['V']; await screen.search(); expect(screen.total()).toBe(0);
    screen.clearFilters(); await screen.search();
    expect(screen.total()).toBe(32); expect(screen.filterCount).toBe(0);
    expect(localStorage.getItem('ally-creator-source-books')).toBe('["KEEP"]');
    fixture.destroy();
  });

  it('excludes base items before pagination by default and lets users include them using Content Kind', async () => {
    await cache.put(revision.id, mapContent({
      baseitem: Array.from({ length: 35 }, (_, i) => ({ name: `Base ${i}`, source: 'PHB' })),
      item: [{ name: 'Rope', source: 'PHB' }, { name: 'Magic Rope', source: 'XDMG' }],
      itemGroup: [{ name: 'Packs', source: 'PHB' }],
    }, 'items.json').records);
    const { fixture, screen } = await setup(); await screen.chooseType('item'); fixture.detectChanges();
    expect(screen.total()).toBe(3); expect(screen.results().every(record => record.kind !== 'baseitem')).toBe(true);
    expect(screen.facets().find(facet => facet.key === 'kind')?.values).toContain('baseitem');
    const baseOption = [...fixture.nativeElement.querySelectorAll('[aria-label="Content Kind"] label')]
      .find((label: unknown) => (label as HTMLElement).textContent?.trim() === 'Base Item') as HTMLLabelElement;
    expect(baseOption.querySelector('input')?.checked).toBe(false);
    baseOption.querySelector('input')!.click(); await screen.search();
    expect(screen.total()).toBe(38); expect(screen.results()).toHaveLength(30);
    screen.filters = { kind: ['baseitem'] }; await screen.search(); expect(screen.total()).toBe(35);
    await screen.chooseType('spell'); await screen.chooseType('item'); expect(screen.total()).toBe(3);
    fixture.destroy();
  });

  it('does not interpret a base-item-only library as an unrestricted default selection', async () => {
    await cache.put(revision.id, mapContent({ baseitem: [{ name: 'Only Base', source: 'PHB' }] }, 'base.json').records);
    const { fixture, screen } = await setup(); await screen.chooseType('item');
    expect(screen.total()).toBe(0); expect(screen.filters.kind).not.toContain('baseitem');
    screen.clearFilters(); await screen.search(); expect(screen.total()).toBe(1);
    fixture.destroy();
  });

  it('shares home defaults with the creator and copies them into each list without persisting local overrides', async () => {
    const defaults = TestBed.inject(SourceBookFilterService);
    defaults.setSelection(['XPHB']);
    const { fixture, screen } = await setup();
    fixture.detectChanges();
    const homeControl = fixture.debugElement.query(By.directive(SourceBookFilterComponent)).componentInstance as SourceBookFilterComponent;
    expect(homeControl.filter).toBe(defaults);
    homeControl.filter.setSelection(['PHB']);
    await screen.chooseType('spell');
    expect(screen.filters.source).toEqual(['PHB']);
    expect(screen.total()).toBe(16);
    screen.toggle('source', 'XPHB'); await screen.search();
    expect(screen.filters.source).toEqual(['PHB', 'XPHB']);
    expect(screen.total()).toBe(32);
    expect(defaults.selected()).toEqual(['PHB']);
    expect(new SourceBookFilterService().selected()).toEqual(['PHB']);
    await screen.chooseType('feat');
    expect(screen.filters.source).toEqual(['PHB']); expect(screen.total()).toBe(0);
    screen.clearFilters(); await screen.search(); expect(screen.total()).toBe(1);
    await screen.chooseType('spell'); expect(screen.total()).toBe(16);
    fixture.destroy();
  });

  it('lists only sources with category entries while keeping unavailable defaults removable without including excluded books', async () => {
    TestBed.inject(SourceBookFilterService).setSelection(['NOT_INSTALLED']);
    const { fixture, screen } = await setup();
    await screen.chooseType('spell');
    expect(screen.total()).toBe(0);
    expect(screen.facets().find(facet => facet.key === 'source')?.values).toEqual(['PHB', 'XPHB']);
    fixture.detectChanges();
    const sourceFilter = fixture.debugElement.query(By.directive(CompendiumSourceFilterComponent)).componentInstance as CompendiumSourceFilterComponent;
    expect(sourceFilter.visibleBooks()).toEqual(['PHB', 'XPHB']);
    const chip = fixture.nativeElement.querySelector('[aria-label="Remove Source Book filter"]') as HTMLButtonElement;
    expect(chip.textContent).toContain('No matching source books');
    chip.click(); await screen.search(); expect(screen.total()).toBe(32);
    expect(TestBed.inject(SourceBookFilterService).selected()).toEqual(['NOT_INSTALLED']);
    fixture.destroy();
  });

  it('counts only available selections in the source summary, badge and chip and drops hidden defaults when a checkbox changes', async () => {
    const defaults = TestBed.inject(SourceBookFilterService);
    const books = ['PHB', 'XPHB', ...Array.from({ length: 45 }, (_, i) => `OTHER${i}`)]; defaults.setSelection(books);
    const { fixture, screen } = await setup(); await screen.chooseType('spell'); fixture.detectChanges();
    const control = fixture.debugElement.query(By.directive(CompendiumSourceFilterComponent)).componentInstance as CompendiumSourceFilterComponent;
    expect(control.selectedBooks()).toEqual(['PHB', 'XPHB']); expect(screen.filterCount).toBe(2);
    expect(fixture.nativeElement.querySelector('app-compendium-source-filter summary').textContent).toContain('2 selected');
    expect(fixture.nativeElement.querySelector('[aria-label="Remove Source Book filter"]').textContent).toContain('PHB, XPHB');
    control.query.set('XPHB'); expect(control.visibleBooks()).toEqual(['XPHB']); expect(control.selectedBooks()).toHaveLength(2);
    control.toggle('PHB'); await screen.search(); fixture.detectChanges();
    expect(screen.filters.source).toEqual(['XPHB']); expect(screen.filterCount).toBe(1); expect(screen.total()).toBe(16);
    control.toggle('XPHB'); await screen.search(); expect(screen.filters.source).toEqual([]); expect(screen.total()).toBe(32);
    expect(defaults.selected()).toHaveLength(47);
    fixture.destroy();
  });

  it('groups active filters by category, compresses large selections and removes only the chosen group', async () => {
    const { fixture, screen } = await setup();
    await screen.chooseType('spell');
    const books = ['PHB', 'XPHB', 'TCE', 'XGE', 'FTD', 'MPMM'];
    screen.filters = { source: books, school: ['A', 'V'], level: ['0', '1'] };
    screen.effects = { damageTypes: ['fire', 'cold'] }; await screen.search(); fixture.detectChanges();
    const chips = fixture.nativeElement.querySelectorAll('[aria-label="Active filters"] .filter-chip');
    expect(chips.length).toBe(4);
    expect(chips[0].textContent).toContain('Source Book: PHB, XPHB');
    expect(chips[1].textContent).toContain('School: Abjuration, Evocation');
    const damage = fixture.nativeElement.querySelector('[aria-label="Remove Damage type filter"]') as HTMLButtonElement;
    expect(damage.textContent).toContain('Fire, Cold'); damage.click(); await screen.search();
    expect(screen.effects.damageTypes).toBeUndefined(); expect(screen.filters.source).toEqual(books);
    (fixture.nativeElement.querySelector('[aria-label="Remove School filter"]') as HTMLButtonElement).click(); await screen.search();
    expect(screen.filters.school).toBeUndefined(); expect(screen.filters.level).toEqual(['0', '1']);
    expect(filterGroupSummary(['a'.repeat(70)])).toBe('1 selected');
    expect(filterGroupSummary(['PHB', 'XPHB'])).toBe('PHB, XPHB');
    fixture.destroy();
  });

  it('shows playable species once, keeps separate sources and subspecies and avoids duplicate Species filter options', async () => {
    const raw = mapContent({ race: [
      { name: 'Dragonborn', source: 'XPHB', speed: 30, size: ['M'], darkvision: 60, entries: ['Dragonborn description.'] },
      { name: 'Elf', source: 'PHB', speed: 30, size: ['M'], darkvision: 60, entries: ['Base elf description.'] },
      { name: 'Elf', source: 'XPHB', speed: 30, size: ['M'], entries: ['Modern elf description.'] },
    ], subrace: [{ name: 'High', source: 'PHB', raceName: 'Elf', raceSource: 'PHB', entries: ['High elf description.'] }] }, 'races.json').records;
    await cache.put(revision.id, raw);
    const diagnostics: ImportDiagnostic[] = []; await materializeContent(cache, revision.id, diagnostics);
    expect(diagnostics.filter(diagnostic => diagnostic.severity === 'error')).toEqual([]);
    const { fixture, screen } = await setup(); await screen.chooseType('species'); fixture.detectChanges();
    expect(screen.total()).toBe(4); expect(screen.count(CONTENT_TYPES.find(type => type.id === 'species')!)).toBe(4);
    expect(screen.results().every(record => record.kind === 'species')).toBe(true);
    expect(screen.results().filter(record => record.name === 'Elf').map(record => record.publication).sort()).toEqual(['PHB', 'XPHB']);
    expect(screen.facets().find(facet => facet.key === 'kind')?.values).toEqual(['species', 'subrace']);
    expect(screen.facets().find(facet => facet.key === 'kind')?.values.map(value => facetLabel('kind', value))).toEqual(['Species', 'Subspecies']);
    const high = screen.results().find(record => record.name === 'High Elf')!;
    expect(high.species?.senses.darkvision).toBe(60);
    await screen.openDetails(high); fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.desktop-details').textContent).toContain('Base elf description.');
    expect(fixture.nativeElement.querySelector('.desktop-details').textContent).toContain('High elf description.');
    const dragonborn = [...fixture.nativeElement.querySelectorAll('.result-row')].find((row: any) => row.textContent.includes('Dragonborn')) as HTMLElement;
    expect(dragonborn.textContent).not.toContain('Darkvision');
    screen.filters = { kind: ['subrace'] }; await screen.search();
    expect(screen.results().map(record => record.name)).toEqual(['High Elf']);
    fixture.destroy();
  });

  it('uses the desktop detail panel and switches to the native sheet dialog on mobile', async () => {
    const { fixture, screen } = await setup();
    await screen.chooseType('feat'); await screen.openDetails(screen.results()[0]);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.desktop-details').textContent).toContain('Stay alert.');
    expect(fixture.nativeElement.querySelector('app-sheet-detail-dialog')).toBeNull();
    breakpoint.next({ matches: true, breakpoints: {} }); fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('app-sheet-detail-dialog')).not.toBeNull();
    screen.closeDetails(); fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('app-sheet-detail-dialog')).toBeNull();
    fixture.destroy();
  });

  it('provides combined Basic/Special and level filters on the facilities page', async () => {
    const facilities: ContentRecord[] = [
      { key: 'bedroom', kind: 'facility', name: 'Bedroom', publication: 'TEST', file: 'bastions.json', links: [], data: { facilityType: 'basic', entries: [] } },
      { key: 'study', kind: 'facility', name: 'Arcane Study', publication: 'TEST', file: 'bastions.json', links: [], data: { facilityType: 'special', level: 5, entries: [] } },
      { key: 'archive', kind: 'facility', name: 'Archive', publication: 'TEST', file: 'bastions.json', links: [], data: { facilityType: 'special', level: 13, entries: [] } },
    ];
    await cache.put(revision.id, facilities);
    const { fixture, screen } = await setup();
    await screen.chooseType('facility');
    expect(screen.total()).toBe(3);
    expect(screen.facets().find(facet => facet.key === 'facilityType')?.values).toEqual(['basic', 'special']);
    screen.filters = { facilityType: ['special'], facilityLevel: ['5'] }; await screen.search();
    expect(screen.results().map(record => record.name)).toEqual(['Arcane Study']);
    screen.filters = { facilityType: ['basic'], facilityLevel: ['unspecified'] }; await screen.search();
    expect(screen.results().map(record => record.name)).toEqual(['Bedroom']);
    screen.clearFilters(); await screen.search(); expect(screen.total()).toBe(3);
    fixture.destroy();
  });

  it('combines spell effect filters with other facets and sorts the complete result across pages', async () => {
    const { fixture, screen } = await setup();
    await screen.chooseType('spell');
    screen.effects = { damageTypes: ['fire'] }; screen.sort = 'level';
    await screen.search();
    expect(screen.total()).toBe(16); expect(screen.filterCount).toBe(1);
    screen.filters = { school: ['A'] }; await screen.search(); expect(screen.total()).toBe(0);
    screen.clearFilters(); screen.sort = 'level'; await screen.search();
    expect(screen.results().slice(0, 16).every(record => recordFacets(record).level?.[0] === '0')).toBe(true);
    await screen.turnPage(1);
    expect(screen.results().every(record => recordFacets(record).level?.[0] === '1')).toBe(true);
    fixture.destroy();
  });

  it('opens reference searches with the linked publication instead of unrelated shared defaults', async () => {
    const reward = mapContent({reward: [{name: 'Blasphemous Charm', source: 'RHW', type: 'Charm', entries: ['Read the reward.']}]}, 'rewards.json').records[0];
    await cache.put(revision.id, [reward]);
    TestBed.inject(SourceBookFilterService).setSelection(['XPHB']);
    const route = TestBed.inject(ActivatedRoute);
    Object.defineProperty(route.snapshot, 'queryParamMap', {value: convertToParamMap({q: 'Blasphemous Charm', source: 'rhw'})});
    const { fixture, screen } = await setup();
    await screen.chooseType('reward'); fixture.detectChanges();
    expect(screen.query).toBe('Blasphemous Charm'); expect(screen.filters.source).toEqual(['RHW']);
    expect(screen.results().map(row => row.key)).toEqual([reward.key]);
    expect(TestBed.inject(SourceBookFilterService).selected()).toEqual(['XPHB']);
  });
  it('shows monster identity and CR in the stat block without duplicating the metadata', () => {
    const fixture = TestBed.createComponent(CompendiumDetailsComponent);
    const record = mapContent({ monster: [{ name: 'Test monster', source: 'XMM', size: ['M'], type: 'humanoid', alignment: ['N'], cr: '15' }] }, 'monsters.json').records[0];
    fixture.componentRef.setInput('record', record); fixture.componentRef.setInput('revision', revision); fixture.detectChanges();
    const labels = fixture.componentInstance.metadata().map(field => field.label);
    for (const label of ['Size', 'Creature Type', 'Challenge Rating']) expect(labels).not.toContain(label);
    const overview = fixture.nativeElement.querySelector('[aria-label="Creature overview"]');
    expect(overview.textContent).toContain('Medium'); expect(overview.textContent).toContain('Humanoid');
    expect(overview.querySelector('[aria-label="Challenge Rating"]').textContent).toContain('15');
    fixture.destroy();
  });

  it('renders canonical reference descriptions and tables using the shared entry renderer', () => {
    const fixture = TestBed.createComponent(CompendiumDetailsComponent);
    const record: ContentRecord = { key: 'condition', kind: 'condition', name: 'Test Condition', publication: 'TEST', file: 'conditions.json', links: [], data: {},
      referenceDefinition: { version: 1, kind: 'condition', name: 'Test Condition', source: 'TEST', entries: ['Canonical condition description.'] } };
    fixture.componentRef.setInput('record', record); fixture.componentRef.setInput('revision', revision);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Canonical condition description.');
    fixture.componentRef.setInput('record', { ...record, kind: 'table', referenceDefinition: undefined,
      data: { caption: 'Outcomes', colLabels: ['Roll', 'Result'], rows: [['1', 'Success']] } });
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('table').textContent).toContain('Success');
    fixture.destroy();
  });

  it('renders canonical Bastion prerequisites and Special type in shared details, with a legacy fallback', () => {
    const fixture = TestBed.createComponent(CompendiumDetailsComponent);
    const record: ContentRecord = { key: 'arcane-study', kind: 'facility', name: 'Arcane Study', publication: 'XDMG', file: 'bastions.json', links: [], data: {},
      referenceDefinition: { version: 1, kind: 'facility', name: 'Arcane Study', source: 'XDMG', facilityType: 'special', level: 5,
        prerequisite: [{ spellcastingFocus: ['arcane', 'tool'] }], entries: ['A place of quiet research.'] } };
    fixture.componentRef.setInput('record', record); fixture.componentRef.setInput('revision', revision); fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Special');
    expect(fixture.nativeElement.textContent).not.toContain('Non-Basic');
    const requirements = fixture.nativeElement.querySelector('[aria-label="Prerequisites"]').textContent;
    expect(requirements).toContain('Arcane Focus'); expect(requirements).toContain(' OR '); expect(requirements).toContain('Tool');
    expect(requirements).not.toContain('Additional requirement');
    fixture.componentRef.setInput('record', { ...record, referenceDefinition: undefined, data: { prerequisite: [{ expertise: [{ skill: true }] }] } });
    fixture.detectChanges(); expect(fixture.nativeElement.querySelector('[aria-label="Prerequisites"]').textContent).toContain('Expertise in a skill');
    fixture.componentRef.setInput('record', { ...record, referenceDefinition: undefined, data: {} }); fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[aria-label="Prerequisites"]')).toBeNull();
    fixture.destroy();
  });

  it.each([false, true])('returns through related entry history with mobile=%s and resets on a new selection', async mobile => {
    const { fixture, screen } = await setup();
    await screen.chooseType('spell');
    breakpoint.next({ matches: mobile, breakpoints: {} });
    await screen.openDetails(data[0]);
    await screen.openRelated(data[1]);
    await screen.openRelated(data[2]); fixture.detectChanges();
    const back = fixture.nativeElement.querySelector(`button[aria-label="Back to ${data[1].name}"]`) as HTMLButtonElement;
    expect(back).not.toBeNull(); back.click();
    await vi.waitFor(() => expect(screen.detailLoading()).toBe(false));
    expect(screen.selected()?.key).toBe(data[1].key);
    expect(screen.detailHistory.previous()?.key).toBe(data[0].key);
    await screen.backDetails(); fixture.detectChanges();
    expect(screen.selected()?.key).toBe(data[0].key);
    expect(screen.detailHistory.previous()).toBeUndefined();
    await screen.openRelated(data[1]);
    await screen.openDetails(data[2]);
    expect(screen.detailHistory.previous()).toBeUndefined();
    await screen.openRelated(data[0]); screen.closeDetails();
    expect(screen.detailHistory.previous()).toBeUndefined();
    fixture.destroy();
  });

  it('does not let a slow search replace a newer result or publish a stale detail response', async () => {
    const { fixture, screen } = await setup();
    await screen.chooseType('spell');
    let resolve!: (value: { records: ContentRecord[]; total: number }) => void;
    vi.spyOn(IndexedDbContentCache.prototype, 'searchCategory').mockImplementationOnce(() => new Promise(done => { resolve = done; }));
    const pending = screen.search();
    screen.query = 'Spell 31'; await screen.search();
    resolve({ records: [data[0]], total: 999 }); await pending;
    expect(screen.total()).toBe(1); expect(screen.results()[0].name).toBe('Spell 31');
    const record = { ...data[0], links: [{ role: 'reference', target: data[1].key }] };
    let finish!: (value: ContentRecord) => void;
    vi.spyOn(IndexedDbContentCache.prototype, 'get').mockImplementationOnce(() => new Promise(done => { finish = done; }));
    const detail = screen.openDetails(record); screen.closeDetails(); finish(data[1]); await detail;
    expect(screen.selected()).toBeNull(); expect(screen.related()).toEqual([]);
    fixture.destroy();
  });

  it('reports read failures and unknown categories rather than showing misleading empty results', async () => {
    const { fixture, screen } = await setup();
    await screen.chooseType('missing'); expect(screen.invalidType()).toBe(true);
    vi.spyOn(IndexedDbContentCache.prototype, 'searchCategory').mockRejectedValueOnce(new Error('Read failed'));
    await screen.chooseType('spell');
    expect(screen.error()).toContain('Read failed'); expect(screen.loading()).toBe(false);
    fixture.destroy();
  });
});
