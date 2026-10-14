import 'fake-indexeddb/auto';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { SpeciesEditorComponent } from './species-editor.component';
import { EntryAnnotationsComponent } from './entry-annotations.component';
import { emptyBasicCharacter, validateBasicInfo } from './basic-info';
import { BasicInfoRepository } from './basic-info-repository';
import { IndexedDbContentCache } from '../content/content-cache';
import { ADAPTER_VERSION, ContentRecord, DEFAULT_CONTENT_SOURCE, ImportRevision, sourceIdentity } from '../content/content.model';
import { SourceBookFilterService } from './source-book-filter.service';
import { RestService } from '../services/rest.service';

async function library() {
  const source = { ...DEFAULT_CONTENT_SOURCE, owner: 'species-editor-test' };
  const revision: ImportRevision = { id: crypto.randomUUID(), namespace: 'development-local', source,
    sourceIdentity: sourceIdentity(source), commit: 'f'.repeat(40), adapterVersion: ADAPTER_VERSION, status: 'staging',
    createdAt: new Date().toISOString(), files: [], diagnostics: [], metrics: { bytes: 0, records: 2, elapsedMs: 0, mappedBytes: 0 } };
  const records: ContentRecord[] = ['Elf', 'Dwarf'].map((name, position) => ({ key: `species-${name}`, kind: 'species', name,
    publication: position ? 'PHB' : 'XPHB', file: 'materialized.json', links: [],
    data: { name, source: position ? 'PHB' : 'XPHB', speed: { walk: { number: 30 } }, entries: [`${name} ability description`] } }));
  const cache = new IndexedDbContentCache(); await cache.stage(revision); await cache.put(revision.id, records); await cache.activate(revision);
  await cache.saveSource('development-local', source); return { revision, records };
}
describe('Single species editor', () => {
  beforeEach(() => { localStorage.removeItem('ally-creator-source-books'); TestBed.configureTestingModule({ providers: [provideRouter([])] }); });

  it('selects one species with separate abilities, multiple notes and use trackers that persist offline', async () => {
    const data = await library(); const fixture = TestBed.createComponent(SpeciesEditorComponent);
    const sheet = emptyBasicCharacter(); fixture.componentRef.setInput('sheet', sheet); await fixture.whenStable();
    const editor = fixture.componentInstance; await editor.openCatalog(); expect(editor.results()).toHaveLength(2);
    editor.select(data.records[0]); fixture.detectChanges(); await fixture.whenStable();
    expect(sheet.species!.entity!.speed!.walk).toBe(30); expect(sheet.features).toBeUndefined();
    const annotations = fixture.debugElement.query(By.directive(EntryAnnotationsComponent)).componentInstance as EntryAnnotationsComponent;
    annotations.addNote(sheet.species!); const group = sheet.species!.notes![0]; group.tag = 'Traits'; group.isEditable = false;
    annotations.setNoteEntry(group, 0, 'First trait'); annotations.setNoteEntry(group, 1, 'Second trait');
    for (const recovery of ['SHORT_REST', 'SHORT_REST_ONE', 'LONG_REST', 'MANUAL']) {
      annotations.addUses(sheet.species!); const use = sheet.species!.uses!.at(-1)!;
      use.totalFreeUses = 3; use.usedFreeUses = 2; use.freeUsesRegainCondition = recovery;
    }
    const repository = new BasicInfoRepository(); await repository.save(sheet, 0);
    const saved = (await repository.list()).find(entry => entry.id === sheet.character!.characterUuid)!.sheet;
    expect(saved.species).toEqual(sheet.species);
    fixture.componentRef.setInput('sheet', saved); editor.revision.set(null); editor.results.set([]); fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('First trait'); expect(fixture.nativeElement.textContent).toContain('Species Abilities');
    const rest = TestBed.inject(RestService); rest.performShortRest(saved);
    expect(saved.species!.uses!.map(use => use.usedFreeUses)).toEqual([0, 1, 2, 2]);
    rest.performLongRest(saved); expect(saved.species!.uses!.map(use => use.usedFreeUses)).toEqual([0, 0, 0, 2]);
    saved.species!.uses![0].totalFreeUses = -1; expect(() => validateBasicInfo(saved)).toThrow();
  });

  it('filters source books and confirms replacement of annotated species without adding extra species', async () => {
    const data = await library(); const fixture = TestBed.createComponent(SpeciesEditorComponent);
    const sheet = emptyBasicCharacter();
    sheet.creatorWizard = { revisionId: data.revision.id, classes: [], answers: {}, options: {}, baseline: {}, protectedKeys: [] };
    fixture.componentRef.setInput('sheet', sheet); await fixture.whenStable();
    const editor = fixture.componentInstance; await editor.openCatalog(); editor.select(data.records[0]);
    sheet.species!.notes = [{ tag: 'Traits', notes: ['Keep unless replacing'] }];
    editor.catalogOpen = true; editor.select(data.records[1]); expect(sheet.species!.name).toBe('Elf');
    expect(editor.pendingChange?.action).toBe('Replace');
    editor.pendingChange = undefined;
    editor.select(data.records[1]); editor.confirmChange();
    expect(sheet.species!.name).toBe('Dwarf'); expect(sheet.species!.notes).toEqual([]);
    expect(sheet.creatorWizard!.speciesKey).toBe(data.records[1].key);
    const books = TestBed.inject(SourceBookFilterService); books.setSelection(['PHB']); await fixture.whenStable();
    await editor.searchContent(); expect(editor.results().map(record => record.name)).toEqual(['Dwarf']);
    editor.remove(); expect(sheet.species).toBeUndefined(); expect(sheet.creatorWizard!.speciesKey).toBeUndefined();
  });

  it('creates a custom species without a content import', async () => {
    const fixture = TestBed.createComponent(SpeciesEditorComponent); const sheet = emptyBasicCharacter();
    fixture.componentRef.setInput('sheet', sheet); await fixture.whenStable();
    const editor = fixture.componentInstance; editor.customName = 'Custom ancestry'; editor.customDescription = 'A custom ability'; editor.addCustom();
    expect(sheet.species!.name).toBe('Custom ancestry'); expect(sheet.species!.entity!.entries).toEqual([{ text: 'A custom ability' }]);
    expect(sheet.features).toBeUndefined(); validateBasicInfo(sheet);
  });
});
