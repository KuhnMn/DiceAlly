import { itemTypeUid } from '../content/item.model';
import { EditorCombatIndex } from './editor-combat-index';
import { rankSearchResults } from '../search-ranking';
import { EditorEntryRowComponent } from './editor-entry-row.component';
import { ListControlsComponent } from '../list-controls.component';
import { DescriptionDialogComponent } from './description-dialog.component';
import { CombatBookmarkComponent } from './combat-bookmark.component';
import { ChangeDetectorRef, Component, DoCheck, OnInit, OnDestroy, inject, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ExportedCharacter, InventoryItem, Entry } from '../models/character.model';
import { EntryAnnotationsComponent } from './entry-annotations.component';
import { RemoveEntryDialogComponent } from './remove-entry-dialog.component';
import { EntryRendererComponent } from '../entries/entry-renderer.component';
import { UiIconComponent } from '../ui-icon.component';
import { ItemCatalogComponent } from './item-catalog.component';
import { setCustomItemDescription } from './item-selection';
import { IndexedDbContentCache } from '../content/content-cache';
import { activeContentRevision } from './active-content-revision';
import { ContentRecord } from '../content/content.model';
import { SourceBookFilterService } from './source-book-filter.service';

@Component({
  providers: [EditorCombatIndex],
  selector: 'app-editor-items',
  imports: [EditorEntryRowComponent, ListControlsComponent, DescriptionDialogComponent, CombatBookmarkComponent, FormsModule, EntryAnnotationsComponent, RemoveEntryDialogComponent, EntryRendererComponent, UiIconComponent, ItemCatalogComponent],
  templateUrl: './items-editor.component.html', styleUrls: ['./editor.css', './editor-feature-fields.css'],
})
export class ItemsEditorComponent implements DoCheck, OnInit, OnDestroy {
  itemTypes: ContentRecord[] = [];
  readonly books = inject(SourceBookFilterService);
  get filteredItemTypes() { return this.itemTypes.filter(type => this.books.allows(type.publication)); }
  typesMessage = '';
  readonly invalidValues = new Set<InventoryItem>();
  private disposed = false;
  async ngOnInit() {
    try {
      const cache = new IndexedDbContentCache();
      const revision = await activeContentRevision(cache);
      const types = revision ? await cache.category(revision.id, 'itemType', 0) : [];
      if (this.disposed) return;
      this.itemTypes = types.sort((a, b) => a.name.localeCompare(b.name) || a.publication.localeCompare(b.publication));
      if (!types.length) this.typesMessage = 'Import an item library to choose from its item types.';
    } catch { if (!this.disposed) this.typesMessage = 'Item types could not be loaded. Existing types are preserved.'; }
    if (!this.disposed) this.view.markForCheck();
  }
  ngOnDestroy() { this.disposed = true; }
  typeValue(type: ContentRecord) { return itemTypeUid(type); }
  hasType(item: InventoryItem) { return this.filteredItemTypes.some(type => this.typeValue(type) === item.entity?.item.type); }
  setType(item: InventoryItem, value: string) {
    const type = this.filteredItemTypes.find(type => this.typeValue(type) === value);
    if (!item.isDummy || (value && !type)) return;
    item.entity ??= { item: { name: item.name, source: item.source || 'Custom' } };
    if (type) { item.entity.item.type = this.typeValue(type); item.entity.itemType = type.name; }
    else { delete item.entity.item.type; delete item.entity.itemType; }
    this.change();
  }
  setValue(item: InventoryItem, value: number | null) {
    if (!item.isDummy) return;
    if (value != null && (!Number.isSafeInteger(value) || value < 0)) {
      this.invalidValues.add(item); return;
    }
    this.invalidValues.delete(item);
    item.entity ??= { item: { name: item.name, source: item.source || 'Custom' } };
    if (value == null) delete item.entity.item.value;
    else item.entity.item.value = value;
    this.change();
  }
  ngDoCheck() { this.combatIndex.clear(); }
  private readonly combatIndex = inject(EditorCombatIndex);
  readonly sheet = input.required<ExportedCharacter>();
  readonly edited = output<void>();
  private readonly view = inject(ChangeDetectorRef);
  readonly expanded = new Set<InventoryItem>();
  catalogOpen = false;
  listVisible = true;
  listSearch = '';
  pendingRemoval?: InventoryItem;
  get items() { return this.sheet().inventory ?? []; }
  get filteredItems() { return rankSearchResults(this.items.filter(item => item.name.toLowerCase().includes(this.listSearch.trim().toLowerCase())), this.listSearch, item => item.name); }
  change() { this.combatIndex.clear(); this.view.markForCheck(); this.edited.emit(); }
  toggle(item: InventoryItem) { this.expanded.has(item) ? this.expanded.delete(item) : this.expanded.add(item); }
  openCatalog() { this.catalogOpen = true; }
  entries(item: InventoryItem): Entry[] { return item.entity?.item.entries ?? item.entity?.baseItem?.entries ?? []; }
  descriptionEntries(item: InventoryItem): Entry[] {
    const rules = [...item.entity?.properties ?? [], ...item.entity?.masteries ?? []].flatMap(rule =>
      rule.entry ? [{ type: 'entries' as const, name: rule.name, entries: [rule.entry] }] : []);
    return [...this.entries(item), ...rules];
  }
  description(item: InventoryItem): string {
    const entries: unknown[] = this.entries(item);
    return entries.map(entry => typeof entry === 'string' ? entry
      : entry && typeof entry === 'object' && 'text' in entry && typeof entry.text === 'string' ? entry.text : '').join('\n\n');
  }
  setDescription(item: InventoryItem, text: string) {
    setCustomItemDescription(item, text);
    this.change();
  }
  setCount(item: InventoryItem, value: number) { item.count = Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0; this.change(); }
  setStackable(item: InventoryItem, enabled: boolean) {
    item.allowMultiples = enabled;
    if (enabled) item.count ??= 1;
    this.change();
  }
  remove(item: InventoryItem) {
    if (item.uses?.length || item.notes?.length) this.pendingRemoval = item;
    else this.deleteItem(item);
  }
  confirmRemoval() { const item = this.pendingRemoval; this.pendingRemoval = undefined; if (item) this.deleteItem(item); }
  private deleteItem(item: InventoryItem) {
    const index = this.items.indexOf(item); if (index < 0) return;
    this.sheet().inventory!.splice(index, 1); this.expanded.delete(item); this.change();
  }
}
