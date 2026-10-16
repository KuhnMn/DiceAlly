import { Component, computed, input } from '@angular/core';
import { Entry } from '../models/character.model';
import { EntryRendererComponent } from '../entries/entry-renderer.component';

/** Inline disclosure works with touch, keyboard, and long rule descriptions. */
@Component({
  selector: 'app-rule-details',
  imports: [EntryRendererComponent],
  host: { class: 'block min-w-0' },
  template: `
    @if (entries().length) {
      <details class="rounded-lg border border-outline-variant bg-surface-container-low">
        <summary class="min-h-11 cursor-pointer px-3 py-2 text-sm font-semibold">{{ label() }}</summary>
        <div class="min-w-0 break-words px-3 pb-3 text-sm"><app-entry-renderer [entries]="entries()" /></div>
      </details>
    } @else { <span class="inline-flex min-h-9 items-center rounded bg-surface-container-low px-2 text-xs">{{ label() }}</span> }
  `,
})
export class RuleDetailsComponent {
  readonly label = input.required<string>();
  readonly entry = input<Entry | Entry[] | null>();
  readonly entries = computed(() => { const entry = this.entry(); return entry ? Array.isArray(entry) ? entry : [entry] : []; });
}
