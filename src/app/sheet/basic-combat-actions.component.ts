import { Component, input } from '@angular/core';
import type { BasicActionDescription } from '../models/character-references';
import { RuleReferenceComponent } from './rule-reference.component';

/** Compact reference cards share the combat palette and open their full descriptions. */
@Component({
  selector: 'app-basic-combat-actions',
  host: { class: 'block min-w-0 pb-1' },
  imports: [RuleReferenceComponent],
  styles: [`
    .basic-action-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(min(100%, max(7rem, calc((100% - .75rem) / 4))), 1fr));
      gap: .25rem;
    }
  `],
  template: `
    <details>
      <summary data-page-swipe class="cursor-pointer rounded py-1 text-xs font-bold text-tertiary focus-visible:outline-2 focus-visible:outline-primary">Basic</summary>
      <div class="basic-action-grid mt-1">
        @for (action of actions(); track action.name) {
          <app-rule-reference appearance="combat" [reference]="action">
            <span class="min-w-0 flex-1 text-xs font-semibold leading-4 [overflow-wrap:anywhere]">{{ action.name }}</span>
          </app-rule-reference>
        }
      </div>
    </details>
  `,
})
export class BasicCombatActionsComponent {
  readonly actions = input.required<readonly BasicActionDescription[]>();
}
