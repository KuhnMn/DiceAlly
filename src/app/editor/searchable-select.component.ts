import { rankSearchResults } from '../search-ranking';
import { UiIconComponent } from '../ui-icon.component';
import { Component, ElementRef, ViewChild, input, output } from '@angular/core';
import { ConnectedPosition, OverlayModule } from '@angular/cdk/overlay';
import { CdkTrapFocus } from '@angular/cdk/a11y';
import { FormsModule } from '@angular/forms';

export interface SelectOption { value: string; label: string; disabled?: boolean; }

/** A single selection with its search inside the dropdown window. */
@Component({
  selector: 'app-searchable-select',
  imports: [UiIconComponent, FormsModule, OverlayModule, CdkTrapFocus],
  styleUrl: './editor.css',
  template: `
    <div cdkOverlayOrigin #origin="cdkOverlayOrigin" (keydown)="keydown($event)">
      <button #trigger type="button" class="editor-input flex items-center justify-between gap-2 text-left" [class.compact-select]="compact()"
        aria-haspopup="dialog" [attr.aria-expanded]="open" [attr.aria-controls]="popupId" [attr.aria-label]="label()"
        [disabled]="disabled()" (click)="toggle()">
        <span class="min-w-0 truncate">{{ selectedLabel }}</span><span class="shrink-0 text-xs" aria-hidden="true"><app-ui-icon name="chevron-down" /></span>
      </button>
    </div>
    <ng-template cdkConnectedOverlay [cdkConnectedOverlayOrigin]="origin" [cdkConnectedOverlayOpen]="open"
      [cdkConnectedOverlayPositions]="positions" [cdkConnectedOverlayWidth]="popupWidth"
      [cdkConnectedOverlayPush]="true" [cdkConnectedOverlayViewportMargin]="12"
      (overlayOutsideClick)="open = false" (detach)="open = false">
        <div #popup [id]="popupId" role="dialog" cdkTrapFocus [attr.aria-label]="label() + ' options'" (keydown)="keydown($event)"
          class="flex max-h-[calc(100dvh-1.5rem)] w-full flex-col rounded-lg border-2 border-outline-variant bg-surface p-2 text-on-surface shadow-xl">
          <input #searchInput type="search" class="editor-input mb-2 shrink-0" [(ngModel)]="search" [ngModelOptions]="{standalone: true}"
            [attr.aria-label]="'Search ' + label()" placeholder="Search…" />
          <div role="listbox" [attr.aria-label]="label()" class="min-h-0 max-h-72 overflow-y-auto overscroll-contain space-y-0.5">
            @for (option of filtered; track option.value) {
              <button type="button" role="option" [attr.data-value]="option.value" [attr.aria-selected]="value() === option.value"
                [disabled]="option.disabled" [class.bg-secondary-container]="value() === option.value"
                class="block w-full rounded px-2 py-1.5 text-left text-sm whitespace-normal break-words hover:bg-secondary-container focus:bg-secondary-container"
                (click)="choose(option.value)">{{ option.label }}</button>
            } @empty { <p class="p-2 text-xs text-on-surface-variant">No matching options.</p> }
          </div>
        </div>
    </ng-template>
  `,
})
export class SearchableSelectComponent {
  readonly options = input.required<SelectOption[]>();
  readonly value = input('');
  readonly label = input('Selection');
  readonly placeholder = input('Select an option');
  readonly disabled = input(false);
  readonly compact = input(false);
  readonly selected = output<string>();
  readonly popupId = `select-${crypto.randomUUID()}`;
  readonly positions: ConnectedPosition[] = [
    { originX: 'start', originY: 'bottom', overlayX: 'start', overlayY: 'top', offsetY: 4 },
    { originX: 'start', originY: 'top', overlayX: 'start', overlayY: 'bottom', offsetY: -4 },
  ];
  popupWidth = 280;
  @ViewChild('popup') private popup?: ElementRef<HTMLElement>;
  @ViewChild('trigger') private trigger?: ElementRef<HTMLButtonElement>;
  @ViewChild('searchInput') set searchInput(field: ElementRef<HTMLInputElement> | undefined) { field?.nativeElement.focus(); }
  open = false;
  search = '';
  get selectedLabel() { return this.options().find(option => option.value === this.value())?.label ?? this.placeholder(); }
  get filtered() {
    const query = this.search.trim().toLowerCase();
    return rankSearchResults(this.options().filter(option => option.label.toLowerCase().includes(query)), query, option => option.label);
  }
  toggle() {
    this.open = !this.open;
    if (this.open) {
      this.search = '';
      this.popupWidth = Math.min(Math.max(this.trigger?.nativeElement.getBoundingClientRect().width ?? 0, 280), window.innerWidth - 24);
    }
  }
  choose(value: string) { this.selected.emit(value); this.close(); }
  close() { this.open = false; this.trigger?.nativeElement.focus(); }
  keydown(event: KeyboardEvent) {
    if (event.key === 'Escape' && this.open) { event.preventDefault(); event.stopPropagation(); this.close(); return; }
    if (!this.open && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) { event.preventDefault(); this.toggle(); return; }
    if (!this.open) return;
    const buttons = Array.from(this.popup?.nativeElement.querySelectorAll<HTMLButtonElement>('[role="option"]:not(:disabled)') ?? []);
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const index = buttons.indexOf(event.target as HTMLButtonElement);
      const next = event.key === 'ArrowDown' ? Math.min(index + 1, buttons.length - 1) : Math.max(index - 1, 0);
      buttons[next]?.focus();
    } else if (event.key === 'Enter' && (event.target as HTMLElement).tagName === 'INPUT') {
      event.preventDefault(); buttons[0]?.click();
    }
  }
}
