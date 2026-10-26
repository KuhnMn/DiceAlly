import { Component, ElementRef, OnDestroy, effect, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IndexedDbContentCache } from '../content/content-cache';
import { ContentRecord, ImportRevision } from '../content/content.model';
import { UiIconComponent } from '../ui-icon.component';
import { kindLabel } from './compendium-catalog';
import { COMPENDIUM_SEARCH_KINDS, compendiumDestination } from './compendium-navigation';

/** Search all browseable kinds, keeping only one ranked page in memory. */
@Component({
  selector: 'app-compendium-search',
  imports: [RouterLink, UiIconComponent],
  host: { class: 'relative block min-w-0', '[class.mb-4]': '!compact()', '(document:pointerdown)': 'outside($event)', '(keydown.escape)': 'expanded.set(false); $event.stopPropagation()' },
  styles: [`
    .compact-results { position: absolute; top: 100%; right: 0; z-index: 50; width: min(30rem, calc(100vw - 3rem)); max-height: min(32rem, 65dvh); overflow-y: auto; box-shadow: 0 .5rem 1.5rem rgb(0 0 0 / .3); }
  `],
  template: `
    <section aria-label="Compendium-wide search" class="min-w-0">
      <div class="flex items-center gap-2">
        <label class="relative min-w-0 flex-1">
          <span class="sr-only">Search Entire Compendium</span>
          <app-ui-icon name="search" class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant" />
          <input type="search" [value]="query()" (input)="setQuery($any($event.target).value)" (focus)="expanded.set(true)" [disabled]="!revision()" placeholder="Search Compendium" title="Search Compendium" class="w-full min-w-0 rounded-lg border border-outline-variant bg-surface-container pl-9 pr-2 text-base text-on-surface sm:text-sm" [class]="compact() ? 'min-h-9 py-1' : 'min-h-11 py-2'" />
        </label>
        @if (query()) { <button type="button" (click)="query.set('')" aria-label="Clear compendium-wide search" title="Clear Search" class="flex w-8 shrink-0 items-center justify-center rounded-lg text-on-surface-variant hover:bg-surface-container-high" [class]="compact() ? 'h-9' : 'h-11'"><app-ui-icon name="close" /></button> }
      </div>
      @if (query().trim() && (!compact() || expanded())) {
        <div class="mt-2 overflow-hidden rounded-xl border border-outline-variant bg-surface-container" [class.compact-results]="compact()" [attr.aria-busy]="loading()" aria-label="All Compendium search results">
          <p role="status" class="px-3 py-2 text-xs text-on-surface-variant">{{ loading() ? 'Searching the Compendium…' : total() + (total() === 1 ? ' match' : ' matches') }} · Current Source Books</p>
          @if (error()) { <p role="alert" class="px-3 pb-3 text-sm">{{ error() }} <button type="button" (click)="search()" class="text-primary underline">Retry</button></p> }
          @for (record of results(); track record.key) {
            @let destination = destinationFor(record);
            <a [routerLink]="destination.commands" [queryParams]="destination.queryParams" (click)="clearAfterOpen($event)" class="flex min-h-14 min-w-0 items-center gap-3 border-t border-outline-variant px-3 py-2 hover:bg-surface-container-high focus-visible:outline-2 focus-visible:outline-primary">
              <div class="min-w-0 flex-1"><h2 class="font-semibold [overflow-wrap:anywhere]">{{ record.name }}</h2><p class="mt-0.5 text-xs text-on-surface-variant">{{ kindLabel(record.kind) }} · {{ record.publication }}@if (record.classDefinition?.parent; as parent) { · {{ parent.name }} }</p></div><app-ui-icon name="right" class="shrink-0 text-primary" />
            </a>
          } @empty { @if (!loading() && !error()) { <p class="px-3 pb-3 text-sm text-on-surface-variant">No matching entries in the selected Source Books.</p> } }
          @if (total() > pageSize) {
            <nav aria-label="Compendium-wide search pages" class="flex items-center justify-between gap-2 border-t border-outline-variant px-3 py-2 text-sm">
              <button type="button" (click)="turnPage(-1)" [disabled]="loading() || offset === 0" class="min-h-11 rounded-lg px-2 text-primary disabled:opacity-40">Previous</button>
              <span class="text-xs text-on-surface-variant">{{ offset + 1 }}–{{ offset + results().length }} of {{ total() }}</span>
              <button type="button" (click)="turnPage(1)" [disabled]="loading() || offset + pageSize >= total()" class="min-h-11 rounded-lg px-2 text-primary disabled:opacity-40">Next</button>
            </nav>
          }
        </div>
      }
    </section>
  `,
})
export class CompendiumSearchComponent implements OnDestroy {
  readonly revision = input<ImportRevision | null>(null);
  readonly sources = input<readonly string[]>([]);
  readonly compact = input(false);
  readonly expanded = signal(false);
  readonly query = signal('');
  readonly results = signal<ContentRecord[]>([]);
  readonly total = signal(0);
  readonly loading = signal(false);
  readonly error = signal('');
  readonly kindLabel = kindLabel;
  readonly pageSize = 12;
  offset = 0;
  private readonly cache = new IndexedDbContentCache();
  private readonly element = inject<ElementRef<HTMLElement>>(ElementRef);
  private version = 0;
  private destroyed = false;
  private timer?: ReturnType<typeof setTimeout>;

  constructor() {
    effect(() => {
      this.revision(); this.sources(); const query = this.query().trim();
      clearTimeout(this.timer); ++this.version; this.offset = 0;
      this.results.set([]); this.total.set(0); this.error.set('');
      this.loading.set(!!query && !!this.revision());
      if (query && this.revision()) this.timer = setTimeout(() => void this.search(), 180);
    });
  }
  destinationFor(record: ContentRecord) { return compendiumDestination(record, this.sources()); }
  setQuery(value: string) { this.query.set(value); this.expanded.set(true); }
  outside(event: Event) {
    if (event.target instanceof Node && !this.element.nativeElement.contains(event.target)) this.expanded.set(false);
  }
  clearAfterOpen(event: MouseEvent) {
    if (event.button === 0 && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey) { this.query.set(''); this.expanded.set(false); }
  }
  async search() {
    clearTimeout(this.timer);
    const version = ++this.version, revision = this.revision(), query = this.query().trim(), sources = [...this.sources()];
    if (!revision || !query || this.destroyed) return;
    this.loading.set(true); this.error.set(''); this.results.set([]);
    try {
      const page = await this.cache.searchCategory(revision.id, COMPENDIUM_SEARCH_KINDS, query, this.offset, this.pageSize,
        record => !sources.length || sources.includes(record.publication));
      if (version !== this.version || this.destroyed) return;
      this.results.set(page.records); this.total.set(page.total);
    } catch { if (version === this.version && !this.destroyed) this.error.set('Could not search the content library.'); }
    finally { if (version === this.version && !this.destroyed) this.loading.set(false); }
  }
  async turnPage(direction: number) {
    this.offset = Math.max(0, this.offset + direction * this.pageSize);
    await this.search();
  }
  ngOnDestroy() { this.destroyed = true; ++this.version; clearTimeout(this.timer); }
}
