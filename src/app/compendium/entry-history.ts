import { computed, signal } from '@angular/core';
import { ContentRecord } from '../content/content.model';

/** History belongs to one open detail view and resets when another list entry opens. */
export class EntryHistory {
  private readonly entries = signal<ContentRecord[]>([]);
  readonly previous = computed(() => this.entries().at(-1));

  push(record: ContentRecord) { this.entries.update(entries => [...entries, record]); }
  pop() {
    const previous = this.previous();
    this.entries.update(entries => entries.slice(0, -1));
    return previous;
  }
  clear() { this.entries.set([]); }
}
