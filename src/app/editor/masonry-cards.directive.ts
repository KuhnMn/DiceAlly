import { AfterViewInit, Directive, ElementRef, OnDestroy, inject } from '@angular/core';

/** Size grid rows to each card so later cards can occupy gaps in either column. */
@Directive({ selector: '[appMasonryCards]' })
export class MasonryCardsDirective implements AfterViewInit, OnDestroy {
  private readonly element = inject<ElementRef<HTMLElement>>(ElementRef);
  private observer?: ResizeObserver;

  ngAfterViewInit() {
    if (typeof ResizeObserver === 'undefined') return;
    const container = this.element.nativeElement;
    const cards = Array.from(container.querySelectorAll<HTMLElement>('.editor-card'));
    const sizeCards = () => {
      for (const card of cards) {
        // One-pixel rows, plus the same 16px spacing used by the rest of the editor.
        card.style.gridRowEnd = `span ${Math.ceil(card.getBoundingClientRect().height + 16)}`;
      }
    };
    sizeCards();
    container.classList.add('masonry-ready');
    this.observer = new ResizeObserver(sizeCards);
    cards.forEach(card => this.observer!.observe(card));
  }

  ngOnDestroy() { this.observer?.disconnect(); }
}
