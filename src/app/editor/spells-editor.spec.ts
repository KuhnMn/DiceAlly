import 'fake-indexeddb/auto';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { vi } from 'vitest';
import { SpellsEditorComponent } from './spells-editor.component';
import { EntryAnnotationsComponent } from './entry-annotations.component';
import { emptyBasicCharacter, validateBasicInfo } from './basic-info';
import { IndexedDbCharacterRepository } from '../characters/indexeddb-character-repository';
import { IndexedDbContentCache } from '../content/content-cache';
import { mapContent } from '../content/content-adapter';
import { DEFAULT_CONTENT_SOURCE, ImportRevision, sourceIdentity } from '../content/content.model';
import { SpellEntryFull } from '../models/character.model';
import { SpellsPageComponent } from '../sheet/spells-page.component';
import { CharacterStore } from '../stores/character.store';
import { RestService } from '../services/rest.service';
import { SourceBookFilterService } from './source-book-filter.service';

async function catalog() {
  const source = { ...DEFAULT_CONTENT_SOURCE, owner: 'spell-editor-test' };
  const revision: ImportRevision = { id: crypto.randomUUID(), namespace: 'development-local', source,
    sourceIdentity: sourceIdentity(source), commit: 'b'.repeat(40), adapterVersion: 6, status: 'staging',
    createdAt: new Date().toISOString(), files: [], diagnostics: [], metrics: { bytes: 0, records: 44, elapsedMs: 0, mappedBytes: 0 } };
  const records = mapContent({ spell: [
    ...Array.from({ length: 40 }, (_, i) => ({ name: `Wizard ${String(i).padStart(2, '0')}`, source: 'TEST', level: i % 4, school: 'V', entries: ['Spell description'],
      classes: i % 2 ? { classVariant: [{ name: 'Wizard', source: 'TEST' }] } : { class: [{ name: 'Wizard', source: 'TEST' }] } })),
    { name: 'High spell', source: 'TEST', level: 4, school: 'V', classes: { fromClassList: [{ name: 'Wizard', source: 'TEST' }] } },
    { name: 'Bard only', source: 'TEST', level: 1, school: 'E', classes: { fromClassList: [{ name: 'Bard', source: 'TEST' }] } },
    { name: 'Wizard 00', source: 'OTHER', level: 0, school: 'V', classes: [{ name: 'Wizard', source: 'OTHER' }] },
  ] }, 'synthetic-spells.json').records;
  const cache = new IndexedDbContentCache();
  await cache.stage(revision); await cache.put(revision.id, records); await cache.activate(revision);
  await cache.saveSource('development-local', source);
  return { cache, revision, records };
}

