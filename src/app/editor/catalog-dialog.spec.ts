import 'fake-indexeddb/auto';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { vi } from 'vitest';
import { CatalogDialogComponent } from './catalog-dialog.component';
import { FeaturesEditorComponent } from './features-editor.component';
import { SpellsEditorComponent } from './spells-editor.component';
import { emptyBasicCharacter } from './basic-info';

describe('Creator catalog dialogs', () => {
  beforeEach(() => TestBed.configureTestingModule({ providers: [provideRouter([])] }));

  it('opens the feature catalog separately, retains edits and filters, and closes on Escape', async () => {
    const fixture = TestBed.createComponent(FeaturesEditorComponent);
    const sheet = emptyBasicCharacter();
    sheet.character!.featureSources = [{ name: 'Fighter', isGeneralFeatureSource: true }];
    fixture.componentRef.setInput('sheet', sheet); await fixture.whenStable();
    const editor = fixture.componentInstance;
    editor.sourceFilter = 'Fighter'; editor.search = 'training';
    expect(fixture.nativeElement.querySelector('[role="dialog"]')).toBeNull();
    expect(fixture.nativeElement.querySelector('input[name="feature-search"]')).toBeNull();
    const trigger = fixture.nativeElement.querySelector('button[aria-haspopup="dialog"]') as HTMLButtonElement;
    trigger.focus(); trigger.click(); await fixture.whenStable();
    const dialog = fixture.nativeElement.querySelector('[role="dialog"]') as HTMLElement;
    expect(dialog.getAttribute('aria-label')).toBe('Add Features');
    expect(document.body.style.overflow).toBe('hidden');
    expect(editor.targetSource).toBe('Fighter');
    expect(dialog.querySelector('input[name="feature-search"]')).not.toBeNull();
    editor.customName = 'Training'; editor.addCustom(); fixture.detectChanges();
    expect(sheet.features![0].featureSourceName).toBe('Fighter');
    expect(dialog.textContent).toContain('1 added this visit');
    dialog.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('[role="dialog"]')).toBeNull();
    expect(document.body.style.overflow).not.toBe('hidden');
    expect(sheet.features).toHaveLength(1); expect(editor.search).toBe('training');
    expect(fixture.nativeElement.textContent).toContain('Training');
  });

  it('keeps spell multi-selection when returning to the character and reopening the catalog', async () => {
    const fixture = TestBed.createComponent(SpellsEditorComponent);
    fixture.componentRef.setInput('sheet', emptyBasicCharacter()); await fixture.whenStable();
    const editor = fixture.componentInstance;
    editor.filter = { search: 'shield', classes: ['Wizard', 'Artificer'], levels: [0, 1, 9] };
    const trigger = fixture.nativeElement.querySelector('button[aria-haspopup="dialog"]') as HTMLButtonElement;
    trigger.click(); await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('[role="dialog"]')?.getAttribute('aria-label')).toBe('Add Spells');
    const done = Array.from(fixture.nativeElement.querySelectorAll('[role="dialog"] button'))
      .find(button => (button as HTMLElement).textContent?.trim() === 'Done') as HTMLButtonElement;
    done.click(); await fixture.whenStable(); trigger.click(); await fixture.whenStable();
    expect(editor.filter).toEqual({ search: 'shield', classes: ['Wizard', 'Artificer'], levels: [0, 1, 9] });
  });

  it('prevents implicit form submission and guards closing during a bulk addition', async () => {
    const fixture = TestBed.createComponent(CatalogDialogComponent);
    fixture.componentRef.setInput('title', 'Add Spells'); await fixture.whenStable();
    const dialog = fixture.componentInstance; const closed = vi.fn(); dialog.closed.subscribe(closed);
    const input = document.createElement('input'); fixture.nativeElement.querySelector('.catalog-body').append(input);
    const enter = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }); input.dispatchEvent(enter);
    expect(enter.defaultPrevented).toBe(true);
    fixture.componentRef.setInput('closeDisabled', true); fixture.detectChanges();
    dialog.keydown(new KeyboardEvent('keydown', { key: 'Escape' })); expect(closed).not.toHaveBeenCalled();
    fixture.componentRef.setInput('closeDisabled', false); fixture.detectChanges(); dialog.close();
    expect(closed).toHaveBeenCalledOnce(); fixture.destroy();
    expect(document.body.style.overflow).not.toBe('hidden');
  });
});
