import { contentEntries } from '../content/content-entries';
import { characterOptionSourceData } from '../content/character-option-adapter';
import { ChangeDetectorRef, Component, OnDestroy, effect, inject, input, output, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ExportedCharacter } from '../models/character.model';
import { ContentRecord } from '../content/content.model';
import { IndexedDbContentCache } from '../content/content-cache';
import { UiIconComponent } from '../ui-icon.component';
import { BackgroundDetailsComponent } from '../background-details.component';
import { EntryRendererComponent } from '../entries/entry-renderer.component';
import { ListControlsComponent } from '../list-controls.component';
import { CatalogDialogComponent } from './catalog-dialog.component';
import { CatalogResultRowComponent } from './catalog-result-row.component';
import { DescriptionDialogComponent } from './description-dialog.component';
import { EditorCatalog } from './editor-catalog';
import { SourceBookFilterComponent } from './source-book-filter.component';
import { SourceBookFilterService } from './source-book-filter.service';
import { contentReference } from './editor-content-helpers';
import { characterDescription } from '../character-description';

@Component({
  selector: 'app-editor-background',
  imports: [FormsModule, RouterLink, UiIconComponent, BackgroundDetailsComponent, EntryRendererComponent, ListControlsComponent, CatalogDialogComponent, CatalogResultRowComponent, DescriptionDialogComponent, SourceBookFilterComponent],
  styleUrl: './editor.css',
  template: `
    <span class="field-label">Background (optional)</span>
    <div class="flex min-w-0 items-center gap-2">
      <input class="editor-input min-w-0 flex-1" name="background-name" aria-label="Background name" [ngModel]="sheet().background?.name ?? ''" (ngModelChange)="setCustom($event)" placeholder="Custom name, or choose from library" />
      <button type="button" class="secondary-button compact-button icon-button shrink-0" title="Choose background from library" aria-label="Choose background from library" aria-haspopup="dialog" (click)="openCatalog()"><app-ui-icon name="book" /></button>
      @if (sheet().background) { <button type="button" class="secondary-button compact-button icon-button shrink-0" title="Clear background" aria-label="Clear background" (click)="setCustom('')"><app-ui-icon name="close" /></button> }
    </div>
    @if (sheet().background?.entity) {
      <div class="mt-1 flex items-center gap-2 text-xs"><app-background-details [background]="sheet().background" label="Details" /><span class="rounded bg-surface-container-highest px-1">{{ sheet().background?.source }}</span></div>
    }
    <p class="mt-2 text-xs text-on-surface-variant" aria-label="Generated character description">{{ summary }}</p>
    @if (catalogOpen) {
      <app-catalog-dialog title="Choose Background" subtitle="Choose a library background, or close and enter any custom name. Background is optional." (closed)="catalogOpen = false">
        <app-source-book-filter />
        <app-list-controls label="Search backgrounds" searchName="background-search" [query]="search" (queryChange)="search = $event; searchChanged()" [hasFilters]="false" (cleared)="search = ''; searchChanged()" />
        @if (catalog.message()) { <p class="text-sm mb-3">{{ catalog.message() }} <a routerLink="/content" class="text-primary underline">Manage Game Data</a></p> }
        @if (catalog.revision() && catalog.revision()!.adapterVersion < 8) { <p class="text-xs mb-3">Refresh Game Data to include backgrounds from the original source.</p> }
        @if (catalog.loading()) { <p role="status" class="text-xs">Loading backgrounds…</p> }
        <div class="overflow-hidden rounded-lg bg-surface-container">
          @for (record of catalog.results(); track record.key) {
            <app-catalog-result-row [name]="record.name" [selection]="true" [selected]="sheet().background?.contentReference?.key === record.key && sheet().background?.contentReference?.revisionId === catalog.revision()?.id" [disabled]="catalog.loading()" (addRequested)="select(record)">
              <span catalog-metadata class="min-w-0 truncate rounded bg-surface-container-highest px-1">{{ record.publication }}</span>
              <app-description-dialog catalog-description class="shrink-0 self-stretch" [title]="record.name" [compact]="true"><app-entry-renderer [entries]="catalogEntries(record)" /></app-description-dialog>
            </app-catalog-result-row>
          } @empty { @if (!catalog.loading()) { <p class="p-2 text-sm text-on-surface-variant">No backgrounds match. You can always enter a custom name instead.</p> } }
        </div>
        @if (catalog.revision()) { <div class="mt-3 flex items-center justify-between gap-2 text-xs"><span>{{ catalog.total() }} matches</span><div class="flex gap-2"><button type="button" class="secondary-button compact-button" [disabled]="catalog.loading() || !catalog.offset" (click)="catalog.nextPage(-1, query())">Previous</button><button type="button" class="secondary-button compact-button" [disabled]="catalog.loading() || catalog.offset + catalog.pageSize >= catalog.total()" (click)="catalog.nextPage(1, query())">Next</button></div></div> }
      </app-catalog-dialog>
    }
  `,
})
export class BackgroundEditorComponent implements OnDestroy {
  readonly catalogEntries = contentEntries;
  readonly sheet = input.required<ExportedCharacter>();
  readonly edited = output<void>();
  readonly catalog = new EditorCatalog(new IndexedDbContentCache());
  readonly books = inject(SourceBookFilterService);
  private readonly view = inject(ChangeDetectorRef);
  search = '';
  catalogOpen = false;
  get summary() { return characterDescription(this.sheet(), true); }
  constructor() {
    effect(() => { this.books.selected(); untracked(() => { if (this.catalogOpen) this.searchChanged(); }); });
  }
  query() {
    const books = this.books.selected();
    return { kinds: ['background'], search: this.search, includes: (record: ContentRecord) => this.books.allows(record.publication, books) };
  }
  async openCatalog() {
    this.catalogOpen = true;
    this.view.markForCheck();
    await this.catalog.refresh('Import or refresh Game Data to browse backgrounds. Custom names work without an import.', () => this.query());
  }
  searchChanged() { this.catalog.scheduleSearch(() => this.query()); }
  setCustom(name: string) {
    if (name === this.sheet().background?.name) return;
    if (name.trim()) this.sheet().background = { name };
    else delete this.sheet().background;
    this.view.markForCheck(); this.edited.emit();
  }
  select(record: ContentRecord) {
    const revision = this.catalog.revision(); if (!revision || record.kind !== 'background') return;
    this.sheet().background = { name: record.name, source: record.publication, contentReference: contentReference(record, revision), entity: characterOptionSourceData(record) };
    this.catalogOpen = false; this.view.markForCheck(); this.edited.emit();
  }
  ngOnDestroy() { this.catalog.dispose(); }
}
