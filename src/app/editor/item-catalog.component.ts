import { DescriptionDialogComponent } from './description-dialog.component';
import { UiIconComponent } from '../ui-icon.component';
import { ChangeDetectorRef, Component, OnDestroy, OnInit, effect, inject, input, output, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Entry, ExportedCharacter, InventoryItem } from '../models/character.model';
import { ContentRecord } from '../content/content.model';
import { IndexedDbContentCache } from '../content/content-cache';
import { CatalogQuery, EditorCatalog } from './editor-catalog';
import { CatalogDialogComponent } from './catalog-dialog.component';
import { SourceBookFilterComponent } from './source-book-filter.component';
import { SourceBookFilterService } from './source-book-filter.service';
import { EntryRendererComponent } from '../entries/entry-renderer.component';
import { createInventoryEntry, setCustomItemDescription } from './item-selection';
import { newEditorId } from './editor-identity';

/** Shared acquisition dialog for play and creation. Annotation editing belongs only to the creator. */
@Component({
  selector: 'app-item-catalog',
  imports: [DescriptionDialogComponent, UiIconComponent, FormsModule, RouterLink, CatalogDialogComponent, SourceBookFilterComponent, EntryRendererComponent],
  templateUrl: './item-catalog.component.html', styleUrl: './local-editor.component.css',
})
export class ItemCatalogComponent implements OnInit, OnDestroy {
  readonly sheet = input.required<ExportedCharacter>();
  readonly edited = output<void>();
  readonly closed = output<void>();
  private readonly cache = new IndexedDbContentCache();
  readonly catalog = new EditorCatalog(this.cache);
  private readonly books = inject(SourceBookFilterService);
  private readonly view = inject(ChangeDetectorRef);
  search = '';
  customName = '';
  customDescription = '';
  stackable = false;
  quantity = 1;
  error = '';
  adding = false;
  catalogAdded = 0;
  private disposed = false;
  constructor() {
    let initial = true;
    effect(() => {
      this.books.selected();
      if (initial) { initial = false; return; }
      untracked(() => this.searchChanged());
    });
  }
  ngOnInit() { void this.refreshContent(); }
  ngOnDestroy() { this.disposed = true; this.catalog.dispose(); }
  private query(): CatalogQuery {
    const selection = this.books.selected();
    return { kinds: ['item'], search: this.search, includes: record => this.books.allows(record.publication, selection) };
  }
  refreshContent() { return this.catalog.refresh('Import game data to browse items. You can still add a custom item.', () => this.query()); }
  searchChanged() { this.catalog.scheduleSearch(() => this.query()); }
  nextPage(direction: number) { void this.catalog.nextPage(direction, this.query()); }
  catalogEntries(record: ContentRecord): Entry[] { return Array.isArray(record.data['entries']) ? record.data['entries'] as Entry[] : []; }
  private append(sheet: ExportedCharacter, item: InventoryItem) {
    item.allowMultiples = this.stackable;
    item.count = this.stackable && Number.isFinite(this.quantity) ? Math.max(0, Math.floor(this.quantity)) : 1;
    (sheet.inventory ??= []).push(item);
    this.catalogAdded++;
    this.view.markForCheck();
    this.edited.emit();
  }
  async add(record: ContentRecord) {
    const revision = this.catalog.revision(), sheet = this.sheet();
    if (!revision || this.adding) return;
    this.adding = true; this.error = '';
    try {
      const item = await createInventoryEntry(this.cache, record, revision);
      if (this.disposed || this.sheet() !== sheet) return;
      this.append(sheet, item);
    } catch (error) { this.error = String(error); }
    finally { this.adding = false; this.view.markForCheck(); }
  }
  addCustom() {
    const name = this.customName.trim(); if (!name || this.adding) return;
    const item: InventoryItem = { editorId: newEditorId(), name, source: 'Custom', isDummy: true, uses: [], notes: [] };
    setCustomItemDescription(item, this.customDescription);
    this.append(this.sheet(), item);
    this.customName = ''; this.customDescription = '';
  }
}
