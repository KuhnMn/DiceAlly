import { Component, computed, input, signal } from '@angular/core';
import { OverlayModule } from '@angular/cdk/overlay';
import { Entry, EntriesEntry } from '../models/character.model';
import { EntryRendererComponent } from '../entries/entry-renderer.component';

/** Compact rule tags expose their descriptions on hover, keyboard focus, or tap. */
@Component({
  selector: 'app-item-rule-tag',
  imports: [OverlayModule, EntryRendererComponent],
  host: { class: 'inline-flex min-w-0 max-w-full' },
  template: `
    <button type="button" cdkOverlayOrigin #origin="cdkOverlayOrigin"
      class="max-w-full rounded px-2 py-0.5 text-xs text-left break-words" [class.bg-teal-container]="!mastery()" [class.text-on-teal-container]="!mastery()"
      [class.bg-secondary-container]="mastery()" [class.text-on-secondary-container]="mastery()"
      [attr.aria-expanded]="opened() && hasDetails()"
      (mouseenter)="opened.set(true)" (mouseleave)="opened.set(false)" (focus)="opened.set(true)" (blur)="opened.set(false)"
      (click)="opened.set(true)" (keydown.escape)="opened.set(false); $event.stopPropagation()"><app-entry-renderer [entry]="{text: presentation().label}" [inline]="true" /></button>
    <ng-template cdkConnectedOverlay [cdkConnectedOverlayOrigin]="origin" [cdkConnectedOverlayOpen]="opened() && hasDetails()"
      [cdkConnectedOverlayPush]="true" [cdkConnectedOverlayViewportMargin]="8" (overlayOutsideClick)="opened.set(false)">
      <div role="tooltip" class="my-1 max-h-[50dvh] w-80 max-w-[calc(100vw-1rem)] overflow-auto rounded-lg border border-outline-variant bg-surface-container-high p-3 text-sm text-on-surface shadow-lg">
        <strong class="mb-1 block font-semibold">{{ label() }}</strong>
        @for (note of notes() ?? []; track $index) { <div class="mb-2 text-on-surface-variant"><app-entry-renderer [entry]="{text: note}" /></div> }
        <app-entry-renderer [entry]="presentation().entry" />
      </div>
    </ng-template>
  `,
})
export class ItemRuleTagComponent {
  readonly label = input.required<string>();
  readonly entry = input<Entry | null>();
  readonly notes = input<readonly string[]>();
  readonly presentation = computed(() => {
    const label = this.label();
    const normalize = (text: string) => text.trim().replace(/[\u2011\u2010]/g, '-').toLowerCase();
    // Promote item-specific summaries and remove leading label-only templates.
    // Ordinary prose remains in the tooltip.
    const split = (entry: Entry | null): { label: string; entry: Entry | null } => {
      const text = typeof entry === 'string' ? entry
        : entry && typeof entry === 'object' && 'text' in entry && typeof entry.text === 'string' ? entry.text : undefined;
      if (text) {
        if (normalize(text) === normalize(label)) return { label, entry: null };
        const summary = /^(.*?)\s+(\([^\n]*\))$/.exec(text.trim());
        if (summary && normalize(summary[1]) === normalize(label)) return { label: text.trim(), entry: null };
      }
      if (entry && typeof entry === 'object' && 'type' in entry
        && (entry.type === 'entries' || entry.type === 'com.ltx.data.EntriesEntry')) {
        const group = entry as EntriesEntry;
        if (!group.name && group.entries?.length) {
          const first = split(group.entries[0]);
          if (first.entry !== group.entries[0]) {
            const entries = [...(first.entry ? [first.entry] : []), ...group.entries.slice(1)];
            return { label: first.label, entry: entries.length ? { ...group, entries } : null };
          }
        }
      }
      return { label, entry };
    };
    const withoutRepeatedHeading = (entry: Entry | null): Entry | null => {
      if (entry && typeof entry === 'object' && 'type' in entry
        && (entry.type === 'entries' || entry.type === 'com.ltx.data.EntriesEntry')) {
        const group = entry as EntriesEntry;
        return { ...group, name: group.name && normalize(group.name) === normalize(label) ? undefined : group.name,
          entries: (group.entries ?? []).map(child => withoutRepeatedHeading(child)!) };
      }
      return entry;
    };
    const result = split(this.entry() ?? null);
    return { ...result, entry: withoutRepeatedHeading(result.entry) };
  });
  readonly hasDetails = computed(() => !!this.presentation().entry || !!this.notes()?.length);
  readonly mastery = input(false);
  readonly opened = signal(false);
}
