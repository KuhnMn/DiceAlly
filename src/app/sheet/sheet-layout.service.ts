import { Injectable, computed, inject, signal } from '@angular/core';
import { BreakpointObserver } from '@angular/cdk/layout';
import { toSignal } from '@angular/core/rxjs-interop';

export const SHEET_BREAKPOINTS = { tablet: 640, wideTablet: 768, desktop: 1280, shortHeight: 500 } as const;
export function sheetColumnCapacity(width: number): number { return width >= 992 ? 3 : width >= 656 ? 2 : 1; }

const TABLET = `(min-width: ${SHEET_BREAKPOINTS.tablet}px)`;
const WIDE_TABLET = `(min-width: ${SHEET_BREAKPOINTS.wideTablet}px)`;
const DESKTOP = `(min-width: ${SHEET_BREAKPOINTS.desktop}px)`;
const SHORT = `(max-height: ${SHEET_BREAKPOINTS.shortHeight}px)`;

/** Sheet composition uses one width contract. Height only affects sticky chrome, never page availability. */
@Injectable({ providedIn: 'root' })
export class SheetLayoutService {
  private readonly sizes = toSignal(inject(BreakpointObserver).observe([TABLET, WIDE_TABLET, DESKTOP, SHORT]));
  readonly contentColumns = signal(1);
  readonly mode = computed(() => this.sizes()?.breakpoints[DESKTOP] ? 'desktop' : this.sizes()?.breakpoints[TABLET] ? 'tablet' : 'phone');
  readonly compact = computed(() => this.mode() !== 'desktop');
  readonly wideTablet = computed(() => this.mode() === 'tablet' && !!this.sizes()?.breakpoints[WIDE_TABLET]);
  readonly shortTablet = computed(() => this.mode() === 'tablet' && !!this.sizes()?.breakpoints[SHORT]);
}
