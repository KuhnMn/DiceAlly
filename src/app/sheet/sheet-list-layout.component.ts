import { Component, signal } from '@angular/core';
import { UiIconComponent } from '../ui-icon.component';

@Component({
  selector: 'app-sheet-list-layout',
  imports: [UiIconComponent],
  host: { class: 'hidden shrink-0 sm:block' },
  template: `
    <div class="flex gap-1 rounded-lg border border-outline-variant p-1" role="group" aria-label="List layout">
      @for (count of [1, 2, 3]; track count) {
        <button type="button" (click)="columns.set(count)" [attr.aria-pressed]="columns() === count"
          [attr.aria-label]="count === 1 ? 'One column' : count === 2 ? 'Two columns' : 'Three columns'" [title]="count === 1 ? 'One column' : count === 2 ? 'Two columns' : 'Three columns'"
          [class.bg-primary-container]="columns() === count" [class.text-on-primary-container]="columns() === count"
          class="flex h-9 w-9 items-center justify-center rounded text-lg hover:bg-surface-container-high focus-visible:outline-2 focus-visible:outline-primary">
          <app-ui-icon [name]="count === 1 ? 'layout-list' : count === 2 ? 'layout-columns' : 'layout-three-columns'" />
        </button>
      }
    </div>
  `,
})
export class SheetListLayoutComponent {
  readonly columns = signal(1);
}
