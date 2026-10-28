import { sheetColumnCapacity } from './sheet-layout.service';
import { Component, signal, computed, inject, ElementRef, afterNextRender, DestroyRef } from '@angular/core';
import { UiIconComponent } from '../ui-icon.component';
import { observeResizeAfterFrame } from '../resize-observer';

@Component({
  selector: 'app-sheet-list-layout',
  imports: [UiIconComponent],
  host: { class: 'hidden shrink-0 sm:block' },
  template: `
    <div class="flex gap-1 rounded-lg border border-outline-variant p-1" role="group" aria-label="List layout">
      @for (count of [1, 2, 3]; track count) {
        <button type="button" (click)="columns.set(count)" [attr.aria-pressed]="displayColumns() === count" [disabled]="count > maxColumns()"
          [attr.aria-label]="count === 1 ? 'One column' : count === 2 ? 'Two columns' : 'Three columns'" [title]="count === 1 ? 'One column' : count === 2 ? 'Two columns' : 'Three columns'"
          [class.bg-primary-container]="displayColumns() === count" [class.text-on-primary-container]="displayColumns() === count"
          class="flex h-9 w-9 items-center justify-center rounded text-lg hover:bg-surface-container-high disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-primary">
          <app-ui-icon [name]="count === 1 ? 'layout-list' : count === 2 ? 'layout-columns' : 'layout-three-columns'" />
        </button>
      }
    </div>
  `,
})
export class SheetListLayoutComponent {
  readonly columns = signal(1);
  readonly maxColumns = signal(3);
  readonly displayColumns = computed(() => Math.min(this.columns(), this.maxColumns()));
  private readonly element = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly destroyRef = inject(DestroyRef);
  constructor() {
    afterNextRender(() => {
      const container = this.element.nativeElement.closest('.sheet-tab-content') ?? this.element.nativeElement.parentElement;
      if (!container || typeof ResizeObserver === 'undefined') return;
      const measure = () => { const width = container.getBoundingClientRect().width; if (width > 0) this.maxColumns.set(sheetColumnCapacity(width)); };
      this.destroyRef.onDestroy(observeResizeAfterFrame([container], measure));
    });
  }
}