describe('Spell creator and playing sheet', () => {
  beforeEach(() => {
    localStorage.removeItem('ally-creator-source-books');
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
  });

  it('combines multiple classes and non-contiguous levels for browsing and bulk addition', async () => {
    const data = await catalog();
    const records = mapContent({ spell: [
      { name: 'Multi Cantrip', source: 'TEST', level: 0, classes: { fromClassList: [{ name: 'Wizard' }] } },
      { name: 'Multi Artificer', source: 'TEST', level: 1, classes: { fromClassList: [{ name: 'Artificer' }] } },
      { name: 'Multi Shared', source: 'TEST', level: 9, classes: { fromClassList: [{ name: 'Wizard' }, { name: 'Artificer' }] } },
      { name: 'Multi Wrong Level', source: 'TEST', level: 2, classes: { fromClassList: [{ name: 'Wizard' }] } },
      { name: 'Multi Wrong Class', source: 'TEST', level: 1, classes: { fromClassList: [{ name: 'Bard' }] } },
    ] }, 'multiselect.json').records;
    await data.cache.put(data.revision.id, records);
    const fixture = TestBed.createComponent(SpellsEditorComponent);
    const sheet = emptyBasicCharacter(); fixture.componentRef.setInput('sheet', sheet); await fixture.whenStable();
    const editor = fixture.componentInstance; await editor.refreshContent();
    editor.filter.search = 'Multi';
    editor.toggleClass('Wizard'); editor.toggleClass('Artificer');
    editor.toggleCatalogLevel(0); editor.toggleCatalogLevel(1); editor.toggleCatalogLevel(9);
    await editor.searchContent();
    expect(editor.total()).toBe(3);
    await editor.addMatching();
    expect(sheet.spells!.map(spell => spell.name).sort()).toEqual(['Multi Artificer', 'Multi Cantrip', 'Multi Shared']);
    expect(sheet.spells!.filter(spell => spell.name === 'Multi Shared')).toHaveLength(1);
    editor.toggleDisplayedLevel(0); editor.toggleDisplayedLevel(9);
    expect(editor.selected.map(spell => spell.entity!.level)).toEqual([0, 9]);
    editor.filter.classes = []; await editor.searchContent(); expect(editor.total()).toBe(4);
    editor.filter.levels = []; await editor.searchContent(); expect(editor.total()).toBe(5);
  });

  it('bulk adds every matching page to Known, with class, maximum level and publication filters', async () => {
    await catalog();
    const fixture = TestBed.createComponent(SpellsEditorComponent);
    const sheet = emptyBasicCharacter();
    sheet.character!.featureSources = [{ name: 'Wizard', isSpellcastingSource: true, useSpellbook: true }];
    fixture.componentRef.setInput('sheet', sheet); await fixture.whenStable();
    const editor = fixture.componentInstance;
    await editor.refreshContent();
    editor.filter = { search: '', classes: ['Wizard'], levels: [0, 1, 2, 3] };
    const books = TestBed.inject(SourceBookFilterService); books.setSelection(['TEST']); await fixture.whenStable();
    await editor.searchContent();
    expect(editor.classNames()).toEqual(['Bard', 'Wizard']);
    expect(editor.total()).toBe(40); expect(editor.results()).toHaveLength(30);
    editor.nextPage(1); await fixture.whenStable();
    await editor.addMatching(); await editor.addMatching();
    expect(sheet.spells).toHaveLength(40);
    expect(sheet.spells!.every(spell => spell.listType === 'KNOWN' && spell.castingSourceName === 'Wizard' && spell.entity!.level <= 3)).toBe(true);
    expect(sheet.spells![0].entity?.classes).toEqual([{ name: 'Wizard', source: 'TEST' }]);
    expect(sheet.spells![0].contentReference?.commit).toBe('b'.repeat(40));
    books.setSelection(['OTHER']); await editor.addMatching(); expect(sheet.spells).toHaveLength(41);
    editor.selectedSource = 'Bard'; await editor.addMatching(); expect(sheet.spells).toHaveLength(42);
    const before = structuredClone(sheet.spells);
    vi.spyOn(IndexedDbContentCache.prototype, 'searchCategory').mockRejectedValueOnce(new Error('Read failed'));
    await editor.addMatching(); expect(sheet.spells).toEqual(before); expect(editor.message()).toContain('Could not add');
  });

  it('retains Known and Spellbook when preparing; stores editable note groups and independent uses offline', async () => {
    const data = await catalog();
    const fixture = TestBed.createComponent(SpellsEditorComponent);
    const sheet = emptyBasicCharacter();
    sheet.character!.featureSources = [{ name: 'Wizard', isSpellcastingSource: true, useSpellbook: true }, { name: 'Bard', isSpellcastingSource: true }];
    fixture.componentRef.setInput('sheet', sheet); await fixture.whenStable();
    const editor = fixture.componentInstance;
    await editor.refreshContent();
    editor.add(data.records[0]); const known = sheet.spells![0];
    editor.addToList(known, 'SPELLBOOK'); const book = sheet.spells![1];
    editor.addToList(book, 'PREPARED'); editor.addToList(known, 'PREPARED');
    expect(sheet.spells!.map(spell => spell.listType)).toEqual(['KNOWN', 'SPELLBOOK', 'PREPARED']);
    const prepared = sheet.spells![2];
    editor.list = 'PREPARED'; editor.toggle(prepared); fixture.detectChanges(); await fixture.whenStable();
    const annotations = fixture.debugElement.query(By.directive(EntryAnnotationsComponent)).componentInstance as EntryAnnotationsComponent;
    annotations.addNote(prepared); const group = prepared.notes![0]; group.tag = 'Tactics'; group.isEditable = false;
    annotations.addNoteEntry(group); annotations.noteDraft = 'First note'; annotations.commitNote();
    annotations.addNoteEntry(group); annotations.noteDraft = 'Second note'; annotations.commitNote();
    for (const recovery of ['SHORT_REST', 'SHORT_REST_ONE', 'LONG_REST', 'MANUAL']) {
      annotations.addUses(prepared); const use = prepared.uses!.at(-1)!;
      use.tag = 'Daily'; use.totalFreeUses = 3; use.usedFreeUses = 2; use.freeUsesRegainCondition = recovery;
    }
    expect(known.notes).toEqual([]); expect(book.uses).toEqual([]);
    expect(prepared.notes![0].notes).toEqual(['First note', 'Second note']);
    editor.remove(known); expect(sheet.spells).toHaveLength(3);
    editor.remove(book); expect(sheet.spells).toHaveLength(2); expect(editor.hasList(known, 'PREPARED')).toBe(true);
    editor.selectedSource = 'Bard'; editor.add(data.records[0]); const bard = sheet.spells!.at(-1)!;
    editor.addToList(bard, 'SPELLBOOK'); expect(sheet.spells).toHaveLength(3);
    fixture.detectChanges();
    validateBasicInfo(sheet);
    const repository = new IndexedDbCharacterRepository(); await repository.save(sheet, 0);
    const saved = (await repository.list()).find(entry => entry.id === sheet.character!.characterUuid)!.sheet;
    expect(saved.spells).toEqual(sheet.spells);
    editor.revision.set(null); editor.results.set([]); fixture.componentRef.setInput('sheet', saved); editor.toggle(saved.spells![1]); fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('First note');
    const rest = TestBed.inject(RestService); rest.performShortRest(saved);
    expect(saved.spells![1].uses!.map(use => use.usedFreeUses)).toEqual([0, 1, 2, 2]);
    rest.performLongRest(saved); expect(saved.spells![1].uses!.map(use => use.usedFreeUses)).toEqual([0, 0, 0, 2]);
    prepared.uses![0].totalFreeUses = -1; expect(() => validateBasicInfo(sheet)).toThrow();
  });

  it('locks preparation from every list when the prepared entry has uses, scoped to its casting source', async () => {
    const fixture = TestBed.createComponent(SpellsPageComponent);
    const sheet = emptyBasicCharacter();
    const known: SpellEntryFull = { name: 'Shield', source: 'PHB', castingSourceName: 'Wizard', listType: 'KNOWN', notes: [], uses: [] };
    const prepared: SpellEntryFull = { ...structuredClone(known), listType: 'PREPARED', uses: [{ tag: 'Daily', totalFreeUses: 1, usedFreeUses: 0 }] };
    const bard = { ...structuredClone(known), castingSourceName: 'Bard' };
    sheet.spells = [known, prepared, bard];
    fixture.componentRef.setInput('characterData', sheet); await fixture.whenStable();
    const page = fixture.componentInstance; const store = TestBed.inject(CharacterStore);
    const updated = vi.spyOn(store, 'setCharacter');
    expect(page.isPreparationLocked(known)).toBe(true); expect(page.isPreparationLocked(bard)).toBe(false);
    page.togglePreparedSpell(known, new Event('click')); expect(updated).not.toHaveBeenCalled();
    page.togglePreparedSpell(bard, new Event('click'));
    const result = store.characterData()!;
    expect(result.spells!.filter(spell => spell.listType === 'PREPARED')).toHaveLength(2);
    expect(sheet.spells).toHaveLength(3); // No mutation of the input list.
    const bardPrepared = result.spells!.at(-1)!; bardPrepared.notes!.push({ tag: 'Notes', notes: ['Prepared only'] });
    expect(bard.notes).toEqual([]);
    fixture.componentRef.setInput('characterData', result); fixture.detectChanges();
    const dialogs = TestBed.inject(AppDialogService);
    const cancelled = page.togglePreparedSpell(bard, new Event('click'));
    expect(dialogs.current()?.message).toContain('Shield');
    expect(store.characterData()).toBe(result);
    dialogs.finish(false);
    await cancelled;
    expect(store.characterData()).toBe(result);
    const confirmed = page.togglePreparedSpell(bard, new Event('click'));
    expect(dialogs.current()?.confirmLabel).toBe('Unprepare');
    dialogs.finish(true);
    await confirmed;
    expect(store.characterData()!.spells!.filter(spell => spell.listType === 'PREPARED')).toEqual([prepared]);
  });
});
import { AppDialogService } from '../services/app-dialog.service';
