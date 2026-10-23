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

describe('Compendium catalog', () => {
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
    for (const kind of SOURCE_KINDS) expect(CONTENT_TYPES.some(type => (type.kinds as readonly string[]).includes(kind))).toBe(true);
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

  async function setup() {
    const fixture = TestBed.createComponent(CompendiumComponent);
    fixture.detectChanges();
    // IndexedDB work is not covered by Angular's stability promise.
    await vi.waitFor(() => expect(fixture.componentInstance.loading()).toBe(false));
    return { fixture, screen: fixture.componentInstance };
  }

  it('starts with category tiles and loads only the selected category with pagination', async () => {
    const { fixture, screen } = await setup();
    expect(screen.type()).toBeNull();
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

  it('keeps unavailable default sources visible and removable instead of silently including every book', async () => {
    TestBed.inject(SourceBookFilterService).setSelection(['NOT_INSTALLED']);
    const { fixture, screen } = await setup();
    await screen.chooseType('spell');
    expect(screen.total()).toBe(0);
    expect(screen.facets().find(facet => facet.key === 'source')?.values).toContain('NOT_INSTALLED');
    screen.toggle('source', 'NOT_INSTALLED'); await screen.search(); expect(screen.total()).toBe(32);
    expect(TestBed.inject(SourceBookFilterService).selected()).toEqual(['NOT_INSTALLED']);
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
