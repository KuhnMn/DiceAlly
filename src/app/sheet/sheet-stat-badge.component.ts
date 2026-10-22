import { Component, input } from '@angular/core';

@Component({
  selector: 'app-sheet-stat-badge',
  host: { class: 'inline-flex shrink-0' },
  template: `
    <div class="relative flex h-15 w-13 flex-col items-center justify-center" [class.text-primary]="tone() === 'primary'" [class.text-rose]="tone() === 'rose'" [class.text-teal]="tone() === 'teal'" [attr.aria-label]="label() + ' ' + value()">
      <svg aria-hidden="true" viewBox="0 0 56 64" class="absolute inset-0 h-full w-full" fill="none" stroke="currentColor" stroke-width="2.5"><path [attr.d]="paths[shape()]" /></svg>
      <span class="relative text-lg font-bold leading-tight text-on-surface">{{ value() }}</span>
      <span class="relative inline-flex items-center gap-1 text-[10px] font-semibold">@if (proficient()) { <span class="text-primary" title="Proficient" aria-label="Proficient">●</span> }{{ label() }}</span>
    </div>
  `,
})
export class SheetStatBadgeComponent {
  readonly paths = {
    shield: 'M5 3H51V43L28 61L5 43Z',
    octagon: 'M17 3H39L53 17V43L39 57H17L3 43V17Z',
    hexagon: 'M15 3H41L53 32L41 61H15L3 32Z',
    rounded: 'M18 6H38Q51 6 51 20V44Q51 58 38 58H18Q5 58 5 44V20Q5 6 18 6Z',
  } as const;
  readonly value = input.required<string | number>();
  readonly label = input.required<string>();
  readonly proficient = input(false);
  readonly tone = input<'primary' | 'rose' | 'teal'>('primary');
  readonly shape = input<keyof typeof this.paths>('shield');
}
