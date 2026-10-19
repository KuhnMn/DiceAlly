import 'fake-indexeddb/auto';
import { TestBed } from '@angular/core/testing';
import { EntryAnnotationsComponent } from './entry-annotations.component';
import { EditorEntryRowComponent } from './editor-entry-row.component';
import { AnnotatedEntry } from './entry-annotations-editor';
import { emptyBasicCharacter } from './basic-info';
import { prefillCombatAction } from './combat-actions';
import { CharacterHelpersService } from '../sheet/character-helpers.service';
import { CatalogResultRowComponent } from './catalog-result-row.component';

describe('Compact entry tools', () => {
  it('indicates existing repeatable entries while keeping Add active, and locks unique entries', () => {
    const fixture = TestBed.createComponent(CatalogResultRowComponent);
    fixture.componentRef.setInput('name', 'Wolf'); fixture.componentRef.setInput('alreadyAdded', true);
    fixture.detectChanges();
    const button = fixture.nativeElement.querySelector('button') as HTMLButtonElement;
    const added = vi.fn(); fixture.componentInstance.addRequested.subscribe(added);
    expect(button.disabled).toBe(false);
    expect(button.classList.contains('already-added')).toBe(true);
    expect(button.getAttribute('aria-label')).toBe('Add another Wolf to list');
    button.click(); expect(added).toHaveBeenCalledOnce();
    fixture.componentRef.setInput('selected', true); fixture.detectChanges();
    expect(button.disabled).toBe(true); button.click(); expect(added).toHaveBeenCalledOnce();
  });
  it('opens one annotation panel at a time, retains drafts and preserves the existing used count', () => {
    const fixture = TestBed.createComponent(EntryAnnotationsComponent);
    const render = () => { fixture.changeDetectorRef.markForCheck(); fixture.detectChanges(); };
    const entry: AnnotatedEntry = { notes: [{ tag: 'Reminder', notes: ['Original'] }], uses: [{ tag: 'Charges', totalFreeUses: 5, usedFreeUses: 3, freeUsesRegainCondition: 'LONG_REST' }] };
    fixture.componentRef.setInput('entry', entry); render();
    const tools = fixture.componentInstance;
    const panel = (label: string) => fixture.nativeElement.querySelector(`[aria-label="${label} editor"]`) as HTMLElement;
    expect(panel('Uses').hidden).toBe(true); expect(panel('Notes').hidden).toBe(true);
    fixture.nativeElement.querySelector('[aria-controls^="uses-panel-"]').click(); render();
    expect(panel('Uses').hidden).toBe(false); expect(panel('Notes').hidden).toBe(true);
    fixture.nativeElement.querySelector('[aria-label="Add use tracker"]').click(); render();
    expect(entry.uses).toHaveLength(2); expect(entry.uses![0].usedFreeUses).toBe(3);
    const total = panel('Uses').querySelector<HTMLInputElement>('input[type="number"]')!;
    total.value = '1'; total.dispatchEvent(new Event('input')); render();
    expect(entry.uses![0].totalFreeUses).toBe(1); expect(entry.uses![0].usedFreeUses).toBe(3);
    fixture.nativeElement.querySelector('[aria-controls^="notes-panel-"]').click(); render();
    expect(panel('Uses').hidden).toBe(true); expect(panel('Notes').hidden).toBe(false);
    tools.editNoteEntry(entry.notes![0], 0); tools.noteDraft = 'Keep this draft'; render();
    tools.togglePanel('uses'); render(); tools.togglePanel('notes'); render();
    expect(tools.noteDraft || entry.notes![0].notes[0]).toBe('Keep this draft');
    tools.noteKeydown(new KeyboardEvent('keydown', { key: 'Enter' })); render();
    expect(entry.notes![0].notes).toEqual(['Keep this draft']);
    expect(entry.uses![0].usedFreeUses).toBe(3);
  });

  it('shows Uses, Notes and Combat beside the name and scopes spell combat status to the casting source', () => {
    const sheet = emptyBasicCharacter();
    const known = { editorId: 'known', name: 'Shared', source: 'TEST', castingSourceName: 'Wizard', listType: 'KNOWN' };
    const prepared = { ...known, editorId: 'prepared', listType: 'PREPARED' }, bard = { ...known, editorId: 'bard', castingSourceName: 'Bard' };
    sheet.spells = [known, prepared, bard];
    const helper = TestBed.inject(CharacterHelpersService);
    sheet.combatActions = [known, prepared, bard].map(spell => prefillCombatAction(sheet, spell, 'SPELL', helper));
    const fixture = TestBed.createComponent(EditorEntryRowComponent);
    fixture.componentRef.setInput('name', known.name); fixture.componentRef.setInput('sheet', sheet); fixture.componentRef.setInput('resource', known);
    fixture.componentRef.setInput('usesCount', 3); fixture.componentRef.setInput('notesCount', 2); fixture.detectChanges();
    const indicators = [...fixture.nativeElement.querySelectorAll('[role="img"]')] as HTMLElement[];
    expect(indicators.map(element => element.getAttribute('aria-label'))).toEqual(['3 use trackers', '2 note groups', '2 Combat entries']);
    expect(indicators[0].parentElement!.parentElement!.querySelector('p')?.textContent).toContain('Shared');
    expect(indicators[0].querySelector('app-ui-icon')?.getAttribute('name')).toBe('tally');
    sheet.combatActions.splice(0, 2); fixture.changeDetectorRef.markForCheck(); fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[aria-label$="Combat entries"]')).toBeNull();
  });
});
