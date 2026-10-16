import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { DescriptionDialogComponent } from './description-dialog.component';

@Component({
  imports: [DescriptionDialogComponent],
  template: `<section (keydown.escape)="catalogClosed = true"><app-description-dialog title="Spell Description"><p>Full formatted reference</p></app-description-dialog></section>`,
})
class DescriptionHost { catalogClosed = false; }

describe('Editor description overlays', () => {
  it('opens reference content in a modal and closes it without dismissing the parent catalog', () => {
    const fixture = TestBed.createComponent(DescriptionHost); fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('dialog')).toBeNull();
    fixture.nativeElement.querySelector('button[aria-haspopup="dialog"]').click(); fixture.detectChanges();
    const dialog = fixture.nativeElement.querySelector('dialog') as HTMLDialogElement;
    expect(dialog.textContent).toContain('Full formatted reference');
    expect(dialog.querySelector('h2')?.textContent).toBe('Spell Description');
    dialog.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(fixture.componentInstance.catalogClosed).toBe(false);
    dialog.dispatchEvent(new Event('close')); fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('dialog')).toBeNull();
    expect(fixture.componentInstance.catalogClosed).toBe(false);
  });
});
