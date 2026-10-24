import 'fake-indexeddb/auto';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
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
import { speciesBadges } from './species-summary';

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
  beforeEach(() => localStorage.removeItem('ally-creator-source-books'));
  afterEach(() => vi.restoreAllMocks());

  it('offers subclass-only books in the class list and finds only their exact parent editions', async () => {
    const f = await catalog(); TestBed.configureTestingModule({ providers: [provideRouter([])] });
    TestBed.inject(SourceBookFilterService).setSelection(['TCE', 'NOT_INSTALLED']);
    const fixture = TestBed.createComponent(ClassCompendiumComponent), screen = fixture.componentInstance;
    fixture.detectChanges(); await vi.waitFor(() => expect(screen.loading()).toBe(false));
    expect(screen.sources()).toEqual(['PHB', 'TCE', 'XGE', 'XPHB']);
    expect(screen.visibleClasses().map(record => record.publication)).toEqual(['PHB', 'XPHB']);
    fixture.detectChanges();
    let control = fixture.debugElement.query(By.directive(CompendiumSourceFilterComponent)).componentInstance as CompendiumSourceFilterComponent;
    expect(control.visibleBooks()).toEqual(['PHB', 'TCE', 'XGE', 'XPHB']);
    screen.selectedSources.set(['XGE']);
    expect(screen.visibleClasses().map(record => record.key)).toEqual([f.find('class', 'Mage').key]);
    await screen.chooseClass(f.find('class', 'Mage')); fixture.detectChanges();
    control = fixture.debugElement.query(By.directive(CompendiumSourceFilterComponent)).componentInstance as CompendiumSourceFilterComponent;
    expect(control.visibleBooks()).toEqual(['TCE', 'XGE']);
    expect(screen.visibleSubclasses().map(record => record.name)).toEqual(['Alternative School']);
    expect(TestBed.inject(SourceBookFilterService).selected()).toEqual(['NOT_INSTALLED', 'TCE']);
    fixture.destroy();
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

  it('inherits multiple sources into subclasses, keeps child overrides local and removes excluded subclass features', async () => {
    const f = await catalog(); TestBed.configureTestingModule({ providers: [provideRouter([])] });
    const defaults = TestBed.inject(SourceBookFilterService); defaults.setSelection(['PHB', 'TCE']);
    const fixture = TestBed.createComponent(ClassCompendiumComponent), screen = fixture.componentInstance;
    fixture.detectChanges(); await vi.waitFor(() => expect(screen.loading()).toBe(false));
    expect(screen.selectedSources()).toEqual(['PHB', 'TCE']);
    expect(screen.visibleClasses().map(record => record.publication)).toEqual(['PHB', 'PHB', 'XPHB']);
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
    expect(screen.subclassSources()).toEqual(['PHB', 'TCE']);
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

describe('Species reference badges', () => {
  const species = (source: string, darkvision?: number) => canonicalSpeciesRecord({ key: `species-${source}`, kind: 'species', name: 'Dragonborn', publication: source,
    file: 'species.json', links: [], data: { name: 'Dragonborn', source, size: ['M'], speed: 30, ...(darkvision ? { darkvision } : {}),
      resist: ['fire'], creatureTypes: ['humanoid'], entries: ['Species description.'] } });

  it('shows canonical darkvision and resistances without inventing senses for another edition', () => {
    expect(speciesBadges(species('XPHB', 60))).toEqual(['Darkvision 60 ft.', 'Fire · Resistance', 'Humanoid']);
    expect(speciesBadges(species('PHB')).some(badge => badge.startsWith('Darkvision'))).toBe(false);
  });

  it('shows species trait tags in the shared detail view', () => {
    const fixture = TestBed.createComponent(CompendiumDetailsComponent);
    fixture.componentRef.setInput('record', species('XPHB', 60)); fixture.componentRef.setInput('revision', { id: 'test' }); fixture.detectChanges();
    const badges = fixture.nativeElement.querySelector('[aria-label="Species traits"]').textContent;
    expect(badges).toContain('Darkvision 60 ft.'); expect(badges).toContain('Fire · Resistance'); fixture.destroy();
  });
});
