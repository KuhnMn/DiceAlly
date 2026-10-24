import { Component, ElementRef, inject, input, output } from '@angular/core';
import { ThemePickerComponent } from '../theme-picker.component';
import { UiIconComponent } from '../ui-icon.component';

@Component({
  selector: 'app-mobile-sheet-actions',
  imports: [ThemePickerComponent, UiIconComponent],
  host: { class: 'block sm:hidden', '[class.expanded]': 'expanded()', '(document:keydown.escape)': 'closeMenus()', '(document:pointerdown)': 'dismissOutside($event)' },
  styles: [':host(.expanded) { display: block; }'],
  template: `
    <div class="flex items-center gap-1">
      @if (!themeOnly()) {
      <button type="button" (click)="save.emit()" [disabled]="saving()" [attr.aria-label]="saving() ? 'Saving changes' : dirty() ? 'Save changes' : 'Saved'" [title]="saving() ? 'Saving changes' : dirty() ? 'Save changes' : 'Saved'" class="flex h-10 min-w-8 flex-1 items-center justify-center rounded-lg bg-secondary-container text-sm text-on-secondary-container disabled:opacity-50"><span aria-hidden="true" [class.animate-spin]="saving()"><app-ui-icon [name]="saving() ? 'loader' : 'save'" /></span></button>
      <button type="button" (click)="edit.emit()" [disabled]="saving() || openingEditor()" [attr.aria-busy]="openingEditor()" [attr.aria-label]="openingEditor() ? 'Opening character editor' : 'Edit character'" [title]="openingEditor() ? 'Opening character editor…' : 'Edit Character'" class="flex h-10 min-w-8 flex-1 items-center justify-center rounded-lg bg-surface-container text-sm disabled:opacity-50"><span aria-hidden="true" class="inline-block" [class.animate-spin]="openingEditor()"><app-ui-icon [name]="openingEditor() ? 'loader' : 'edit'" /></span></button>
      }
      @if (!actionsOnly()) {
      <details #moreMenu name="sheet-actions" class="relative">
        <summary class="flex min-h-9 cursor-pointer list-none items-center rounded-lg bg-surface-container px-2.5 py-1.5 text-xs font-semibold">Theme</summary>
        <div class="absolute right-0 top-full z-50 mt-1 w-56 rounded-lg border border-outline-variant bg-surface-container-high p-2 shadow-lg">
          <span class="mb-1 block text-xs font-semibold text-on-surface-variant">Theme</span>
          <app-theme-picker />
        </div>
      </details>
      }
    </div>
  `,
})
export class MobileSheetActionsComponent {
  private readonly element = inject<ElementRef<HTMLElement>>(ElementRef);
  closeMenus() { this.element.nativeElement.querySelectorAll('details[open]').forEach(menu => menu.removeAttribute('open')); }
  dismissOutside(event: Event) { if (event.target instanceof Node && !this.element.nativeElement.contains(event.target)) this.closeMenus(); }
  readonly expanded = input(false);
  readonly themeOnly = input(false);
  readonly actionsOnly = input(false);
  readonly saving = input(false);
  readonly openingEditor = input(false);
  readonly dirty = input(false);
  readonly save = output<void>();
  readonly edit = output<void>();
}
