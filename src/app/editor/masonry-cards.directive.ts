import { AfterViewInit, Directive, ElementRef, OnDestroy, inject } from '@angular/core';
import { observeResizeAfterFrame } from '../resize-observer';

/** Size grid rows to each card so later cards can occupy gaps in either column. */
@Directive({ selector: '[appMasonryCards]' })
export class MasonryCardsDirective implements AfterViewInit, OnDestroy {
  private readonly element = inject<ElementRef<HTMLElement>>(ElementRef);
  private stopObserving?: () => void;

  ngAfterViewInit() {
    if (typeof ResizeObserver === 'undefined') return;
    const container = this.element.nativeElement;
    const cards = Array.from(container.querySelectorAll<HTMLElement>('.editor-card'));
    const sizeCards = () => {
      const spans = cards.map(card => `span ${Math.ceil(card.getBoundingClientRect().height + 16)}`);
      cards.forEach((card, index) => {
        // One-pixel rows, plus the same 16px spacing used by the rest of the editor.
        if (card.style.gridRowEnd !== spans[index]) card.style.gridRowEnd = spans[index];
      });
    };
    this.stopObserving = observeResizeAfterFrame(cards, sizeCards);
    container.classList.add('masonry-ready');
  }

  ngOnDestroy() { this.stopObserving?.(); }
}
