import { Directive, ElementRef, afterEveryRender, inject } from '@angular/core';

/** Sheet-only responsive rows. Native scrolling owns gestures even at either end. */
@Directive({
  selector: '[appHorizontalRow]',
  host: {
    // sr-only labels are absolutely positioned. Their containing block must be
    // inside this scroller, otherwise off-screen labels widen the document.
    class: 'relative min-w-0 max-w-full max-sm:w-full max-sm:flex max-sm:flex-nowrap max-sm:overflow-x-auto max-sm:overscroll-x-contain max-sm:pb-1 max-sm:[&>*]:shrink-0 max-sm:[&>*]:whitespace-nowrap [scrollbar-width:thin]',
    'data-horizontal-row': '',
    '(focusin)': 'reveal($event)',
    '(click)': 'reveal($event)',
  },
})
export class HorizontalRowDirective {
  private readonly element = inject<ElementRef<HTMLElement>>(ElementRef);
  private selected: HTMLElement | null = null;

  constructor() {
    afterEveryRender(() => {
      const selected = this.element.nativeElement.querySelector<HTMLElement>('[aria-pressed="true"]');
      if (selected === this.selected) return;
      this.selected = selected;
      if (selected) this.keepVisible(selected);
    });
  }

  reveal(event: Event) {
    if (event.target instanceof HTMLElement) this.keepVisible(event.target);
  }

  private keepVisible(child: HTMLElement) {
    const row = this.element.nativeElement;
    if (row.scrollWidth <= row.clientWidth) return;
    while (child.parentElement && child.parentElement !== row) child = child.parentElement;
    const bounds = row.getBoundingClientRect();
    const item = child.getBoundingClientRect();
    if (item.left < bounds.left) row.scrollLeft -= bounds.left - item.left;
    else if (item.right > bounds.right) row.scrollLeft += item.right - bounds.right;
  }
}
