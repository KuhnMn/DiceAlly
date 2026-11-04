import 'fake-indexeddb/auto';
import { TestBed } from '@angular/core/testing';
import { Component } from '@angular/core';
import { EntryAnnotationsComponent } from './entry-annotations.component';
import { EditorEntryRowComponent } from './editor-entry-row.component';
import { AnnotatedEntry } from './entry-annotations-editor';
import { emptyBasicCharacter } from './basic-info';
import { prefillCombatAction } from './combat-actions';
import { CharacterHelpersService } from '../sheet/character-helpers.service';
import { CatalogResultRowComponent } from './catalog-result-row.component';

@Component({
  imports: [EntryAnnotationsComponent],
  template: `<app-entry-annotations-editor [entry]="entry" [annotationsEnabled]="false" (edited)="edits = edits + 1">
    <button annotation-description type="button">Description</button>
    <button annotation-combat type="button">Combat</button>
  </app-entry-annotations-editor>`,
})
class VisibilityToolsHost {
  entry: AnnotatedEntry = { uses: [{ total: { kind: 'fixed', value: 5 }, used: 2 }], notes: [{ tag: 'Keep', notes: ['Reminder'] }] };
  edits = 0;
}

describe('Compact entry tools', () => {
  it('edits explicit uses calculations and retains the fixed total and spent count', async () => {
    const fixture = TestBed.createComponent(EntryAnnotationsComponent);
    const entry: AnnotatedEntry = { uses: [{ total: { kind: 'fixed', value: 7 }, used: 3 }] };
    fixture.componentRef.setInput('entry', entry); await fixture.whenStable();
    const panel = fixture.nativeElement.querySelector('[aria-label="Uses editor"]') as HTMLElement;
    const select = panel.querySelector('select') as HTMLSelectElement;
    for (const [value, calculation] of [['proficiency-bonus', { kind: 'proficiency-bonus', multiplier: 1 }],
      ['ability-modifier', { kind: 'ability-modifier', ability: 'strength' }], ['fixed', { kind: 'fixed', value: 7 }]] as const) {
      select.value = value; select.dispatchEvent(new Event('change')); await fixture.whenStable();
      expect(entry.uses![0]).toEqual({ total: calculation, used: 3 });
      expect(!!panel.querySelector('input[type="number"]')).toBe(value === 'fixed');
      if (value === 'proficiency-bonus') {
        const multiplier = panel.querySelectorAll('select')[1];
        multiplier.value = [...multiplier.options].find(option => option.textContent === '×0.5')!.value;
        multiplier.dispatchEvent(new Event('change')); await fixture.whenStable();
        expect(entry.uses![0].total).toEqual({ kind: value, multiplier: 0.5 });
      }
      if (value === 'ability-modifier') {
        const stat = panel.querySelectorAll('select')[1];
        stat.value = 'wisdom'; stat.dispatchEvent(new Event('change')); await fixture.whenStable();
        expect(entry.uses![0].total).toEqual({ kind: value, ability: 'wisdom' });
      }
    }
    fixture.destroy();
  });
  it('puts Description first and toggles viewer visibility without changing annotations or preparation', () => {
    const fixture = TestBed.createComponent(VisibilityToolsHost); fixture.detectChanges();
    const host = fixture.componentInstance, before = structuredClone(host.entry);
    const tools = fixture.nativeElement.querySelector('[aria-label="Entry tools"]') as HTMLElement;
    expect(tools.querySelector('button')!.textContent).toBe('Description');
    const hide = tools.querySelector<HTMLButtonElement>('[aria-label="Hide in viewer"]')!;
    expect(hide.disabled).toBe(false); hide.click(); fixture.detectChanges();
    expect(host.entry).toEqual({ ...before, hidden: true });
    expect(tools.querySelector('[aria-label="Show in viewer"]')?.getAttribute('aria-pressed')).toBe('true');
    tools.querySelector<HTMLButtonElement>('[aria-label="Show in viewer"]')!.click(); fixture.detectChanges();
    expect(host.entry).toEqual(before); expect(host.edits).toBe(2);
  });
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
    const entry: AnnotatedEntry = { notes: [{ tag: 'Reminder', notes: ['Original'] }], uses: [{ tag: 'Charges', total: { kind: 'fixed', value: 5 }, used: 3, freeUsesRegainCondition: 'LONG_REST' }] };
    fixture.componentRef.setInput('entry', entry); render();
    const tools = fixture.componentInstance;
    const panel = (label: string) => fixture.nativeElement.querySelector(`[aria-label="${label} editor"]`) as HTMLElement;
    expect(panel('Uses').hidden).toBe(true); expect(panel('Notes').hidden).toBe(true);
    fixture.nativeElement.querySelector('[aria-controls^="uses-panel-"]').click(); render();
    expect(panel('Uses').hidden).toBe(false); expect(panel('Notes').hidden).toBe(true);
    fixture.nativeElement.querySelector('[aria-label="Add use tracker"]').click(); render();
    expect(entry.uses).toHaveLength(2); expect(entry.uses![0].used).toBe(3);
    const total = panel('Uses').querySelector<HTMLInputElement>('input[type="number"]')!;
    total.value = '1'; total.dispatchEvent(new Event('input')); render();
    expect(entry.uses![0].total).toEqual({ kind: 'fixed', value: 1 }); expect(entry.uses![0].used).toBe(3);
    fixture.nativeElement.querySelector('[aria-controls^="notes-panel-"]').click(); render();
    expect(panel('Uses').hidden).toBe(true); expect(panel('Notes').hidden).toBe(false);
    tools.editNoteEntry(entry.notes![0], 0); tools.noteDraft = 'Keep this draft'; render();
    tools.togglePanel('uses'); render(); tools.togglePanel('notes'); render();
    expect(tools.noteDraft || entry.notes![0].notes[0]).toBe('Keep this draft');
    tools.noteKeydown(new KeyboardEvent('keydown', { key: 'Enter' })); render();
    expect(entry.notes![0].notes).toEqual(['Keep this draft']);
    expect(entry.uses![0].used).toBe(3);
  });

  it('allows resource linking before preparation while leaving Uses and Notes gated', () => {
    const fixture=TestBed.createComponent(EntryAnnotationsComponent);
    fixture.componentRef.setInput('entry',{});fixture.componentRef.setInput('annotationsEnabled',false);fixture.componentRef.setInput('showResources',true);fixture.detectChanges();
    const buttons=[...fixture.nativeElement.querySelectorAll('[aria-label="Entry tools"] button')] as HTMLButtonElement[];
    const resource=buttons.find(button=>button.textContent!.includes('Resources'))!;
    expect(resource.disabled).toBe(false);expect(buttons.find(button=>button.textContent!.includes('Notes'))!.disabled).toBe(true);
    resource.click();fixture.detectChanges();expect(fixture.nativeElement.querySelector('[aria-label="Resource links editor"]').hidden).toBe(false);fixture.destroy();
  });

  it('shows Uses, Notes, linked Resources and Combat beside the name and scopes spell combat status to the casting source', () => {
    const sheet = emptyBasicCharacter();
    const known = { editorId: 'known', name: 'Shared', source: 'TEST', castingSourceName: 'Wizard', listType: 'KNOWN' };
    const prepared = { ...known, editorId: 'prepared', listType: 'PREPARED' }, bard = { ...known, editorId: 'bard', castingSourceName: 'Bard' };
    sheet.spells = [known, prepared, bard];
    const helper = TestBed.inject(CharacterHelpersService);
    sheet.combatActions = [known, prepared, bard].map(spell => prefillCombatAction(sheet, spell, 'SPELL', helper));
    const fixture = TestBed.createComponent(EditorEntryRowComponent);
    fixture.componentRef.setInput('name', known.name); fixture.componentRef.setInput('sheet', sheet); fixture.componentRef.setInput('resource', known);
    fixture.componentRef.setInput('usesCount', 3); fixture.componentRef.setInput('notesCount', 2); fixture.componentRef.setInput('resourceLinksCount', 1); fixture.detectChanges();
    const indicators = [...fixture.nativeElement.querySelectorAll('[role="img"]')] as HTMLElement[];
    expect(indicators.map(element => element.getAttribute('aria-label'))).toEqual(['3 use trackers', '2 note groups', 'Linked resources: 1', '2 Combat entries']);
    expect(indicators[0].parentElement!.parentElement!.querySelector('p')?.textContent).toContain('Shared');
    expect(indicators[0].querySelector('app-ui-icon')?.getAttribute('name')).toBe('tally');
    fixture.componentRef.setInput('resourceLinksCount', 0);
    sheet.combatActions.splice(0, 2); fixture.changeDetectorRef.markForCheck(); fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[aria-label$="Combat entries"]')).toBeNull();
    expect(fixture.nativeElement.querySelector('[aria-label^="Linked resources:"]')).toBeNull();
  });
});
