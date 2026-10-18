import { Component, ElementRef, inject, input, output } from '@angular/core';
import { ThemePickerComponent } from '../theme-picker.component';
import { UiIconComponent } from '../ui-icon.component';

@Component({
  selector: 'app-mobile-sheet-actions',
  imports: [ThemePickerComponent, UiIconComponent],
  host: { class: 'block sm:hidden', '(document:keydown.escape)': 'closeMenus()', '(document:pointerdown)': 'dismissOutside($event)' },
  template: `
    <div class="mb-3 flex items-center gap-2">
      <button type="button" (click)="save.emit()" [disabled]="saving()" class="min-h-11 rounded-lg bg-secondary-container px-3 py-2 text-sm font-semibold text-on-secondary-container disabled:opacity-50"><app-ui-icon name="save" /> {{ saving() ? 'Saving…' : dirty() ? 'Save changes' : 'Saved' }}</button>
      <button type="button" (click)="edit.emit()" [disabled]="saving() || openingEditor()" [attr.aria-busy]="openingEditor()" [attr.aria-label]="openingEditor() ? 'Opening character editor' : 'Edit character'" [title]="openingEditor() ? 'Opening character editor…' : 'Edit Character'" class="ml-auto flex min-h-11 min-w-11 items-center justify-center rounded-lg bg-surface-container text-lg disabled:opacity-50"><span aria-hidden="true" class="inline-block" [class.animate-spin]="openingEditor()"><app-ui-icon [name]="openingEditor() ? 'loader' : 'edit'" /></span></button>
      <details #moreMenu name="sheet-actions" class="relative">
        <summary class="flex min-h-11 cursor-pointer list-none items-center rounded-lg bg-surface-container px-3 py-2 text-sm font-semibold">Theme</summary>
        <div class="absolute right-0 top-full z-50 mt-1 w-56 rounded-lg border border-outline-variant bg-surface-container-high p-2 shadow-lg">
          <span class="mb-1 block text-xs font-semibold text-on-surface-variant">Theme</span>
          <app-theme-picker />
        </div>
      </details>
    </div>
  `,
})
export class MobileSheetActionsComponent {
  private readonly element = inject<ElementRef<HTMLElement>>(ElementRef);
  closeMenus() { this.element.nativeElement.querySelectorAll('details[open]').forEach(menu => menu.removeAttribute('open')); }
  dismissOutside(event: Event) { if (event.target instanceof Node && !this.element.nativeElement.contains(event.target)) this.closeMenus(); }
  readonly saving = input(false);
  readonly openingEditor = input(false);
  readonly dirty = input(false);
  readonly save = output<void>();
  readonly edit = output<void>();
}
