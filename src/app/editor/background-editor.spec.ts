import 'fake-indexeddb/auto';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { BackgroundEditorComponent } from './background-editor.component';
import { BackgroundDetailsComponent } from '../background-details.component';
import { emptyBasicCharacter } from './basic-info';
import { mapContent } from '../content/content-adapter';
import { ADAPTER_VERSION, DEFAULT_CONTENT_SOURCE, ImportRevision, sourceIdentity } from '../content/content.model';
import { IndexedDbContentCache } from '../content/content-cache';
import { IndexedDbCharacterRepository } from '../characters/indexeddb-character-repository';
import { characterDescription } from '../character-description';
import { MobileCharacterHeaderComponent } from '../sheet/mobile-character-header.component';
import { CharacterInfoPageComponent } from '../sheet/character-info-page.component';

describe('Optional backgrounds', () => {
  beforeEach(() => TestBed.configureTestingModule({ providers: [provideRouter([])] }));
  const revision = (): ImportRevision => ({ id: crypto.randomUUID(), namespace: 'development-local', source: DEFAULT_CONTENT_SOURCE,
    sourceIdentity: sourceIdentity(DEFAULT_CONTENT_SOURCE), commit: 'a'.repeat(40), adapterVersion: ADAPTER_VERSION,
    status: 'ready', createdAt: new Date().toISOString(), files: [], diagnostics: [], metrics: { bytes: 0, records: 2, mappedBytes: 0, elapsedMs: 0 } });
  const records = () => mapContent({ background: [
    { name: 'Sage', source: 'PHB', skillProficiencies: [{ arcana: true }], entries: ['Background reference text.'] },
    { name: 'Sailor', source: 'XPHB', entries: ['Sailor reference text.'] },
  ] }, 'backgrounds.json').records;

  it('supports a name-only custom background, editing a library name and skipping it completely', async () => {
    const fixture = TestBed.createComponent(BackgroundEditorComponent), sheet = emptyBasicCharacter();
    fixture.componentRef.setInput('sheet', sheet); await fixture.whenStable();
    const editor = fixture.componentInstance;
    editor.setCustom('Wandering Cook'); expect(sheet.background).toEqual({ name: 'Wandering Cook' });
    editor.catalog.revision.set(revision()); editor.select(records()[0]);
    editor.setCustom('Former Sage'); expect(sheet.background).toEqual({ name: 'Former Sage' });
    editor.setCustom('  '); expect(sheet.background).toBeUndefined();
    expect(characterDescription(sheet)).not.toContain('undefined');
    expect(sheet.character!.proficiencies).toBeUndefined(); expect(sheet.features).toBeUndefined();
  });

  it('browses imported backgrounds with book scope and search, then saves a detached offline reference', async () => {
    const imported = revision(), data = records(), cache = new IndexedDbContentCache();
    await cache.stage(imported); await cache.put(imported.id, data); await cache.activate(imported);
    await cache.saveSource('development-local', DEFAULT_CONTENT_SOURCE);
    const fixture = TestBed.createComponent(BackgroundEditorComponent), sheet = emptyBasicCharacter();
    fixture.componentRef.setInput('sheet', sheet); await fixture.whenStable();
    const editor = fixture.componentInstance; editor.books.setSelection(['PHB']); await editor.openCatalog();
    expect(editor.catalog.results().map(record => record.name)).toEqual(['Sage']);
    editor.search = 'sailor'; await editor.catalog.search(editor.query()); expect(editor.catalog.results()).toHaveLength(0);
    editor.books.setSelection([]); await editor.openCatalog(); expect(editor.catalog.results()[0].name).toBe('Sailor');
    editor.select(data[0]); expect(sheet.background!.entity!.entries).toEqual(['Background reference text.']);
    data[0].data['entries'] = ['Changed library']; expect(sheet.background!.entity!.entries).toEqual(['Background reference text.']);
    const repository = new IndexedDbCharacterRepository(); await repository.save(sheet, 0);
    const saved = (await repository.get(sheet.character!.characterUuid!))!.sheet;
    expect(saved.background).toEqual(sheet.background);
    const details = TestBed.createComponent(BackgroundDetailsComponent); details.componentRef.setInput('background', saved.background); details.detectChanges();
    details.nativeElement.querySelector('button').click(); await details.whenStable();
    expect(details.nativeElement.querySelector('[role="dialog"]').textContent).toContain('Background reference text.');
    expect(details.nativeElement.querySelector('app-catalog-dialog').classList.contains('compact')).toBe(true);
  });

  it('generates identity text from name, wizard classes, species and an optional background', () => {
    const sheet = emptyBasicCharacter(); sheet.character!.name = 'Mira'; sheet.species = { name: 'Elf' };
    sheet.creatorWizard = { revisionId: 'saved', classes: [
      { selectionId: 'wizard', classKey: '["class","wizard","phb"]', level: 3 },
      { selectionId: 'fighter', classKey: '["class","fighter","phb"]', level: 2 },
    ], answers: {}, options: {}, baseline: [], protectedPaths: [] };
    sheet.background = { name: 'Wandering Cook' };
    expect(characterDescription(sheet, true)).toBe('Mira — Elf Wizard 3 / Fighter 2 · Wandering Cook');
    delete sheet.background; expect(characterDescription(sheet)).toBe('Elf Wizard 3 / Fighter 2');
    delete sheet.creatorWizard; sheet.features = [{ name: 'Training', featureEntity: { name: 'Training', className: 'Ranger', source: 'PHB', classSource: 'PHB', level: 1, entries: [] } }];
    expect(characterDescription(sheet)).toBe('Elf Ranger');
  });

  it.each([MobileCharacterHeaderComponent, CharacterInfoPageComponent])('shows an inspectable background on the sheet in %s', async component => {
    const sheet = emptyBasicCharacter(); sheet.background = { name: 'Sage', source: 'PHB', entity: { entries: [{ text: 'Saved background entry.' }] } };
    const fixture = TestBed.createComponent(component); fixture.componentRef.setInput('characterData', sheet); fixture.detectChanges();
    fixture.nativeElement.querySelector('[aria-label="View background Sage"]').click(); await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('app-background-details [role="dialog"]').textContent).toContain('Saved background entry.');
    fixture.componentRef.setInput('characterData', { ...sheet, background: { name: 'Custom origin' } }); fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[aria-label^="View background"]')).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('Custom origin');
  });
});
