import { UiIconComponent } from '../ui-icon.component';
import { Component, ElementRef, HostListener, ViewChild, inject, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';

export interface SelectOption { value: string; label: string; disabled?: boolean; }

/** A single selection with its search inside the dropdown window. */
@Component({
  selector: 'app-searchable-select',
  imports: [UiIconComponent, FormsModule],
  styleUrl: './editor.css',
  template: `
    <div class="relative" (keydown)="keydown($event)">
      <button #trigger type="button" class="editor-input flex items-center justify-between gap-2 text-left" [class.compact-select]="compact()"
        aria-haspopup="dialog" [attr.aria-expanded]="open" [attr.aria-controls]="popupId" [attr.aria-label]="label()"
        [disabled]="disabled()" (click)="toggle()">
        <span class="min-w-0 truncate">{{ selectedLabel }}</span><span class="shrink-0 text-xs" aria-hidden="true"><app-ui-icon name="chevron-down" /></span>
      </button>
      @if (open) {
        <div [id]="popupId" role="dialog" [attr.aria-label]="label() + ' options'"
          class="absolute z-30 left-0 right-0 top-full mt-1 rounded-lg border-2 border-outline-variant bg-surface p-2 shadow-xl">
          <input #searchInput type="search" class="editor-input mb-2" [(ngModel)]="search" [ngModelOptions]="{standalone: true}"
            [attr.aria-label]="'Search ' + label()" placeholder="Search…" />
          <div role="listbox" [attr.aria-label]="label()" class="max-h-52 overflow-y-auto space-y-0.5">
            @for (option of filtered; track option.value) {
              <button type="button" role="option" [attr.data-value]="option.value" [attr.aria-selected]="value() === option.value"
                [disabled]="option.disabled" [class.bg-secondary-container]="value() === option.value"
                class="block w-full rounded px-2 py-1.5 text-left text-sm whitespace-normal break-words hover:bg-secondary-container focus:bg-secondary-container"
                (click)="choose(option.value)">{{ option.label }}</button>
            } @empty { <p class="p-2 text-xs text-on-surface-variant">No matching options.</p> }
          </div>
        </div>
      }
    </div>
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
  private readonly element = inject<ElementRef<HTMLElement>>(ElementRef);
  @ViewChild('trigger') private trigger?: ElementRef<HTMLButtonElement>;
  @ViewChild('searchInput') set searchInput(field: ElementRef<HTMLInputElement> | undefined) { field?.nativeElement.focus(); }
  open = false;
  search = '';
  get selectedLabel() { return this.options().find(option => option.value === this.value())?.label ?? this.placeholder(); }
  get filtered() {
    const query = this.search.trim().toLowerCase();
    return this.options().filter(option => option.label.toLowerCase().includes(query));
  }
  toggle() { this.open = !this.open; if (this.open) this.search = ''; }
  choose(value: string) { this.selected.emit(value); this.close(); }
  close() { this.open = false; this.trigger?.nativeElement.focus(); }
  @HostListener('document:click', ['$event']) outside(event: MouseEvent) {
    if (this.open && !this.element.nativeElement.contains(event.target as Node)) this.open = false;
  }
  keydown(event: KeyboardEvent) {
    if (event.key === 'Escape' && this.open) { event.preventDefault(); event.stopPropagation(); this.close(); return; }
    if (!this.open && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) { event.preventDefault(); this.toggle(); return; }
    if (!this.open) return;
    const buttons = Array.from(this.element.nativeElement.querySelectorAll<HTMLButtonElement>('[role="option"]:not(:disabled)'));
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
