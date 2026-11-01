import { sheetColumnCapacity } from './sheet-layout.service';
import { Component, signal, computed, inject, input, effect, ElementRef, afterNextRender, DestroyRef } from '@angular/core';
import { UiIconComponent } from '../ui-icon.component';
import { observeResizeAfterFrame } from '../resize-observer';

@Component({
  selector: 'app-sheet-list-layout',
  imports: [UiIconComponent],
  host: { class: 'hidden shrink-0 sm:block' },
  template: `
    <div class="flex gap-1 rounded-lg border border-outline-variant p-1" role="group" aria-label="List layout">
      @for (count of [1, 2, 3]; track count) {
        <button type="button" (click)="selectColumns(count)" [attr.aria-pressed]="displayColumns() === count" [disabled]="count > maxColumns()"
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
  readonly characterId = input<string | null>();
  readonly page = input<'features' | 'spells'>();
  readonly columns = signal(1);
  readonly maxColumns = signal(3);
  readonly displayColumns = computed(() => Math.min(this.columns(), this.maxColumns()));
  private readonly element = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly destroyRef = inject(DestroyRef);
  private readonly storageKey = computed(() => {
    const id = this.characterId(), page = this.page();
    return id && page ? `dice-ally-sheet-columns-${JSON.stringify([id, page])}` : null;
  });
  private activeStorageKey: string | null = null;
  constructor() {
    effect(() => {
      const key = this.storageKey();
      if (key === this.activeStorageKey) return;
      this.activeStorageKey = key;
      let columns = 1;
      if (key) {
        try {
          const stored = localStorage.getItem(key);
          if (stored === '1' || stored === '2' || stored === '3') columns = Number(stored);
        } catch { /* Use the default when browser storage is unavailable. */ }
      }
      this.columns.set(columns);
    });
    afterNextRender(() => {
      const container = this.element.nativeElement.closest('.sheet-tab-content') ?? this.element.nativeElement.parentElement;
      if (!container || typeof ResizeObserver === 'undefined') return;
      const measure = () => { const width = container.getBoundingClientRect().width; if (width > 0) this.maxColumns.set(sheetColumnCapacity(width)); };
      this.destroyRef.onDestroy(observeResizeAfterFrame([container], measure));
    });
  }
  selectColumns(columns: number) {
    if (![1, 2, 3].includes(columns)) return;
    this.columns.set(columns);
    const key = this.storageKey();
    if (key) {
      try { localStorage.setItem(key, String(columns)); }
      catch { /* Keep the current choice in memory when storage is unavailable. */ }
    }
  }
}
