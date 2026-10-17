import { Component, input } from '@angular/core';

@Component({
  selector: 'app-advantage-badge',
  host: {
    role: 'img',
    '[attr.aria-label]': 'disadvantage() ? "Disadvantage" : "Advantage"',
    '[attr.title]': 'disadvantage() ? "Disadvantage" : "Advantage"',
    '[class.disadvantage]': 'disadvantage()',
  },
  template: `<span aria-hidden="true">{{ disadvantage() ? 'D' : 'A' }}</span>`,
  styles: [`
    :host {
      --badge-fill: var(--md-extended-color-custom-color4-color-container);
      --badge-ink: var(--md-extended-color-custom-color4-on-color-container);
      display: inline-flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      width: 2.25rem;
      height: 2.25rem;
      box-sizing: border-box;
      vertical-align: middle;
    }
    :host(.disadvantage) {
      --badge-fill: var(--md-extended-color-custom-color1-color-container);
      --badge-ink: var(--md-extended-color-custom-color1-on-color-container);
    }
    span {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 78%;
      height: 78%;
      clip-path: polygon(50% 0, 94% 25%, 94% 75%, 50% 100%, 6% 75%, 6% 25%);
      background: var(--badge-fill);
      color: var(--badge-ink);
      font-size: 1rem;
      font-weight: 800;
      line-height: 1;
    }
  `],
})
export class AdvantageBadgeComponent {
  readonly disadvantage = input(false);
}
