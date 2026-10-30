import { subclassChoices } from '../content/class-compatibility';
import 'fake-indexeddb/auto';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { RouterTestingHarness } from '@angular/router/testing';
import { CompendiumComponent } from './compendium.component';
import { CompendiumSearchComponent } from './compendium-search.component';
import { vi } from 'vitest';
import { mapContent } from '../content/content-adapter';
import { canonicalClassRecord } from '../content/class-adapter';
import { canonicalSpeciesRecord } from '../content/species-adapter';
import { ADAPTER_VERSION, ContentRecord, DEFAULT_CONTENT_SOURCE, ImportRevision, sourceIdentity, entityKey } from '../content/content.model';
import { IndexedDbContentCache } from '../content/content-cache';
import { ClassCompendiumComponent } from './class-compendium.component';
import { belongsToClass, belongsToSubclass, groupProgression, loadProgression } from './class-compendium';
import { CompendiumDetailsComponent } from './compendium-details.component';
import { SourceBookFilterService } from '../editor/source-book-filter.service';
import { CompendiumSourceFilterComponent } from './compendium-source-filter.component';
import { By } from '@angular/platform-browser';
import { CompendiumFilterService } from './compendium-filter.service';

async function catalog() {
  const source = { ...DEFAULT_CONTENT_SOURCE, owner: `class-browser-${crypto.randomUUID()}` };
  const revision: ImportRevision = { id: crypto.randomUUID(), namespace: 'development-local', source, sourceIdentity: sourceIdentity(source),
    commit: 'a'.repeat(40), adapterVersion: ADAPTER_VERSION, status: 'staging', createdAt: new Date().toISOString(), files: [], diagnostics: [],
    metrics: { bytes: 0, records: 0, mappedBytes: 0, elapsedMs: 0 } };
  const records = mapContent({
    class: [
      { name: 'Mage', source: 'PHB', hd: { number: 1, faces: 6 }, classFeatures: ['Gift|Mage|PHB|1', 'Greater Gift|Mage|PHB|3'] },
      { name: 'Mage', source: 'XPHB', classFeatures: ['Modern Gift|Mage|XPHB|1'] },
      { name: 'Fighter', source: 'PHB', classFeatures: ['Training|Fighter|PHB|1'] },
    ],
    subclass: [
      { name: 'School', shortName: 'School', source: 'TCE', className: 'Mage', classSource: 'PHB', subclassFeatures: ['School Gift|Mage|PHB|School|TCE|3'] },
      { name: 'Alternative School', shortName: 'School', source: 'XGE', className: 'Mage', classSource: 'PHB', subclassFeatures: ['Alternative Gift|Mage|PHB|School|XGE|2'] },
      { name: 'Modern School', shortName: 'School', source: 'TCE', className: 'Mage', classSource: 'XPHB', subclassFeatures: ['Modern School Gift|Mage|XPHB|School|TCE|3'] },
    ],
    classFeature: [
      { name: 'Greater Gift', source: 'PHB', className: 'Mage', classSource: 'PHB', level: 3, entries: ['Greater gift description.'] },
      { name: 'Gift', source: 'PHB', className: 'Mage', classSource: 'PHB', level: 1, entries: ['Gift description.'] },
      { name: 'Unlisted Gift', source: 'PHB', className: 'Mage', classSource: 'PHB', level: 2 },
      { name: 'Modern Gift', source: 'XPHB', className: 'Mage', classSource: 'XPHB', level: 1 },
      { name: 'Training', source: 'PHB', className: 'Fighter', classSource: 'PHB', level: 1 },
    ],
    subclassFeature: [
      { name: 'School Gift', source: 'TCE', className: 'Mage', classSource: 'PHB', subclassShortName: 'School', subclassSource: 'TCE', level: 3, entries: ['School feature description.'] },
      { name: 'Alternative Gift', source: 'XGE', className: 'Mage', classSource: 'PHB', subclassShortName: 'School', subclassSource: 'XGE', level: 2 },
      { name: 'Modern School Gift', source: 'TCE', className: 'Mage', classSource: 'XPHB', subclassShortName: 'School', subclassSource: 'TCE', level: 3 },
    ],
  }, 'class-browser.json').records.map(canonicalClassRecord);
  const cache = new IndexedDbContentCache();
  await cache.stage(revision); await cache.put(revision.id, records); await cache.activate(revision); await cache.saveSource(revision.namespace, source);
  const find = (kind: string, name: string, publication = 'PHB') => records.find(record => record.kind === kind && record.name === name && record.publication === publication)!;
  return { cache, revision, records, find };
}

