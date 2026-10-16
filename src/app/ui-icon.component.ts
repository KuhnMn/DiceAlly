import { Component, input } from '@angular/core';

const ICON_PATHS: Record<string, string | undefined> = {
  backpack: 'M8 5V3h8v2M7 5h10a3 3 0 0 1 3 3v12H4V8a3 3 0 0 1 3-3ZM8 14h8v6M8 10h8',
  flame: 'M12 2c1 5 7 7 7 13a7 7 0 0 1-14 0c0-3 1-5 4-8 0 4 2 5 3 5 2-3 1-7 0-10Z',
  save: 'M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h12l4 4v12a2 2 0 0 1-2 2ZM7 3v6h10V3M7 21v-8h10v8',
  edit: 'm16 3 5 5-12 12-6 1 1-6ZM14 5l5 5',
  close: 'm6 6 12 12M6 18 18 6',
  plus: 'M12 5v14M5 12h14',
  minus: 'M5 12h14',
  trash: 'M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7',
  left: 'm12 5-7 7 7 7M5 12h14',
  right: 'm12 5 7 7-7 7M5 12h14',
  up: 'm5 12 7-7 7 7M12 5v14',
  down: 'm5 12 7 7 7-7M12 5v14',
  chevron: 'm9 5 7 7-7 7',
  'chevron-down': 'm5 9 7 7 7-7',
  copy: 'M9 9h12v12H9ZM15 5V3H3v12h2',
  file: 'M14 2H4v20h16V8ZM14 2v6h6M8 13h8M8 17h8',
  loader: 'M21 12a9 9 0 1 1-6-8.5',
  rest: 'M4 10V6h12v4M3 17v3M21 17v3M3 17v-7h18v7ZM3 14h18',
  campfire: 'm5 21 14-4M5 17l14 4M12 3c1 4 5 5 5 9a5 5 0 0 1-10 0c0-2 1-4 3-6 0 3 1 4 2 4 1-2 1-4 0-7Z',
  hand: 'M8 13V6a2 2 0 0 1 4 0v6-8a2 2 0 0 1 4 0v8-6a2 2 0 0 1 4 0v9c0 5-3 7-7 7-3 0-5-1-7-4l-3-4a2 2 0 0 1 3-3l2 2',
  moon: 'M21 13a9 9 0 1 1-10-10 7 7 0 0 0 10 10Z',
  sparkles: 'm12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5ZM20 2v4M18 4h4',
  info: 'M12 8h.01M12 11v6M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0',
  image: 'M3 3h18v18H3ZM3 17l6-6 4 4 3-3 5 5M16 7h.01',
  heart: 'M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z',
  lock: 'M5 10h14v11H5ZM8 10V6a4 4 0 0 1 8 0v4M12 14v3',
  check: 'm5 12 4 4L19 6',
  reset: 'M3 10a9 9 0 1 1 1 7M3 3v7h7',
  candle: 'M9 10h6v11H9ZM12 2c-4 4-1 7 0 7s4-3 0-7ZM6 21h12',
  wand: 'm3 17 12-12 4 4L7 21ZM12 8l4 4M5 3v4M3 5h4M21 2v4M19 4h4M21 17v4M19 19h4',
  bookmark: 'M6 3h12v18l-6-4-6 4V3Z',
};

/** Decorative outline icons inherit the control's color; the control supplies its accessible name. */
@Component({
  selector: 'app-ui-icon',
  host: { 'aria-hidden': 'true' },
  template: `<svg viewBox="0 0 24 24" [attr.fill]="filled() ? 'currentColor' : 'none'" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" focusable="false"><path [attr.d]="paths[name()] ?? paths['info']" /></svg>`,
  styles: [':host { display: inline-flex; width: 1em; height: 1em; flex-shrink: 0; vertical-align: -.15em; } svg { width: 100%; height: 100%; }'],
})
export class UiIconComponent {
  readonly name = input.required<string>();
  readonly filled = input(false);
  readonly paths = ICON_PATHS;
}
