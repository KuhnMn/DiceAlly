import { ChangeDetectorRef, DestroyRef, Directive, ElementRef, inject, input, output } from '@angular/core';
import { captureSwipePane, SwipeSnapshot } from './swipe-snapshot';

/** Finger-following page transitions without disturbing native scrolling, Angular views or form state. */
@Directive({
  selector: '[appSwipePages]',
  host: {
    '(touchstart)': 'start($event)',
    '(touchmove)': 'move($event)',
    '(touchend)': 'end($event)',
    '(touchcancel)': 'cancel()',
    '(window:resize)': 'reset()',
  },
})
export class SwipePagesDirective {
  readonly pageSwipe = output<-1 | 1>();
  readonly swipePrevious = input(true);
  readonly swipeNext = input(true);
  private readonly element = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly view = inject(ChangeDetectorRef);
  private origin?: { x: number; y: number };
  private current?: SwipeSnapshot;
  private incoming?: SwipeSnapshot;
  private readonly animations: Animation[] = [];
  private frame = 0;
  private timer?: ReturnType<typeof setTimeout>;
  private offset = 0;
  private hidden = false;
  private opacity = '';
  private suppressClickUntil = 0;

  constructor() {
    const host = this.element.nativeElement;
    const preventSwipeClick = (event: MouseEvent) => {
      if (performance.now() >= this.suppressClickUntil) return;
      event.preventDefault(); event.stopImmediatePropagation();
    };
    host.addEventListener('click', preventSwipeClick, true);
    inject(DestroyRef).onDestroy(() => {
      this.reset();
      host.removeEventListener('click', preventSwipeClick, true);
    });
  }

  private reducedMotion() { return !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches; }
  private allowed(dx: number) { return dx < 0 ? this.swipeNext() : this.swipePrevious(); }
  private hideHost() {
    if (this.hidden) return;
    this.opacity = this.element.nativeElement.style.opacity;
    this.element.nativeElement.style.opacity = '0';
    this.hidden = true;
  }
  private picture() {
    if (!this.current && !this.reducedMotion()) {
      this.current = captureSwipePane(this.element.nativeElement);
      if (this.current) this.hideHost();
    }
  }
  private animate(picture: SwipeSnapshot, from: number, to: number, duration: number) {
    const content = picture.content;
    content.style.transform = `translate3d(${to}px, 0, 0)`;
    if (content.animate) this.animations.push(content.animate([
      { transform: `translate3d(${from}px, 0, 0)` }, { transform: `translate3d(${to}px, 0, 0)` },
    ], { duration, easing: 'cubic-bezier(0.22, 1, 0.36, 1)', fill: 'both' }));
  }

  start(event: TouchEvent) {
    this.reset(); this.suppressClickUntil = 0;
    if (event.touches.length !== 1 || window.innerWidth >= 640 || window.getSelection()?.toString()) return;
    if (document.querySelector('dialog[open], [aria-modal="true"]')) return;
    const point = event.touches[0];
    if (point.clientX < 24 || point.clientX > window.innerWidth - 24) return;
    let target = event.target instanceof HTMLElement ? event.target : null;
    while (target && target !== this.element.nativeElement) {
      if (target.matches('dialog, input, textarea, select, button:not([data-page-swipe]), a, summary, label, [contenteditable]:not([contenteditable="false"]), [role="dialog"], [role="slider"], [data-horizontal-row]')) return;
      const overflow = getComputedStyle(target).overflowX;
      if (['auto', 'scroll'].includes(overflow) && target.scrollWidth > target.clientWidth) return;
      target = target.parentElement;
    }
    this.origin = { x: point.clientX, y: point.clientY };
  }

  move(event: TouchEvent) {
    if (!this.origin) return;
    if (event.touches.length !== 1 || Math.abs(event.touches[0].clientY - this.origin.y) > 35) { this.cancel(); return; }
    const dx = event.touches[0].clientX - this.origin.x;
    const dy = event.touches[0].clientY - this.origin.y;
    if (Math.abs(dx) < 12 || Math.abs(dx) < Math.abs(dy) * 2) return;
    if (event.cancelable) event.preventDefault();
    this.picture();
    this.offset = this.allowed(dx) ? dx : dx * 0.2;
    if (this.current) this.current.content.style.transform = `translate3d(${this.offset}px, 0, 0)`;
  }

  end(event: TouchEvent) {
    const origin = this.origin;
    this.origin = undefined;
    if (!origin) return;
    if (event.changedTouches.length !== 1 || window.getSelection()?.toString()) { this.cancel(); return; }
    const point = event.changedTouches[0];
    const dx = point.clientX - origin.x, dy = point.clientY - origin.y;
    if (Math.abs(dx) < 70 || Math.abs(dx) < Math.abs(dy) * 2 || !this.allowed(dx)) { this.cancel(); return; }
    this.suppressClickUntil = performance.now() + 500;
    this.picture();
    const outgoing = this.current;
    this.pageSwipe.emit(dx < 0 ? 1 : -1);
    if (!outgoing || this.reducedMotion()) { this.reset(); return; }
    // Commit once, then capture the real destination after Angular and the sheet's scroll restoration.
    this.view.detectChanges();
    this.frame = requestAnimationFrame(() => {
      this.frame = 0;
      this.incoming = captureSwipePane(this.element.nativeElement);
      const exit = dx < 0 ? -outgoing.width : outgoing.width;
      const start = Math.max(-outgoing.width, Math.min(outgoing.width, this.offset));
      this.animate(outgoing, start, exit, 220);
      if (this.incoming) {
        this.animate(this.incoming, start + (dx < 0 ? outgoing.width : -outgoing.width), 0, 220);
      }
      this.timer = setTimeout(() => this.reset(), 230);
    });
  }

  cancel() {
    this.origin = undefined;
    if (!this.current) { this.reset(); return; }
    this.suppressClickUntil = performance.now() + 500;
    this.animate(this.current, this.offset, 0, 160);
    this.timer = setTimeout(() => this.reset(), 170);
  }

  reset() {
    this.origin = undefined;
    if (this.frame) cancelAnimationFrame(this.frame);
    this.frame = 0; clearTimeout(this.timer); this.timer = undefined;
    for (const animation of this.animations) animation.cancel();
    this.animations.length = 0;
    this.current?.viewport.remove(); this.incoming?.viewport.remove();
    this.current = this.incoming = undefined;
    if (this.hidden) this.element.nativeElement.style.opacity = this.opacity;
    this.hidden = false; this.offset = 0;
  }
}
