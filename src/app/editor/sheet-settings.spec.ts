import 'fake-indexeddb/auto';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { By } from '@angular/platform-browser';
import { vi } from 'vitest';
import { LocalEditorComponent } from './local-editor.component';
import { NotesEditorComponent } from './notes-editor.component';
import { SheetSettingsEditorComponent } from './sheet-settings-editor.component';
import { CharacterLibraryService } from '../characters/character-library.service';
import { IndexedDbCharacterRepository } from '../characters/indexeddb-character-repository';
import { portableCharacter } from '../characters/portable-character';
import { encodeCloudCharacter } from '../characters/sync/character-cloud';
import { OPTIONAL_SHEET_PAGES } from '../models/sheet-pages';

describe('Character sheet page settings', () => {
  it('defaults to all pages and persists toggles while keeping hidden content editable', async () => {
    const repository = new IndexedDbCharacterRepository(`sheet-pages-${crypto.randomUUID()}`);
    await TestBed.configureTestingModule({ imports: [LocalEditorComponent], providers: [provideRouter([]), {
      provide: CharacterLibraryService, useValue: { changed: signal(0), get: (id: string) => repository.get(id), save: vi.fn((sheet, version) => repository.save(sheet, version)) },
    }] }).compileComponents();
    const fixture = TestBed.createComponent(LocalEditorComponent);
    await fixture.whenStable();
    const editor = fixture.componentInstance;
    editor.character.name = 'Hidden pages';
    editor.sheet.spells = [{ name: 'Keep Spell' }];
    editor.sheet.inventory = [{ name: 'Keep Rope', count: 2 }];
    editor.sheet.monsters = [{ name: 'Keep Companion' }];
    editor.sheet.combatActions = [{ name: 'Keep Action', actionType: 'ACTION' }];
    editor.sheet.notes = [{ id: 1, title: 'Keep Note', body: 'Keep this text' }];
    editor.setPage(editor.pages.indexOf('Sheet Settings')); fixture.detectChanges();
    const settings = fixture.debugElement.query(By.directive(SheetSettingsEditorComponent));
    const checkboxes = settings.nativeElement.querySelectorAll('input') as NodeListOf<HTMLInputElement>;
    expect(checkboxes.length).toBe(5);
    for (const checkbox of checkboxes) { expect(checkbox.checked).toBe(true); checkbox.click(); }
    fixture.detectChanges();
    expect(editor.unsaved).toBe(true);
    for (const page of OPTIONAL_SHEET_PAGES) expect(editor.sheet.sheetSettings?.visiblePages?.[page.key]).toBe(false);
    for (const [page, selector] of [['Combat', 'app-editor-combat'], ['Spells', 'app-editor-spells'], ['Items', 'app-editor-items'], ['Companions', 'app-editor-monsters'], ['Notes', 'app-editor-notes']]) {
      editor.setPage(editor.pages.indexOf(page)); fixture.detectChanges();
      expect(fixture.nativeElement.querySelector(selector)).not.toBeNull();
    }
    const notes = fixture.debugElement.query(By.directive(NotesEditorComponent)).componentInstance as NotesEditorComponent;
    notes.update(editor.sheet.notes[0], 'body', 'Updated while hidden');
    await editor.save();
    expect(editor.unsaved).toBe(false);
    const saved = (await repository.get(editor.character.characterUuid!))!;
    const exported = portableCharacter(saved.sheet);
    const cloud = await encodeCloudCharacter(saved, 1);
    expect(JSON.parse(cloud.body!).sheetSettings).toEqual(exported.sheetSettings);
    editor.open({ ...saved, sheet: exported }, true);
    editor.setPage(editor.pages.indexOf('Sheet Settings')); fixture.detectChanges();
    expect([...fixture.nativeElement.querySelectorAll('app-editor-sheet-settings input')].every((input: unknown) => !(input as HTMLInputElement).checked)).toBe(true);
    expect(editor.sheet.notes?.[0].body).toBe('Updated while hidden');
    expect(editor.sheet.spells?.[0].name).toBe('Keep Spell');
    expect(editor.sheet.inventory?.[0].name).toBe('Keep Rope');
    expect(editor.sheet.monsters?.[0].name).toBe('Keep Companion');
    expect(editor.sheet.combatActions?.[0].name).toBe('Keep Action');
  });

  it('edits notes in the character draft, preserves metadata and cancels removal safely', () => {
    const sheet = { notes: [{ id: 4, title: 'Existing', body: 'Body', orderIndex: 7 }] };
    const fixture = TestBed.createComponent(NotesEditorComponent);
    fixture.componentRef.setInput('sheet', sheet); fixture.detectChanges();
    const notes = fixture.componentInstance;
    notes.add();
    expect(sheet.notes[1]).toEqual({ id: 5, title: '', body: '', orderIndex: 8 });
    notes.update(sheet.notes[1], 'title', 'New'); fixture.changeDetectorRef.markForCheck(); fixture.detectChanges();
    expect((fixture.nativeElement.querySelectorAll('input')[1] as HTMLInputElement).value).toBe('New');
    notes.pendingRemoval.set(sheet.notes[0]); fixture.detectChanges();
    (fixture.nativeElement.querySelector('app-remove-entry-dialog .secondary-button') as HTMLButtonElement).click();
    expect(sheet.notes.length).toBe(2);
    notes.pendingRemoval.set(sheet.notes[0]); notes.remove();
    expect(sheet.notes).toEqual([{ id: 5, title: 'New', body: '', orderIndex: 8 }]);
  });
});
