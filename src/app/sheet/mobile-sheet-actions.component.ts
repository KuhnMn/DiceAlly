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
      <details #restMenu name="sheet-actions" class="relative">
        <summary class="flex min-h-11 cursor-pointer list-none items-center gap-1 rounded-lg bg-surface-container px-3 py-2 text-sm font-semibold"><app-ui-icon name="rest" /> Rest</summary>
        <div class="absolute left-0 top-full z-50 mt-1 w-44 rounded-lg border border-outline-variant bg-surface-container-high p-1 shadow-lg">
          <button type="button" [disabled]="saving()" (click)="restMenu.open = false; shortRest.emit()" class="min-h-11 w-full rounded px-3 py-2 text-left text-sm hover:bg-surface-container"><app-ui-icon name="campfire" /> Short Rest</button>
          <button type="button" [disabled]="saving()" (click)="restMenu.open = false; longRest.emit()" class="min-h-11 w-full rounded px-3 py-2 text-left text-sm hover:bg-surface-container"><app-ui-icon name="rest" /> Long Rest</button>
        </div>
      </details>
      <details #moreMenu name="sheet-actions" class="relative ml-auto">
        <summary class="flex min-h-11 cursor-pointer list-none items-center rounded-lg bg-surface-container px-3 py-2 text-sm font-semibold">More</summary>
        <div class="absolute right-0 top-full z-50 mt-1 w-56 rounded-lg border border-outline-variant bg-surface-container-high p-2 shadow-lg">
          <button type="button" [disabled]="saving()" (click)="moreMenu.open = false; edit.emit()" class="mb-2 min-h-11 w-full rounded bg-primary-container px-3 py-2 text-left text-sm text-on-primary-container"><app-ui-icon name="edit" /> Edit character</button>
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
  readonly dirty = input(false);
  readonly save = output<void>();
  readonly edit = output<void>();
  readonly shortRest = output<void>();
  readonly longRest = output<void>();
}
