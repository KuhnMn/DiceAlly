import { Component, computed, input, output, signal } from '@angular/core';
import { UiIconComponent } from '../ui-icon.component';

/** Controlled selection: a list owns its copy and never writes shared defaults. */
@Component({
  selector: 'app-compendium-source-filter',
  imports: [UiIconComponent],
  host: { class: 'block min-w-0' },
  template: `
    <details class="min-w-0 rounded-lg border border-outline-variant bg-surface-container">
      <summary class="flex min-h-11 cursor-pointer items-center justify-between gap-2 px-3 text-sm font-semibold">
        <span>{{ label() }}</span><span class="inline-flex items-center gap-1 text-xs text-primary">{{ selected().length ? selected().length + ' selected' : 'All Books' }} <app-ui-icon name="chevron-down" /></span>
      </summary>
      <div class="space-y-2 border-t border-outline-variant p-2">
        <p class="text-xs text-on-surface-variant">Applies only here and in subviews. No selection includes all books.</p>
        <label class="block"><span class="sr-only">Search source books</span><input type="search" placeholder="Search source books…" [value]="query()" (input)="query.set($any($event.target).value)" class="min-h-11 w-full min-w-0 rounded-lg border border-outline-variant bg-surface-container px-2 text-base sm:text-sm" /></label>
        <div class="flex flex-wrap gap-2">
          <button type="button" class="compendium-button" (click)="selectedChange.emit([])">All Books</button>
          <button type="button" class="compendium-button" (click)="useDefaults()">Use Defaults</button>
        </div>
        <div class="max-h-52 overflow-y-auto" role="group" [attr.aria-label]="label()">
          @for (book of visibleBooks(); track book) {
            <label class="flex min-h-11 cursor-pointer items-center gap-2 rounded px-2 text-sm hover:bg-surface-container-high">
              <input type="checkbox" class="h-4 w-4 shrink-0 accent-[var(--md-sys-color-primary)]" [checked]="selected().includes(book)" (change)="toggle(book)" />
              <span class="[overflow-wrap:anywhere]">{{ book }}</span>
            </label>
          } @empty { <p class="px-2 py-3 text-sm text-on-surface-variant">No matching source books.</p> }
        </div>
      </div>
    </details>
  `,
  styleUrl: './compendium.component.css',
})
export class CompendiumSourceFilterComponent {
  readonly books = input.required<readonly string[]>();
  readonly selected = input.required<readonly string[]>();
  readonly defaults = input.required<readonly string[]>();
  readonly label = input('Source Books');
  readonly selectedChange = output<string[]>();
  readonly query = signal('');
  readonly visibleBooks = computed(() => [...new Set(this.books())]
    .sort().filter(book => book.toLowerCase().includes(this.query().trim().toLowerCase())));
  useDefaults() { this.selectedChange.emit([...this.defaults()]); }
  toggle(book: string) {
    this.selectedChange.emit(this.selected().includes(book) ? this.selected().filter(value => value !== book) : [...this.selected(), book]);
  }
}
