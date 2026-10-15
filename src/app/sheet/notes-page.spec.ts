import { TestBed } from '@angular/core/testing';
import { NotesPageComponent } from './notes-page.component';
import { CharacterStore } from '../stores/character.store';

describe('Viewer notes', () => {
  function setup() {
    const fixture = TestBed.createComponent(NotesPageComponent);
    const store = TestBed.inject(CharacterStore);
    store.setCharacter({ character: { characterUuid: 'notes-test' }, notes: [
      { id: 1, title: 'Journal', body: '**First**', orderIndex: 0 },
      { id: 2, title: 'Journal', body: 'Second', orderIndex: 1 },
    ] });
    const refresh = () => { fixture.componentRef.setInput('characterData', store.characterData()); fixture.detectChanges(); };
    refresh();
    return { fixture, page: fixture.componentInstance, store, refresh };
  }

  it('groups entries and applies edits to the sheet exported by Quick Save', () => {
    const { page, store, refresh } = setup();
    page.add('Journal');
    page.draft()!.body = '*Third*';
    page.apply(); refresh();
    expect(page.sections().length).toBe(1);
    expect(page.sections()[0].entries.length).toBe(3);
    page.edit(page.sections()[0].entries[0]);
    page.draft()!.title = 'Adventure';
    page.draft()!.body = '# Updated';
    page.apply(); refresh();
    expect(store.characterData()!.notes![0].body).toBe('# Updated');
    expect(page.sections().map(section => section.title)).toEqual(['Adventure', 'Journal']);
    page.pendingRemoval.set(page.sections()[1].entries[0]); page.remove(); refresh();
    expect(store.characterData()!.notes!.map(note => note.body)).toEqual(['# Updated', '*Third*']);
  });

  it('cancels drafts without changing the original and renders Markdown safely', () => {
    const { fixture, page, store, refresh } = setup();
    page.edit(store.characterData()!.notes![0]); page.draft()!.body = 'Unsaved'; page.draft.set(null);
    expect(store.characterData()!.notes![0].body).toBe('**First**');
    expect(fixture.nativeElement.querySelector('strong').textContent).toBe('First');
    page.add(); page.draft()!.body = '<img src=x onerror=alert(1)><script>alert(1)</script>';
    page.apply(); refresh();
    expect(fixture.nativeElement.querySelector('img, script')).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('<img src=x');
  });
});
