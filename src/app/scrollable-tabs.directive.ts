import { Directive, DestroyRef, ElementRef, afterNextRender, afterRenderEffect, inject, input } from '@angular/core';

/** Keep the selected page visible without scrolling the document vertically. */
@Directive({ selector: '[appScrollableTabs]', host: { '[class.sheet-page-tabs]': 'sheetTabs()', class: 'page-tabs flex min-w-0 max-w-full flex-nowrap sm:flex-wrap gap-1 sm:gap-0 overflow-x-auto sm:overflow-x-visible overscroll-x-contain scroll-px-3 pb-2 sm:pb-1 [&>button]:flex-none sm:[&>button]:flex-1 [&>button]:whitespace-nowrap sm:[&>button]:whitespace-normal [&>button]:min-h-12 [&>button]:flex [&>button]:flex-col [&>button]:items-center [&>button]:justify-center max-sm:[&>button]:rounded-md max-sm:[&>button]:mb-0 max-sm:[&>button]:px-3 max-sm:[&>button]:py-2.5 max-sm:[&>button]:text-sm [&>button:focus-visible]:outline-2 [&>button:focus-visible]:outline-primary [&>button:focus-visible]:-outline-offset-3' } })
export class ScrollableTabsDirective {
  readonly sheetTabs = input(false);
  readonly appScrollableTabs = input.required<number>();
  private readonly element = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly destroyRef = inject(DestroyRef);

  constructor() {
    afterRenderEffect(() => {
      this.appScrollableTabs();
      this.revealSelected();
    });
    afterNextRender(() => {
      if (typeof ResizeObserver === 'undefined') return;
      const observer = new ResizeObserver(() => this.revealSelected());
      observer.observe(this.element.nativeElement);
      this.destroyRef.onDestroy(() => observer.disconnect());
    });
  }

  private revealSelected() {
    const bar = this.element.nativeElement;
    const selected = bar.querySelector<HTMLElement>('[aria-current="page"]');
    if (!selected || bar.scrollWidth <= bar.clientWidth) return;
    const bounds = bar.getBoundingClientRect();
    const active = selected.getBoundingClientRect();
    if (active.left < bounds.left) bar.scrollLeft -= bounds.left - active.left + 12;
    else if (active.right > bounds.right) bar.scrollLeft += active.right - bounds.right + 12;
  }
}
