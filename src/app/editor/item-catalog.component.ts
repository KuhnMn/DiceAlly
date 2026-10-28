import { contentEntries } from '../content/content-entries';
import { ItemVehicleDefinition, itemTypeUid } from '../content/item.model';
import { VehicleItemDetailsComponent } from '../sheet/vehicle-item-details.component';
import { vehicleItemStatistics } from '../sheet/vehicle-item-presentation';
import { CatalogMembershipIndex, catalogEntryKeys } from './catalog-membership-index';
import { ListControlsComponent } from '../list-controls.component';
import { CatalogResultRowComponent } from './catalog-result-row.component';
import { DescriptionDialogComponent } from './description-dialog.component';
import { UiIconComponent } from '../ui-icon.component';
import { ChangeDetectorRef, Component, DoCheck, OnDestroy, OnInit, effect, inject, input, output, untracked } from '@angular/core';
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
import { itemSourceData } from '../content/item-adapter';
import { itemRuleEntries } from '../content/item-resolver';

/** Shared acquisition dialog for play and creation. Annotation editing belongs only to the creator. */
@Component({
  selector: 'app-item-catalog',
  imports: [VehicleItemDetailsComponent, ListControlsComponent, CatalogResultRowComponent, DescriptionDialogComponent, UiIconComponent, FormsModule, RouterLink, CatalogDialogComponent, SourceBookFilterComponent, EntryRendererComponent],
  templateUrl: './item-catalog.component.html', styleUrl: './editor.css',
})
export class ItemCatalogComponent implements OnInit, OnDestroy, DoCheck {
  readonly sheet = input.required<ExportedCharacter>();
  private readonly membership = new CatalogMembershipIndex<InventoryItem>();
  ngDoCheck() { this.membership.clear(); }
  readonly edited = output<void>();
  readonly closed = output<void>();
  private readonly cache = new IndexedDbContentCache();
  readonly catalog = new EditorCatalog(this.cache);
  readonly books = inject(SourceBookFilterService);
  private readonly view = inject(ChangeDetectorRef);
  search = '';
  customName = '';
  customDescription = '';
  customValue: number | null = null;
  customType = '';
  itemTypes: ContentRecord[] = [];
  private itemProperties = new Map<string, ContentRecord>();
  get filteredItemTypes() { return this.itemTypes.filter(type => this.books.allows(type.publication)); }
  get customValueValid() {
    return this.customValue == null || (Number.isSafeInteger(this.customValue) && this.customValue >= 0);
  }
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
      if (this.customType && !this.filteredItemTypes.some(type => type.key === this.customType)) this.customType = '';
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
  refreshContent() {
    this.itemTypes = []; this.customType = '';
    this.itemProperties.clear();
    return this.catalog.refresh('Import game data to browse items. You can still add a custom item.', () => this.query(),
      async (revision, isCurrent) => {
        const [types, properties] = await Promise.all([
          this.cache.category(revision.id, 'itemType', 0), this.cache.category(revision.id, 'itemProperty', 0),
        ]);
        if (!isCurrent()) return;
        this.itemTypes = types.sort((a, b) => a.name.localeCompare(b.name) || a.publication.localeCompare(b.publication));
        this.itemProperties = new Map(properties.map(property => [property.key, property]));
        this.view.markForCheck();
      });
  }
  searchChanged() { this.catalog.scheduleSearch(() => this.query()); }
  nextPage(direction: number) { void this.catalog.nextPage(direction, this.query()); }
  hasExisting(record: ContentRecord) {
    const entries = this.sheet().inventory ?? [];
    return this.membership.has(entries, catalogEntryKeys, JSON.stringify(['key', record.key]))
      || this.membership.has(entries, catalogEntryKeys, JSON.stringify(['name', record.name, record.publication]));
  }
  catalogEntries(record: ContentRecord): Entry[] {
    const item = itemSourceData(record);
    const type = this.itemTypes.find(type => record.links.some(link => link.role === 'item-type' && link.target === type.key));
    const typeEntries = type ? itemRuleEntries(type, item) as Entry[] : [];
    const properties = record.links.filter(link => link.role === 'item-property').flatMap(link => {
      const definition = this.itemProperties.get(link.target);
      if (!definition) return [];
      const entries = itemRuleEntries(definition, item) as Entry[];
      return entries.length ? [{ type: 'entries' as const, name: definition.name, entries }] : [];
    });
    return [...contentEntries(record), ...typeEntries, ...properties];
  }
  vehicleItemData(record: ContentRecord): ItemVehicleDefinition { return itemSourceData(record) as ItemVehicleDefinition; }
  catalogSummary(record: ContentRecord): { label: string; value: string }[] {
    const item = itemSourceData(record);
    if (vehicleItemStatistics(item as ItemVehicleDefinition).length) return [];
    const rows: { label: string; value: string }[] = [];
    if (typeof item['value'] === 'number') rows.push({ label: 'Cost', value: `${(item['value'] / 100).toLocaleString('en-US')} gp` });
    if (typeof item['weight'] === 'number') rows.push({ label: 'Weight', value: `${item['weight'].toLocaleString('en-US')} lb.` });
    return rows;
  }
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
    const name = this.customName.trim(); if (!name || this.adding || !this.customValueValid) return;
    const type = this.filteredItemTypes.find(type => type.key === this.customType);
    if (this.customType && !type) return;
    const item: InventoryItem = { editorId: newEditorId(), name, source: 'Custom', isDummy: true, uses: [], notes: [] };
    setCustomItemDescription(item, this.customDescription);
    if (this.customValue != null) item.entity!.item.value = this.customValue;
    if (type) {
      item.entity!.itemType = type.name;
      item.entity!.item.type = itemTypeUid(type);
    }
    this.append(this.sheet(), item);
    this.customName = ''; this.customDescription = ''; this.customValue = null; this.customType = '';
  }
}
