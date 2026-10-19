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

describe('Shared creator Source Books filter', () => {
  beforeEach(() => {
    localStorage.removeItem('ally-creator-source-books');
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
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
    expect(spells.componentInstance.classNames()).toEqual(['Warrior Sidekick']);
    expect(spells.componentInstance.filter.classes).toEqual([]); expect(spells.componentInstance.filter.schools).toEqual([]);
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
      spell: ['PHB', 'XPHB'].map(source => ({ name: 'Shield', source, level: 1, classes: { class: [{ name: 'Wizard', source }] } })),
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