describe('Class compendium progression', () => {
  beforeEach(() => {
    localStorage.removeItem('ally-creator-source-books');
    localStorage.removeItem('ally-compendium-filters-v1');
  });
  afterEach(() => vi.restoreAllMocks());

  it('navigates from a global subclass search result to its exact class with that subclass active', async () => {
    const f = await catalog(), school = f.find('subclass', 'School', 'TCE');
    TestBed.configureTestingModule({ providers: [provideRouter([
      { path: 'compendium', component: CompendiumComponent },
      { path: 'compendium/class', component: ClassCompendiumComponent },
      { path: 'compendium/:type', component: CompendiumComponent },
    ])] });
    TestBed.inject(SourceBookFilterService).setSelection(['TCE']);
    const harness = await RouterTestingHarness.create('/compendium');
    const home = harness.routeDebugElement!.componentInstance as CompendiumComponent;
    await vi.waitFor(() => expect(home.revision()?.id).toBe(f.revision.id)); harness.detectChanges();
    const search = harness.routeDebugElement!.query(By.directive(CompendiumSearchComponent)).componentInstance as CompendiumSearchComponent;
    search.setQuery('School'); harness.detectChanges(); await search.search(); harness.detectChanges();
    const link = [...harness.routeNativeElement!.querySelectorAll('app-compendium-search a')].find(anchor => new URL((anchor as HTMLAnchorElement).href).searchParams.get('entry') === school.key) as HTMLAnchorElement;
    expect(link).toBeDefined(); link.click();
    await vi.waitFor(() => expect(harness.routeDebugElement?.componentInstance).toBeInstanceOf(ClassCompendiumComponent));
    const screen = harness.routeDebugElement!.componentInstance as ClassCompendiumComponent;
    await vi.waitFor(() => expect(screen.selectedSubclass()?.key).toBe(school.key));
    expect(screen.selectedClass()?.key).toBe(f.find('class', 'Mage').key);
    expect(screen.selectedSources()).toEqual(['TCE']);
  });

  it('opens the exact parent class and activates a searched subclass, including a parent outside the selected books', async () => {
    const f = await catalog(), school = f.find('subclass', 'School', 'TCE'), modern = f.find('subclass', 'Modern School', 'TCE');
    const queries = new BehaviorSubject(convertToParamMap({ entry: school.key, books: '["TCE"]' }));
    const snapshot = { queryParamMap: queries.value };
    TestBed.configureTestingModule({ providers: [provideRouter([]), { provide: ActivatedRoute, useValue: { queryParamMap: queries, snapshot } }] });
    TestBed.inject(SourceBookFilterService).setSelection(['XPHB']);
    TestBed.inject(CompendiumFilterService).save('class', { filters: { source: ['PHB'] }, effects: {} });
    TestBed.inject(CompendiumFilterService).save(`class:${f.find('class', 'Mage').key}`, { filters: { source: ['XGE'] }, effects: {} });
    const fixture = TestBed.createComponent(ClassCompendiumComponent), screen = fixture.componentInstance; fixture.detectChanges();
    await vi.waitFor(() => expect(screen.selectedSubclass()?.key).toBe(school.key));
    await vi.waitFor(() => expect(screen.subclassLoading()).toBe(false)); fixture.detectChanges();
    expect(screen.loading()).toBe(false); expect(screen.selectedClass()?.key).toBe(f.find('class', 'Mage').key);
    expect(screen.selectedSources()).toEqual(['TCE']); expect(screen.subclassSources()).toEqual(['TCE']);
    expect(screen.subclassFeatures().map(row => row.record.name)).toEqual(['School Gift']);
    expect(fixture.nativeElement.querySelector('.subclass-option[aria-pressed="true"]').textContent).toContain('School');
    snapshot.queryParamMap = convertToParamMap({ entry: modern.key, books: '["TCE"]' }); queries.next(snapshot.queryParamMap);
    await vi.waitFor(() => expect(screen.selectedSubclass()?.key).toBe(modern.key));
    expect(screen.selectedClass()?.key).toBe(f.find('class', 'Mage', 'XPHB').key);
    expect(screen.sourceDefaults.selected()).toEqual(['XPHB']);
    snapshot.queryParamMap = convertToParamMap({ entry: school.key, books: '["XPHB"]' }); queries.next(snapshot.queryParamMap);
    await vi.waitFor(() => expect(screen.navigationError()).toContain('excluded by Source Books'));
    expect(screen.selectedClass()).toBeNull(); expect(screen.selectedSubclass()).toBeNull();
    fixture.destroy();
  });

  it('filters class editions by their own books and offers subclass books in the detail view', async () => {
    const f = await catalog(); TestBed.configureTestingModule({ providers: [provideRouter([])] });
    TestBed.inject(SourceBookFilterService).setSelection(['TCE', 'NOT_INSTALLED']);
    const fixture = TestBed.createComponent(ClassCompendiumComponent), screen = fixture.componentInstance;
    fixture.detectChanges(); await vi.waitFor(() => expect(screen.loading()).toBe(false));
    expect(screen.sources()).toEqual(['PHB', 'XPHB']);
    expect(screen.visibleClasses()).toEqual([]);
    fixture.detectChanges();
    let control = fixture.debugElement.query(By.directive(CompendiumSourceFilterComponent)).componentInstance as CompendiumSourceFilterComponent;
    expect(control.visibleBooks()).toEqual(['PHB', 'XPHB']);
    const modernBook = [...(fixture.nativeElement as HTMLElement).querySelectorAll<HTMLLabelElement>('app-compendium-source-filter label')]
      .find(label => label.textContent.trim() === 'XPHB')!;
    (modernBook.querySelector('input') as HTMLInputElement).click(); fixture.detectChanges();
    expect(screen.visibleClasses().map(record => record.key)).toEqual([f.find('class', 'Mage', 'XPHB').key]);
    expect(fixture.nativeElement.querySelectorAll('[aria-label="Classes"] > button')).toHaveLength(1);
    control.toggle('PHB'); fixture.detectChanges();
    expect(screen.visibleClasses()).toHaveLength(3);
    control.toggle('XPHB'); fixture.detectChanges();
    expect(screen.visibleClasses().map(record => record.publication)).toEqual(['PHB', 'PHB']);
    control.selectedChange.emit([]); fixture.detectChanges();
    expect(screen.visibleClasses()).toHaveLength(3);
    screen.selectedSources.set(['XGE']);
    expect(screen.visibleClasses()).toEqual([]);
    await screen.chooseClass(f.find('class', 'Mage')); fixture.detectChanges();
    control = fixture.debugElement.query(By.directive(CompendiumSourceFilterComponent)).componentInstance as CompendiumSourceFilterComponent;
    expect(control.visibleBooks()).toEqual(['TCE', 'XGE']);
    expect(screen.visibleSubclasses().map(record => record.name)).toEqual(['Alternative School']);
    expect(TestBed.inject(SourceBookFilterService).selected()).toEqual(['NOT_INSTALLED', 'TCE']);
    fixture.destroy();
  });

  it('remembers class sources across visits and preserves All Books independently of shared defaults', async () => {
    await catalog(); TestBed.configureTestingModule({ providers: [provideRouter([])] });
    const defaults = TestBed.inject(SourceBookFilterService); defaults.setSelection(['PHB']);
    const first = TestBed.createComponent(ClassCompendiumComponent); first.detectChanges();
    await vi.waitFor(() => expect(first.componentInstance.loading()).toBe(false));
    first.componentInstance.setSources(['XPHB']); first.destroy();
    const second = TestBed.createComponent(ClassCompendiumComponent); second.detectChanges();
    await vi.waitFor(() => expect(second.componentInstance.loading()).toBe(false));
    expect(second.componentInstance.selectedSources()).toEqual(['XPHB']);
    expect(second.componentInstance.visibleClasses().map(record => record.publication)).toEqual(['XPHB']);
    second.componentInstance.setSources([]); second.destroy();
    const third = TestBed.createComponent(ClassCompendiumComponent); third.detectChanges();
    await vi.waitFor(() => expect(third.componentInstance.loading()).toBe(false));
    expect(third.componentInstance.selectedSources()).toEqual([]);
    expect(third.componentInstance.visibleClasses()).toHaveLength(3);
    expect(defaults.selected()).toEqual(['PHB']);
    third.destroy();
  });

  it('uses exact class references and keeps same-name editions and unrelated features apart', async () => {
    const f = await catalog(), owner = f.find('class', 'Mage');
    const base = await loadProgression(f.cache, f.revision.id, owner);
    expect(base.rows.map(row => row.record.name)).toEqual(['Gift', 'Greater Gift']);
    expect(base.missing).toEqual([]);
    expect(belongsToClass(f.find('subclass', 'School', 'TCE'), owner)).toBe(true);
    expect(belongsToClass(f.find('subclass', 'Modern School', 'TCE'), owner)).toBe(false);
    expect(belongsToClass(f.find('classFeature', 'Training'), owner)).toBe(false);
    expect(belongsToClass(f.find('classFeature', 'Modern Gift', 'XPHB'), owner)).toBe(false);
  });

  it('adds only the selected subclass, groups by level and keeps the base progression intact', async () => {
    const f = await catalog(), owner = f.find('class', 'Mage'), subclass = f.find('subclass', 'School', 'TCE');
    const base = await loadProgression(f.cache, f.revision.id, owner);
    const added = await loadProgression(f.cache, f.revision.id, owner, subclass);
    expect(belongsToSubclass(f.find('subclassFeature', 'Alternative Gift', 'XGE'), owner, subclass)).toBe(false);
    expect(belongsToSubclass(f.find('subclassFeature', 'Modern School Gift', 'TCE'), owner, subclass)).toBe(false);
    const groups = groupProgression(base.rows, added.rows);
    expect(groups.map(group => group.level)).toEqual([1, 3]);
    expect(groups[1].features.map(row => row.record.name)).toEqual(['Greater Gift', 'School Gift']);
    expect(groups[1].features.map(row => row.subclass)).toEqual([false, true]);
    expect(groupProgression(base.rows, [], 'Gift').flatMap(group => group.features)).toHaveLength(2);
    expect(base.rows).toHaveLength(2);
  });

  it('shows classic subclass features in the revised class list and moves early features to level 3', async () => {
    const f = await catalog();
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    const fixture = TestBed.createComponent(ClassCompendiumComponent), screen = fixture.componentInstance;
    fixture.detectChanges(); await vi.waitFor(() => expect(screen.loading()).toBe(false));
    await screen.chooseClass(f.find('class', 'Mage', 'XPHB'));
    screen.setSubclassSources([]); fixture.detectChanges();
    const subclass = f.find('subclass', 'Alternative School', 'XGE');
    const select = fixture.nativeElement.querySelector('select[aria-label="Subclass"]') as HTMLSelectElement;
    expect([...select.options].some(option => option.value === subclass.key)).toBe(true);
    select.value = subclass.key; select.dispatchEvent(new Event('change'));
    await vi.waitFor(() => expect(screen.subclassLoading()).toBe(false)); fixture.detectChanges();
    expect(screen.selectedSubclass()?.key).toBe(subclass.key);
    expect(screen.progressionError()).toBe(''); expect(screen.missingCount()).toBe(0);
    expect(screen.subclassFeatures().map(row => [row.record.name, row.level])).toEqual([['Alternative Gift', 3]]);
    expect(screen.levels().map(group => group.level)).toEqual([1, 3]);
    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('[aria-label="Level 3 features"]')?.textContent).toContain('Alternative Gift');
    expect(root.querySelector('[aria-label="Level 1 features"]')?.textContent).toContain('Modern Gift');
    expect(root.querySelector('[aria-label="Level 2 features"]')).toBeNull();
    fixture.destroy();
  });

  it('loads synthetic subclass copies and legacy fallback lists without mixing other subclass identities', async () => {
    const f = await catalog(), owner = f.find('class', 'Mage', 'XPHB');
    const selected = structuredClone(f.find('subclass', 'Alternative School', 'XGE'));
    selected.classDefinition!.parent = { key: owner.key, name: owner.name, source: owner.publication };
    const before = JSON.stringify(selected);
    const result = await loadProgression(f.cache, f.revision.id, owner, selected);
    expect(result.missing).toEqual([]);
    expect(result.rows.map(row => [row.record.name, row.level])).toEqual([['Alternative Gift', 3]]);
    expect(result.rows[0].record.classDefinition!.level).toBe(2);
    expect(JSON.stringify(selected)).toBe(before);
    selected.classDefinition!.features = [];
    const fallback = await loadProgression(f.cache, f.revision.id, owner, selected);
    expect(fallback.rows.map(row => row.record.name)).toEqual(['Alternative Gift']);
    const original = f.find('subclass', 'School', 'TCE');
    expect(belongsToSubclass(f.find('subclassFeature', 'Modern School Gift', 'TCE'), owner, original)).toBe(false);
  });

  it('offers a classic subclass only once on a revised class and preserves selection and features', async () => {
    const f = await catalog(), owner = f.find('class', 'Mage', 'XPHB');
    const original = f.find('subclass', 'Alternative School', 'XGE');
    const copy = structuredClone(original);
    copy.key = entityKey('subclass', { name: copy.name, source: copy.publication,
      className: owner.name, classSource: owner.publication });
    copy.classDefinition!.parent = { key: owner.key, name: owner.name, source: owner.publication };
    await f.cache.put(f.revision.id, [copy]);
    expect(subclassChoices([original, copy], owner)).toEqual([copy]);
    expect(subclassChoices([copy, original], owner)).toEqual([copy]);
    const otherBook = { ...original, key: 'other-book', publication: 'TEST' };
    const variant = { ...original, key: 'homebrew-variant', homebrewVariant: { originalKey: original.key, number: 1 } };
    const modern = { ...copy, key: 'modern-edition', data: { ...copy.data, edition: 'one' } };
    expect(subclassChoices([original, copy, otherBook, variant, modern], owner)).toEqual([copy, otherBook, variant, modern]);

    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    const fixture = TestBed.createComponent(ClassCompendiumComponent), screen = fixture.componentInstance;
    fixture.detectChanges(); await vi.waitFor(() => expect(screen.loading()).toBe(false));
    await screen.chooseClass(owner); screen.setSubclassSources([]); fixture.detectChanges();
    const select = fixture.nativeElement.querySelector('select[aria-label="Subclass"]') as HTMLSelectElement;
    expect([...select.options].filter(option => option.textContent?.includes(original.name))).toHaveLength(1);
    expect([...fixture.nativeElement.querySelectorAll('.subclass-option')]
      .filter((button: any) => button.textContent.includes(original.name))).toHaveLength(1);
    // Old links to the original record resolve to the visible choice as well.
    await screen.chooseSubclass(original); fixture.detectChanges();
    expect(screen.selectedSubclass()?.key).toBe(copy.key);
    expect(select.value).toBe(copy.key);
    expect(screen.missingCount()).toBe(0);
    expect(screen.subclassFeatures().map(row => [row.record.name, row.level])).toEqual([['Alternative Gift', 3]]);
    await screen.chooseClass(f.find('class', 'Mage')); screen.setSubclassSources([]);
    expect(screen.visibleSubclasses().find(record => record.name === original.name)?.key).toBe(original.key);
    fixture.destroy();
  });

  it('reports missing references and supports legacy parent-only progressions without including subclasses', async () => {
    const f = await catalog(), owner = f.find('class', 'Mage');
    const partial = structuredClone(owner);
    const missingKey = entityKey('classFeature', { name: 'Missing Gift', source: 'PHB', className: 'Mage', classSource: 'PHB', level: 1 });
    partial.classDefinition!.features[0] = { key: missingKey, uid: 'Missing Gift|Mage|PHB|1' };
    const result = await loadProgression(f.cache, f.revision.id, partial);
    expect(result.rows.map(row => row.record.name)).toEqual(['Greater Gift']); expect(result.missing).toEqual([missingKey]);
    const historical = structuredClone(owner); historical.classDefinition!.features = [];
    const fallback = await loadProgression(f.cache, f.revision.id, historical);
    expect(fallback.rows.map(row => row.record.name).sort()).toEqual(['Gift', 'Greater Gift', 'Unlisted Gift']);
  });

  it('replaces subclass features when switching and opens feature descriptions without losing the class selection', async () => {
    const f = await catalog();
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    const fixture = TestBed.createComponent(ClassCompendiumComponent), screen = fixture.componentInstance;
    fixture.detectChanges(); await vi.waitFor(() => expect(screen.loading()).toBe(false));
    expect(screen.classes()).toHaveLength(3);
    const owner = f.find('class', 'Mage'); await screen.chooseClass(owner); fixture.detectChanges();
    expect(screen.subclasses().map(record => record.name)).toEqual(['Alternative School', 'School']);
    await screen.chooseSubclass(f.find('subclass', 'School', 'TCE'));
    await screen.chooseSubclass(f.find('subclass', 'Alternative School', 'XGE'));
    expect(screen.levels().map(group => group.level)).toEqual([1, 2, 3]);
    expect(screen.subclassFeatures().map(row => row.record.name)).toEqual(['Alternative Gift']);
    await screen.chooseSubclass(null); expect(screen.levels().map(group => group.level)).toEqual([1, 3]);
    await screen.openDetails(f.find('classFeature', 'Gift')); fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('app-sheet-detail-dialog').textContent).toContain('Gift description.');
    screen.closeDetails(); expect(screen.selectedClass()?.key).toBe(owner.key);
    expect(screen.baseFeatures()).toHaveLength(2); fixture.destroy();
  });

  it('keeps class overviews inline and shows navigable related entries only in feature details', async () => {
    const f = await catalog(); TestBed.configureTestingModule({ providers: [provideRouter([])] });
    const owner = f.find('class', 'Mage'), school = f.find('subclass', 'School', 'TCE');
    owner.data['entries'] = ['Inline class introduction.']; school.data['entries'] = ['Inline subclass introduction.'];
    await f.cache.put(f.revision.id, [owner, school]);
    const fixture = TestBed.createComponent(ClassCompendiumComponent), screen = fixture.componentInstance;
    fixture.detectChanges(); await vi.waitFor(() => expect(screen.loading()).toBe(false));
    await screen.chooseClass(owner); fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[aria-label="Selected class"]').textContent).toContain('Inline class introduction.');
    expect(fixture.nativeElement.textContent).not.toContain('Class Details');
    expect(fixture.nativeElement.querySelector('app-sheet-detail-dialog')).toBeNull();
    const select = fixture.nativeElement.querySelector('select[aria-label="Subclass"]') as HTMLSelectElement;
    expect(select.options.length).toBe(3);
    select.value = school.key; select.dispatchEvent(new Event('change'));
    await vi.waitFor(() => expect(screen.subclassLoading()).toBe(false)); fixture.detectChanges();
    expect(screen.selectedSubclass()?.key).toBe(school.key);
    expect(fixture.nativeElement.querySelector('[aria-label="Selected subclass description"]').textContent).toContain('Inline subclass introduction.');
    const feature = f.find('classFeature', 'Gift');
    feature.links = [{ role: 'related', target: f.find('classFeature', 'Greater Gift').key }];
    const get = vi.spyOn(IndexedDbContentCache.prototype, 'get');
    expect(get).not.toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).not.toContain('Related Entries');
    await screen.openDetails(feature); fixture.detectChanges();
    expect(get).toHaveBeenCalledWith(f.revision.id, f.find('classFeature', 'Greater Gift').key);
    expect(fixture.nativeElement.querySelector('app-sheet-detail-dialog').textContent).toContain('Gift description.');
    const dialog = fixture.nativeElement.querySelector('app-sheet-detail-dialog') as HTMLElement;
    expect(dialog.textContent).toContain('Related Entries');
    const related = [...dialog.querySelectorAll('button')].find(button => button.textContent?.includes('Greater Gift'))!;
    related.click();
    await vi.waitFor(() => expect(screen.detailLoading()).toBe(false)); fixture.detectChanges();
    expect(screen.detail()?.key).toBe(f.find('classFeature', 'Greater Gift').key);
    expect(fixture.nativeElement.querySelector('app-sheet-detail-dialog').textContent).toContain('Greater gift description.');
    const back = fixture.nativeElement.querySelector('button[aria-label="Back to Gift"]') as HTMLButtonElement;
    expect(back).not.toBeNull(); back.click();
    await vi.waitFor(() => expect(screen.detailLoading()).toBe(false)); fixture.detectChanges();
    expect(screen.detail()?.key).toBe(feature.key);
    expect(fixture.nativeElement.querySelector('button[aria-label="Back to Gift"]')).toBeNull();
    expect(fixture.nativeElement.querySelector('[aria-label="Selected class"]').textContent).not.toContain('Related Entries');
    expect(fixture.nativeElement.querySelector('[aria-label="Selected subclass description"]').textContent).not.toContain('Related Entries');
    screen.closeDetails(); screen.setSubclassSources(['XGE']); fixture.detectChanges();
    expect(screen.selectedSubclass()).toBeNull();
    expect(fixture.nativeElement.querySelector('[aria-label="Selected subclass description"]')).toBeNull();
    expect(screen.baseFeatures()).toHaveLength(2);
    fixture.destroy();
  });

  it('discards related entries that finish loading after the feature dialog closes', async () => {
    const f = await catalog(); TestBed.configureTestingModule({ providers: [provideRouter([])] });
    const fixture = TestBed.createComponent(ClassCompendiumComponent), screen = fixture.componentInstance;
    fixture.detectChanges(); await vi.waitFor(() => expect(screen.loading()).toBe(false));
    const feature = f.find('classFeature', 'Gift'), related = f.find('classFeature', 'Greater Gift');
    feature.links = [{ role: 'related', target: related.key }];
    let resolve!: (record: ContentRecord) => void;
    vi.spyOn(IndexedDbContentCache.prototype, 'get').mockImplementationOnce(() => new Promise<ContentRecord>(done => { resolve = done; }));
    const loading = screen.openDetails(feature);
    expect(screen.detailLoading()).toBe(true);
    screen.closeDetails(); resolve(related); await loading;
    expect(screen.detail()).toBeNull();
    expect(screen.related()).toEqual([]);
    expect(screen.detailLoading()).toBe(false);
    fixture.destroy();
  });

  it('inherits multiple sources into subclasses, keeps child overrides local and removes excluded subclass features', async () => {
    const f = await catalog(); TestBed.configureTestingModule({ providers: [provideRouter([])] });
    const defaults = TestBed.inject(SourceBookFilterService); defaults.setSelection(['PHB', 'TCE']);
    const fixture = TestBed.createComponent(ClassCompendiumComponent), screen = fixture.componentInstance;
    fixture.detectChanges(); await vi.waitFor(() => expect(screen.loading()).toBe(false));
    expect(screen.selectedSources()).toEqual(['PHB', 'TCE']);
    expect(screen.visibleClasses().map(record => record.publication)).toEqual(['PHB', 'PHB']);
    await screen.chooseClass(f.find('class', 'Mage')); fixture.detectChanges();
    expect(screen.subclassSources()).toEqual(['PHB', 'TCE']);
    expect(screen.visibleSubclasses().map(record => record.name)).toEqual(['School']);
    const control = fixture.debugElement.query(By.directive(CompendiumSourceFilterComponent)).componentInstance as CompendiumSourceFilterComponent;
    control.toggle('XGE'); fixture.detectChanges();
    expect(screen.visibleSubclasses()).toHaveLength(2);
    await screen.chooseSubclass(f.find('subclass', 'School', 'TCE'));
    expect(screen.subclassFeatures()).toHaveLength(1);
    screen.setSubclassSources(['XGE']); fixture.detectChanges();
    expect(screen.selectedSubclass()).toBeNull(); expect(screen.subclassFeatures()).toEqual([]);
    expect(screen.baseFeatures()).toHaveLength(2);
    expect(screen.visibleSubclasses().map(record => record.name)).toEqual(['Alternative School']);
    expect(screen.selectedSources()).toEqual(['PHB', 'TCE']);
    expect(defaults.selected()).toEqual(['PHB', 'TCE']);
    screen.showAllClasses(); await screen.chooseClass(f.find('class', 'Mage'));
    expect(screen.subclassSources()).toEqual(['XGE']);
    screen.setSubclassSources([]); expect(screen.visibleSubclasses()).toHaveLength(2);
    fixture.destroy();
  });

  it('discards pending subclass features when a source filter excludes that subclass', async () => {
    const f = await catalog(); TestBed.configureTestingModule({ providers: [provideRouter([])] });
    const fixture = TestBed.createComponent(ClassCompendiumComponent), screen = fixture.componentInstance;
    fixture.detectChanges(); await vi.waitFor(() => expect(screen.loading()).toBe(false));
    await screen.chooseClass(f.find('class', 'Mage'));
    let finish!: (record: ContentRecord) => void;
    vi.spyOn(IndexedDbContentCache.prototype, 'get').mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    const pending = screen.chooseSubclass(f.find('subclass', 'School', 'TCE'));
    screen.setSubclassSources(['XGE']);
    finish(f.find('subclassFeature', 'School Gift', 'TCE')); await pending;
    expect(screen.selectedSubclass()).toBeNull(); expect(screen.subclassFeatures()).toEqual([]);
    fixture.destroy();
  });

  it('discards a late subclass response after another subclass has been selected', async () => {
    const f = await catalog(); TestBed.configureTestingModule({ providers: [provideRouter([])] });
    const fixture = TestBed.createComponent(ClassCompendiumComponent), screen = fixture.componentInstance;
    fixture.detectChanges(); await vi.waitFor(() => expect(screen.loading()).toBe(false));
    await screen.chooseClass(f.find('class', 'Mage'));
    let finish!: (record: ContentRecord) => void;
    vi.spyOn(IndexedDbContentCache.prototype, 'get').mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    const pending = screen.chooseSubclass(f.find('subclass', 'School', 'TCE'));
    await screen.chooseSubclass(f.find('subclass', 'Alternative School', 'XGE'));
    finish(f.find('subclassFeature', 'School Gift', 'TCE')); await pending;
    expect(screen.subclassFeatures().map(row => row.record.name)).toEqual(['Alternative Gift']); fixture.destroy();
  });
});

describe('Species reference presentation', () => {
  const species = (source: string, darkvision?: number) => canonicalSpeciesRecord({ key: `species-${source}`, kind: 'species', name: 'Dragonborn', publication: source,
    file: 'species.json', links: [], data: { name: 'Dragonborn', source, size: ['M'], speed: 30, ...(darkvision ? { darkvision } : {}),
      resist: ['fire'], creatureTypes: ['humanoid'], entries: ['Species description.'] } });

  it('shows species descriptions without viewer trait badges in compendium details', () => {
    const fixture = TestBed.createComponent(CompendiumDetailsComponent);
    fixture.componentRef.setInput('record', species('XPHB', 60)); fixture.componentRef.setInput('revision', { id: 'test' }); fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[aria-label="Species traits"]')).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('Species description.'); fixture.destroy();
  });
});
