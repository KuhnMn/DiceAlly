import 'fake-indexeddb/auto';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { SourceBookFilterComponent } from './source-book-filter.component';
import { SourceBookFilterService } from './source-book-filter.service';
import { FeaturesEditorComponent } from './features-editor.component';
import { SpellsEditorComponent } from './spells-editor.component';
import { OtherProficienciesComponent } from './other-proficiencies.component';
import { IndexedDbContentCache } from '../content/content-cache';
import { mapContent } from '../content/content-adapter';
import { ADAPTER_VERSION, DEFAULT_CONTENT_SOURCE, ImportRevision, sourceIdentity } from '../content/content.model';
import { emptyBasicCharacter } from './basic-info';
import { ClassWizardComponent } from './class-wizard.component';

describe('Shared creator Source Books filter', () => {
  beforeEach(() => {
    localStorage.removeItem('ally-creator-source-books');
    localStorage.removeItem('ally-hide-reprinted-content');
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
  });

  it('persists the shared reprint switch without changing books or removing existing character entries', async () => {
    const source = { ...DEFAULT_CONTENT_SOURCE, owner: `reprints-${crypto.randomUUID()}` };
    const revision: ImportRevision = { id: crypto.randomUUID(), namespace: 'development-local', source, sourceIdentity: sourceIdentity(source),
      commit: 'e'.repeat(40), adapterVersion: ADAPTER_VERSION, status: 'staging', createdAt: new Date().toISOString(), files: [], diagnostics: [],
      metrics: { bytes: 0, records: 4, mappedBytes: 0, elapsedMs: 0 } };
    const records = mapContent({ feat: [{ name: 'Old feat', source: 'PHB', isReprinted: true, entries: [] }, { name: 'Current feat', source: 'XPHB', entries: [] }],
      spell: [{ name: 'Old spell', source: 'PHB', level: 1, isReprinted: true }, { name: 'Current spell', source: 'XPHB', level: 1 }],
    }, 'reprints.json').records;
    const cache = new IndexedDbContentCache();
    await cache.stage(revision); await cache.put(revision.id, records); await cache.activate(revision); await cache.saveSource('development-local', source);
    const sheet = emptyBasicCharacter(); sheet.features = [{ editorId: 'existing', name: 'Old feat', source: 'PHB', featureType: 'FEAT' }];
    const features = TestBed.createComponent(FeaturesEditorComponent), spells = TestBed.createComponent(SpellsEditorComponent);
    features.componentRef.setInput('sheet', sheet); spells.componentRef.setInput('sheet', sheet);
    await features.whenStable(); await spells.whenStable();
    features.componentInstance.setType('FEAT');
    await features.componentInstance.refreshContent(); await spells.componentInstance.refreshContent();
    expect(features.componentInstance.total()).toBe(2); expect(spells.componentInstance.total()).toBe(2);
    const panel = TestBed.createComponent(SourceBookFilterComponent); await panel.whenStable();
    const checkbox = panel.nativeElement.querySelector('input[type="checkbox"]') as HTMLInputElement;
    checkbox.click(); await panel.whenStable(); await features.whenStable(); await spells.whenStable();
    await features.componentInstance.searchContent(); await spells.componentInstance.searchContent();
    expect(features.componentInstance.results().map(record => record.name)).toEqual(['Current feat']);
    expect(spells.componentInstance.results().map(record => record.name)).toEqual(['Current spell']);
    expect(features.componentInstance.selected.map(feature => feature.name)).toEqual(['Old feat']);
    expect(sheet.features).toHaveLength(1);
    const preferences = TestBed.inject(SourceBookFilterService);
    expect(preferences.selected()).toEqual([]);
    expect(new SourceBookFilterService().hideReprinted()).toBe(true);
    preferences.setSelection(['XPHB']); preferences.setSelection([]);
    expect(preferences.hideReprinted()).toBe(true);
    preferences.setHideReprinted(false); await features.whenStable(); await features.componentInstance.refreshContent();
    expect(features.componentInstance.total()).toBe(2);
    panel.destroy(); features.destroy(); spells.destroy();
  });

  it('hides deprecated wizard choices while retaining the currently selected class and subclass', () => {
    const records = mapContent({ class: [{ name: 'Druid', source: 'PHB', isReprinted: true }, { name: 'Druid', source: 'XPHB' }],
      subclass: [{ name: 'Old Stars', shortName: 'Stars', className: 'Druid', classSource: 'PHB', source: 'TCE', isReprinted: true }],
    }, 'classes.json').records;
    const fixture = TestBed.createComponent(ClassWizardComponent), wizard = fixture.componentInstance;
    fixture.componentRef.setInput('sheet', emptyBasicCharacter());
    records.forEach(record => wizard.records.set(record.key, record));
    const preferences = TestBed.inject(SourceBookFilterService); preferences.setHideReprinted(true);
    const oldClass = records.find(record => record.kind === 'class' && record.publication === 'PHB')!;
    const subclass = records.find(record => record.kind === 'subclass')!;
    const selection = { selectionId: 'druid', classKey: oldClass.key, subclassKey: subclass.key, level: 3 };
    expect(wizard.classes.map(record => record.publication)).toEqual(['XPHB']);
    expect(wizard.classOptions(selection).some(record => record.key === oldClass.key)).toBe(true);
    expect(wizard.subclasses(selection).map(record => record.key)).toEqual([subclass.key]);
    expect(wizard.subclasses({ ...selection, subclassKey: undefined })).toEqual([]);
    preferences.setHideReprinted(false); fixture.destroy();
  });

  it('derives catalog filter choices from source scope, including the source of spell-class memberships', async () => {
    const source = { ...DEFAULT_CONTENT_SOURCE, owner: 'source-option-test' };
    const revision: ImportRevision = { id: crypto.randomUUID(), namespace: 'development-local', source,
      sourceIdentity: sourceIdentity(source), commit: 'd'.repeat(40), adapterVersion: ADAPTER_VERSION, status: 'staging',
      createdAt: new Date().toISOString(), files: [], diagnostics: [], metrics: { bytes: 0, records: 8, elapsedMs: 0, mappedBytes: 0 } };
    const records = mapContent({
      spell: [
        { name: 'Shield', source: 'PHB', level: 1, school: 'A', classes: { fromClassList: [{ name: 'Wizard', source: 'PHB' }, { name: 'Warrior Sidekick', source: 'TCE' }] } },
        { name: 'Sidekick spell', source: 'TCE', level: 3, school: 'E', classes: { fromClassList: [{ name: 'Warrior Sidekick', source: 'TCE' }] } },
      ],
      classFeature: [
        { name: 'Training', source: 'PHB', className: 'Fighter', classSource: 'PHB', level: 1 },
        { name: 'Sidekick training', source: 'TCE', className: 'Warrior Sidekick', classSource: 'TCE', level: 6 },
      ],
      feat: [ { name: 'Origin feat', source: 'PHB', category: 'O' }, { name: 'Epic feat', source: 'TCE', category: 'EB', prerequisite: [{ level: 19 }] } ],
      optionalfeature: [ { name: 'Metamagic', source: 'PHB', featureType: ['MM'] }, { name: 'Invocation', source: 'TCE', featureType: ['EI'] } ],
    }, 'source-options.json').records;
    const cache = new IndexedDbContentCache(); await cache.stage(revision); await cache.put(revision.id, records); await cache.activate(revision); await cache.saveSource('development-local', source);
    const books = TestBed.inject(SourceBookFilterService); books.setSelection(['PHB']);
    const spells = TestBed.createComponent(SpellsEditorComponent), features = TestBed.createComponent(FeaturesEditorComponent);
    const sheet = emptyBasicCharacter(); spells.componentRef.setInput('sheet', sheet); features.componentRef.setInput('sheet', sheet);
    await spells.whenStable(); await features.whenStable(); await spells.componentInstance.refreshContent(); await features.componentInstance.refreshContent();
    expect(spells.componentInstance.classNames()).toEqual(['Wizard']);
    expect(spells.componentInstance.catalogLevels()).toEqual([1]);
    expect(spells.componentInstance.catalogSchools().map(school => school.value)).toEqual(['A']);
    expect(features.componentInstance.catalogOptions()).toEqual({ classes: ['Fighter'], levels: [1], categories: [] });
    spells.componentInstance.filter.classes = ['Wizard']; spells.componentInstance.filter.schools = ['A'];
    books.setSelection(['TCE']); await spells.whenStable(); await features.whenStable();
    await spells.componentInstance.refreshContent(); await features.componentInstance.refreshContent();
    // Selected spell filters remain visible so switching books cannot silently
    // broaden the search or discard choices the user may return to.
    expect(spells.componentInstance.classNames()).toEqual(['Warrior Sidekick', 'Wizard']);
    expect(spells.componentInstance.filter.classes).toEqual(['Wizard']); expect(spells.componentInstance.filter.schools).toEqual(['A']);
    expect(spells.componentInstance.catalogSchools().map(school => school.value)).toEqual(['A', 'E']);
    expect(spells.componentInstance.total()).toBe(0);
    expect(features.componentInstance.catalogOptions()).toEqual({ classes: ['Warrior Sidekick'], levels: [6], categories: [] });
    features.componentInstance.setType('FEAT'); await features.componentInstance.refreshContent();
    expect(features.componentInstance.catalogOptions().categories).toEqual(['EB']);
    features.componentInstance.catalogOpen = true; features.changeDetectorRef.markForCheck(); features.detectChanges();
    const root = features.nativeElement.querySelector('app-catalog-dialog');
    expect(root.querySelector('[aria-label="Feature class filters"]')).toBeNull();
    expect(root.querySelector('[aria-label="Feature level filters"]')).toBeNull();
    expect(root.querySelector('app-catalog-result-row').textContent).toContain('Epic Boon');
    expect(root.querySelector('app-catalog-result-row').textContent).not.toContain('Level 19');
    expect(root.querySelector('app-source-book-filter').closest('app-list-controls')).toBeNull();
    spells.componentInstance.clearCatalogFilters(); features.componentInstance.clearCatalogFilters();
    expect(books.selected()).toEqual(['TCE']);
  });

  it('filters features, spells and tools together while retaining selected sheet entries', async () => {
    const source = { ...DEFAULT_CONTENT_SOURCE, owner: 'source-books-test' };
    const revision: ImportRevision = { id: crypto.randomUUID(), namespace: 'development-local', source,
      sourceIdentity: sourceIdentity(source), commit: 'c'.repeat(40), adapterVersion: ADAPTER_VERSION, status: 'staging',
      createdAt: new Date().toISOString(), files: [], diagnostics: [], metrics: { bytes: 0, records: 6, elapsedMs: 0, mappedBytes: 0 } };
    const records = mapContent({
      feat: ['PHB', 'XPHB'].map(source => ({ name: 'Alert', source, entries: ['Description'] })),
      spell: ['PHB', 'XPHB'].map(source => ({ name: 'Shield', source, level: 1, classes: { fromClassList: [{ name: 'Wizard', source }] } })),
      item: ['PHB', 'XPHB'].map(source => ({ name: 'Tools', source, type: 'AT' })),
    }, 'source-books.json').records;
    const cache = new IndexedDbContentCache();
    await cache.stage(revision); await cache.put(revision.id, records); await cache.activate(revision); await cache.saveSource('development-local', source);
    const sheet = emptyBasicCharacter();
    sheet.character!.featureSources = [{ name: 'Wizard', isGeneralFeatureSource: true, isSpellcastingSource: true }];
    const features = TestBed.createComponent(FeaturesEditorComponent); features.componentRef.setInput('sheet', sheet); await features.whenStable();
    await features.componentInstance.refreshContent(); features.componentInstance.setType('FEAT'); await features.componentInstance.searchContent();
    const spells = TestBed.createComponent(SpellsEditorComponent); spells.componentRef.setInput('sheet', sheet); await spells.whenStable(); await spells.componentInstance.refreshContent();
    const tools = TestBed.createComponent(OtherProficienciesComponent); tools.componentRef.setInput('sheet', sheet); await tools.whenStable(); await tools.componentInstance.loadTools();
    const control = TestBed.createComponent(SourceBookFilterComponent); await control.whenStable(); await control.componentInstance.refresh();
    expect(control.componentInstance.books()).toEqual(['PHB', 'XPHB']);
    expect(features.componentInstance.results()).toHaveLength(2); expect(spells.componentInstance.results()).toHaveLength(2);
    for (const record of features.componentInstance.results()) features.componentInstance.add(record);
    for (const record of spells.componentInstance.results()) spells.componentInstance.add(record);
    const filter = TestBed.inject(SourceBookFilterService);
    filter.toggle('XPHB'); await features.whenStable(); await spells.whenStable();
    await features.componentInstance.searchContent(); await spells.componentInstance.searchContent();
    expect(features.componentInstance.results().map(record => record.publication)).toEqual(['XPHB']);
    expect(spells.componentInstance.results().map(record => record.publication)).toEqual(['XPHB']);
    expect(tools.componentInstance.availableTools.map(record => record.publication)).toEqual(['XPHB']);
    expect(features.componentInstance.selected).toHaveLength(2); expect(spells.componentInstance.selected).toHaveLength(2);
    expect(new SourceBookFilterService().selected()).toEqual(['XPHB']);
    filter.setSelection([]); await features.whenStable(); await spells.whenStable();
    await features.componentInstance.searchContent(); await spells.componentInstance.searchContent();
    expect(features.componentInstance.total()).toBe(2); expect(spells.componentInstance.total()).toBe(2);
    expect(tools.componentInstance.availableTools).toHaveLength(2);
  });
});
