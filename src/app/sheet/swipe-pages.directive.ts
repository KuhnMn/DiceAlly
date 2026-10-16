import { DestroyRef, Directive, ElementRef, inject, output } from '@angular/core';

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
  private animation?: Animation;
  private progress = 0;
  private suppressClickUntil = 0;

  constructor() {
    const host = this.element.nativeElement;
    const preventSwipeClick = (event: MouseEvent) => {
      if (performance.now() >= this.suppressClickUntil) return;
      event.preventDefault();
      event.stopImmediatePropagation();
    };
    host.addEventListener('click', preventSwipeClick, true);
    inject(DestroyRef).onDestroy(() => {
      this.animation?.cancel();
      host.removeEventListener('click', preventSwipeClick, true);
    });
  }

  private animate(frames: Keyframe[], duration: number) {
    this.animation?.cancel();
    this.animation = undefined;
    const host = this.element.nativeElement;
    if (!host.animate || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    this.animation = host.animate(frames, { duration, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' });
  }

  start(event: TouchEvent) {
    this.cancel();
    this.suppressClickUntil = 0;
    if (event.touches.length !== 1 || window.innerWidth >= 640 || window.getSelection()?.toString()) return;
    const point = event.touches[0];
    if (point.clientX < 24 || point.clientX > window.innerWidth - 24) return;
    let target = event.target instanceof HTMLElement ? event.target : null;
    while (target && target !== this.element.nativeElement) {
      if (target.matches('dialog, input, textarea, select, button:not([data-page-swipe]), a, summary, label, [contenteditable]:not([contenteditable="false"]), [role="dialog"], [role="slider"], [data-horizontal-row]')) return;
      const overflow = getComputedStyle(target).overflowX;
      if (['auto', 'scroll'].includes(overflow) && target.scrollWidth > target.clientWidth) return;
      target = target.parentElement;
    }
    this.origin = { x: point.clientX, y: point.clientY, time: event.timeStamp };
  }

  move(event: TouchEvent) {
    if (!this.origin) return;
    if (event.touches.length !== 1 || Math.abs(event.touches[0].clientY - this.origin.y) > 35) { this.cancel(); return; }
    const dx = Math.abs(event.touches[0].clientX - this.origin.x);
    const dy = Math.abs(event.touches[0].clientY - this.origin.y);
    if (dx < 12 || dx < dy * 2) return;
    // Opacity feedback cannot expand the document or disturb nested scroll positions.
    if (!this.progress) {
      this.animate([{ opacity: 1 }, { opacity: 0.82 }], 1000);
      this.animation?.pause();
    }
    this.progress = Math.min(1, dx / 180);
    if (this.animation) this.animation.currentTime = this.progress * 1000;
  }

  end(event: TouchEvent) {
    const origin = this.origin;
    this.cancel();
    if (!origin || event.changedTouches.length !== 1 || window.getSelection()?.toString()) return;
    const point = event.changedTouches[0];
    const dx = point.clientX - origin.x;
    const dy = point.clientY - origin.y;
    if (event.timeStamp - origin.time > 900 || Math.abs(dx) < 70 || Math.abs(dx) < Math.abs(dy) * 2) return;
    this.suppressClickUntil = performance.now() + 500;
    this.pageSwipe.emit(dx < 0 ? 1 : -1);
    this.animate([
      { opacity: 0.82, transform: 'scale(0.99)', transformOrigin: 'top center' },
      { opacity: 1, transform: 'scale(1)', transformOrigin: 'top center' },
    ], 200);
  }

  cancel() {
    this.origin = undefined;
    if (this.progress) this.animate([{ opacity: 1 - this.progress * 0.18 }, { opacity: 1 }], 140);
    this.progress = 0;
  }
}
