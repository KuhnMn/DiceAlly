import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { AfterViewInit, ChangeDetectionStrategy, Component, NgZone, OnDestroy, PLATFORM_ID, effect, inject, input, signal } from '@angular/core';
import { UiIconComponent } from './ui-icon.component';

/** Return to the active tab's content, leaving sticky navigation visible. */
@Component({
  selector: 'app-scroll-to-top',
  imports: [UiIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (visible()) {
      <button type="button" [style.top.px]="buttonTop()" [attr.aria-label]="label()" title="Back to top" (click)="scrollToTop()"><app-ui-icon name="up" /></button>
    }
  `,
  styles: [`
    :host { display: block; height: 0; }
    button { position: fixed; z-index: 40; right: max(.75rem, calc((100vw - 1200px) / 2 + 1rem));
      display: grid; place-items: center; width: 2.75rem; height: 2.75rem;
      border: 1px solid var(--md-sys-color-outline-variant); border-radius: 50%;
      background: var(--md-sys-color-secondary-container); color: var(--md-sys-color-on-secondary-container);
      box-shadow: 0 .125rem .5rem rgb(0 0 0 / .25); font-size: 1.25rem; cursor: pointer; }
    button:hover { border-color: var(--md-sys-color-primary); }
    button:focus-visible { outline: 2px solid var(--md-sys-color-primary); outline-offset: 3px; }
  `],
})
export class ScrollToTopComponent implements AfterViewInit, OnDestroy {
  readonly target = input.required<HTMLElement>();
  readonly navigation = input.required<HTMLElement>();
  readonly page = input.required<string | number>();
  readonly label = input('Back to top of current tab');
  readonly visible = signal(false);
  readonly buttonTop = signal(12);
  private readonly document = inject(DOCUMENT);
  private readonly zone = inject(NgZone);
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));
  private window: Window | null = null;
  private frame = 0;
  private observer?: ResizeObserver;

  constructor() { effect(() => { this.page(); this.scheduleMeasure(); }); }

  ngAfterViewInit() {
    if (!this.browser) return;
    this.window = this.document.defaultView;
    this.zone.runOutsideAngular(() => {
      this.window?.addEventListener('scroll', this.scheduleMeasure, { passive: true });
      this.window?.addEventListener('resize', this.scheduleMeasure);
      if (typeof ResizeObserver !== 'undefined') {
        this.observer = new ResizeObserver(this.scheduleMeasure);
        this.observer.observe(this.target()); this.observer.observe(this.navigation());
      }
      this.scheduleMeasure();
    });
  }

  private readonly scheduleMeasure = () => {
    if (!this.window || this.frame) return;
    this.frame = this.window.requestAnimationFrame(() => {
      this.frame = 0;
      const offset = this.navigationOffset();
      const visible = this.target().getBoundingClientRect().top < offset - 24;
      const top = offset + 12;
      if (visible !== this.visible() || top !== this.buttonTop()) {
        this.zone.run(() => { this.visible.set(visible); this.buttonTop.set(top); });
      }
    });
  };

  private navigationOffset() {
    const navigation = this.navigation(), box = navigation.getBoundingClientRect();
    const style = this.window?.getComputedStyle(navigation);
    const stickyTop = Number.parseFloat(style?.top ?? '') || 0;
    return style?.position === 'sticky' && box.top <= stickyTop + 1
      ? Math.max(0, box.bottom) : 0;
  }

  scrollToTop() {
    if (!this.window) return;
    const top = Math.max(0, this.window.scrollY + this.target().getBoundingClientRect().top - this.navigationOffset() - 12);
    this.target().focus({ preventScroll: true });
    this.window.scrollTo({ top, behavior: this.window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
  }

  ngOnDestroy() {
    this.window?.removeEventListener('scroll', this.scheduleMeasure);
    this.window?.removeEventListener('resize', this.scheduleMeasure);
    if (this.frame) this.window?.cancelAnimationFrame(this.frame);
    this.observer?.disconnect(); this.window = null;
  }
}
