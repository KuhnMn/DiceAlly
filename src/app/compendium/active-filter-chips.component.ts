import { Component, input, output } from '@angular/core';
import { UiIconComponent } from '../ui-icon.component';

export interface ActiveFilterGroup { key: string; label: string; values: string[]; }

export function filterGroupSummary(values: readonly string[]): string {
  const text = values.join(', ');
  return values.length <= 3 && text.length <= 64 ? text : `${values.length} selected`;
}

@Component({
  selector: 'app-active-filter-chips',
  imports: [UiIconComponent],
  host: { class: 'contents' },
  styleUrl: './compendium.component.css',
  template: `
    @for (group of groups(); track group.key) {
      @if (group.values.length) {
        <button type="button" class="filter-chip min-w-0 max-w-full" [attr.aria-label]="'Remove ' + group.label + ' filter'"
          [title]="group.label + ': ' + group.values.join(', ')" (click)="removed.emit(group.key)">
          <span class="min-w-0 truncate">{{ group.label }}: {{ summary(group.values) }}</span><app-ui-icon name="close" class="shrink-0" />
        </button>
      }
    }
  `,
})
export class ActiveFilterChipsComponent {
  readonly groups = input.required<ActiveFilterGroup[]>();
  readonly removed = output<string>();
  readonly summary = filterGroupSummary;
}
