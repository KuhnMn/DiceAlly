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
    expect(tools.componentInstance.filteredTools.map(record => record.publication)).toEqual(['XPHB']);
    expect(features.componentInstance.selected).toHaveLength(2); expect(spells.componentInstance.selected).toHaveLength(2);
    expect(new SourceBookFilterService().selected()).toEqual(['XPHB']);
    filter.setSelection([]); await features.whenStable(); await spells.whenStable();
    await features.componentInstance.searchContent(); await spells.componentInstance.searchContent();
    expect(features.componentInstance.total()).toBe(2); expect(spells.componentInstance.total()).toBe(2);
    expect(tools.componentInstance.filteredTools).toHaveLength(2);
  });
});
