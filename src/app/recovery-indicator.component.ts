import { Component, computed, input } from '@angular/core';
import { UiIconComponent } from './ui-icon.component';
import { regainLabel } from './sheet/regain-label';

/** One recovery vocabulary for sheet badges and editor previews. */
@Component({
  selector: 'app-recovery-indicator',
  imports: [UiIconComponent],
  host: { class: 'inline-flex shrink-0 items-center' },
  template: `
    <span class="inline-flex items-center gap-1.5 text-xs text-on-surface-variant">
      <span role="img" [attr.aria-label]="'Regain: ' + label()" [title]="'Regain: ' + label()" class="inline-flex items-center gap-0.5 rounded px-1 py-0.5 text-base leading-none sm:text-lg sm:leading-normal">
        <app-ui-icon [name]="icon()" />
        @if (condition() === 'SHORT_REST_ONE') { <span aria-hidden="true" class="text-[10px] font-bold">+1</span> }
      </span>
      @if (showText() || icon() === 'info') { <span>{{ label() }}</span> }
    </span>
  `,
})
export class RecoveryIndicatorComponent {
  readonly condition = input<string | null | undefined>();
  readonly showText = input(false);
  readonly label = computed(() => regainLabel(this.condition()));
  readonly icon = computed(() => {
    switch (this.condition() || 'LONG_REST') {
      case 'LONG_REST': return 'rest';
      case 'SHORT_REST': case 'SHORT_REST_ONE': return 'campfire';
      case 'MANUAL': return 'hand';
      default: return 'info';
    }
  });
}
