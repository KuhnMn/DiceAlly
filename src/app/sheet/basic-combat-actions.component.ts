import { Component, input } from '@angular/core';
import type { BasicActionDescription } from '../models/character-references';
import { RuleReferenceComponent } from './rule-reference.component';

/** Same rows as authored combat actions, with reference help instead of a navigation action. */
@Component({
  selector: 'app-basic-combat-actions',
  host: { class: 'block pb-2' },
  imports: [RuleReferenceComponent],
  template: `
    <details>
      <summary data-page-swipe class="cursor-pointer rounded py-1 text-xs font-bold text-tertiary focus-visible:outline-2 focus-visible:outline-primary">Basic</summary>
      <div class="mt-1 space-y-1">
        @for (action of actions(); track action.name) {
          <app-rule-reference appearance="combat" [reference]="action">
            <span class="min-w-0 flex-1 break-words text-sm font-semibold">{{ action.name }}</span>
          </app-rule-reference>
        }
      </div>
    </details>
  `,
})
export class BasicCombatActionsComponent {
  readonly actions = input.required<readonly BasicActionDescription[]>();
}
