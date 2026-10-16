import { Directive, ElementRef, inject, output } from '@angular/core';

/** Recognize page swipes without cancelling native vertical or nested horizontal scrolling. */
@Directive({
  selector: '[appSwipePages]',
  host: {
    '(touchstart)': 'start($event)',
    '(touchmove)': 'move($event)',
    '(touchend)': 'end($event)',
    '(touchcancel)': 'cancel()',
  },
})
export class SwipePagesDirective {
  readonly pageSwipe = output<-1 | 1>();
  private readonly element = inject<ElementRef<HTMLElement>>(ElementRef);
  private origin?: { x: number; y: number; time: number };

  start(event: TouchEvent) {
    this.cancel();
    if (event.touches.length !== 1 || window.innerWidth >= 640 || window.getSelection()?.toString()) return;
    const point = event.touches[0];
    if (point.clientX < 24 || point.clientX > window.innerWidth - 24) return;
    let target = event.target instanceof HTMLElement ? event.target : null;
    while (target && target !== this.element.nativeElement) {
      if (target.matches('dialog, input, textarea, select, button, a, summary, label, [contenteditable]:not([contenteditable="false"]), [role="dialog"], [role="slider"], [data-horizontal-row]')) return;
      const overflow = getComputedStyle(target).overflowX;
      if (['auto', 'scroll'].includes(overflow) && target.scrollWidth > target.clientWidth) return;
      target = target.parentElement;
    }
    this.origin = { x: point.clientX, y: point.clientY, time: event.timeStamp };
  }

  move(event: TouchEvent) {
    if (!this.origin) return;
    if (event.touches.length !== 1 || Math.abs(event.touches[0].clientY - this.origin.y) > 35) this.cancel();
  }

  end(event: TouchEvent) {
    const origin = this.origin;
    this.cancel();
    if (!origin || event.changedTouches.length !== 1 || window.getSelection()?.toString()) return;
    const point = event.changedTouches[0];
    const dx = point.clientX - origin.x;
    const dy = point.clientY - origin.y;
    if (event.timeStamp - origin.time > 900 || Math.abs(dx) < 70 || Math.abs(dx) < Math.abs(dy) * 2) return;
    this.pageSwipe.emit(dx < 0 ? 1 : -1);
  }

  cancel() { this.origin = undefined; }
}
