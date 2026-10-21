import { Component, computed, input } from '@angular/core';
import { Entry, EntriesEntry } from '../models/character.model';
import { EntryRendererComponent } from '../entries/entry-renderer.component';

/** Inline disclosure works with touch, keyboard, and long rule descriptions. */
@Component({
  selector: 'app-rule-details',
  imports: [EntryRendererComponent],
  host: { class: 'block min-w-0' },
  template: `
    @if (entries().length || notes()?.length) {
      <details class="rounded-lg border border-outline-variant bg-surface-container-low">
        <summary class="min-h-11 cursor-pointer px-3 py-2 text-sm font-semibold">{{ label() }}
          @for (note of notes() ?? []; track $index) { <div class="mt-1 font-normal text-on-surface-variant"><app-entry-renderer [entry]="{text: note}" [compact]="true" /></div> }
        </summary>
        @if (entries().length) { <div class="min-w-0 break-words px-3 pb-3 text-sm"><app-entry-renderer [entries]="entries()" /></div> }
      </details>
    } @else { <span class="inline-flex min-h-9 items-center rounded bg-surface-container-low px-2 text-xs">{{ label() }}</span> }
  `,
})
export class RuleDetailsComponent {
  readonly label = input.required<string>();
  readonly entry = input<Entry | Entry[] | null>();
  readonly notes = input<readonly string[]>();
  readonly entries = computed(() => {
    const entry = this.entry();
    const simplify = (entries: Entry[]): Entry[] => entries.flatMap(value => {
      if (value && typeof value === 'object' && 'type' in value
        && (value.type === 'entries' || value.type === 'com.ltx.data.EntriesEntry')) {
        const group = value as EntriesEntry;
        const children = simplify(group.entries ?? []);
        return group.name?.toLowerCase() === this.label().toLowerCase()
          ? children : [{ ...group, entries: children }];
      }
      return [value];
    });
    return simplify(entry ? Array.isArray(entry) ? entry : [entry] : []);
  });
}
