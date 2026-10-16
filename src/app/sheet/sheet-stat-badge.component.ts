import { Component, input } from '@angular/core';

@Component({
  selector: 'app-sheet-stat-badge',
  host: { class: 'inline-flex shrink-0' },
  template: `
    <div class="relative flex h-16 w-14 flex-col items-center justify-center text-primary" [attr.aria-label]="label() + ' ' + value()">
      <svg aria-hidden="true" viewBox="0 0 56 64" class="absolute inset-0 h-full w-full" fill="none" stroke="currentColor" stroke-width="2.5"><path [attr.d]="shape() === 'shield' ? 'M5 3H51V43L28 61L5 43Z' : 'M17 3H39L53 17V43L39 57H17L3 43V17Z'" /></svg>
      <span class="relative text-lg font-bold leading-tight text-on-surface">{{ value() }}</span>
      <span class="relative text-[10px] font-semibold">{{ label() }}</span>
    </div>
  `,
})
export class SheetStatBadgeComponent {
  readonly value = input.required<string | number>();
  readonly label = input.required<string>();
  readonly shape = input<'shield' | 'octagon'>('shield');
}
