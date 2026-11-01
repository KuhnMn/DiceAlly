import { Component, input, output } from '@angular/core';
import { UiIconComponent } from '../ui-icon.component';

export interface ResourceSelectOption { value: string; label: string; balance?: string; }

/** Native selection with a flexible name and a balance that never gets truncated. */
@Component({
  selector: 'app-resource-select',
  imports: [UiIconComponent],
  host: { class: 'block min-w-0' },
  template: `
    <p class="text-xs font-semibold text-on-surface-variant">{{ label() }}</p>
    <div class="relative mt-1 rounded-lg focus-within:outline-2 focus-within:outline-primary" [class.opacity-60]="disabled()">
      <output aria-live="polite" [attr.aria-label]="selected() ? fullLabel(selected()!) : placeholder()"
        class="flex min-h-11 items-center gap-2 rounded-lg border border-outline-variant bg-surface-container px-2 py-2 text-base text-on-surface sm:text-sm">
        <span class="min-w-0 flex-1 truncate" [title]="selected()?.label ?? placeholder()">{{ selected()?.label ?? placeholder() }}</span>
        @if (selected()?.balance; as balance) { <span class="shrink-0 tabular-nums">{{ balance }}</span> }
        @if (selectable()) { <app-ui-icon name="chevron-down" /> }
      </output>
      @if (selectable()) {
        <select [attr.aria-label]="ariaLabel()" [title]="selected() ? fullLabel(selected()!) : placeholder()" [value]="value()"
          [disabled]="disabled()" (change)="changed.emit($any($event.target).value)"
          class="absolute inset-0 h-full w-full min-w-0 cursor-pointer bg-surface-container text-base text-on-surface opacity-0 sm:text-sm">
          @if (!selected()) { <option value="">{{ placeholder() }}</option> }
          @for (option of options(); track option.value) {
            <option [value]="option.value" [attr.aria-label]="fullLabel(option)" [title]="option.label">{{ optionLabel(option) }}</option>
          }
        </select>
      }
    </div>`,
})
export class ResourceSelectComponent {
  readonly label = input.required<string>();
  readonly ariaLabel = input.required<string>();
  readonly value = input('');
  readonly options = input<ResourceSelectOption[]>([]);
  readonly disabled = input(false);
  readonly selectable = input(true);
  readonly placeholder = input('Choose a Resource');
  readonly changed = output<string>();
  selected() { return this.options().find(option => option.value === this.value()); }
  fullLabel(option: ResourceSelectOption) { return option.balance ? `${option.label} · ${option.balance} available` : option.label; }
  optionLabel(option: ResourceSelectOption) {
    const characters = Array.from(option.label);
    const name = characters.length > 24 ? characters.slice(0, 23).join('') + '…' : option.label;
    return option.balance ? `${name} · ${option.balance}` : name;
  }
}
