import { DescriptionDialogComponent } from './description-dialog.component';
import { CombatBookmarkComponent } from './combat-bookmark.component';
import { ChangeDetectorRef, Component, inject, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ExportedCharacter, InventoryItem, Entry } from '../models/character.model';
import { EntryAnnotationsComponent } from './entry-annotations.component';
import { RemoveEntryDialogComponent } from './remove-entry-dialog.component';
import { EntryRendererComponent } from '../entries/entry-renderer.component';
import { UiIconComponent } from '../ui-icon.component';
import { ItemCatalogComponent } from './item-catalog.component';
import { setCustomItemDescription } from './item-selection';

@Component({
  selector: 'app-editor-items',
  imports: [DescriptionDialogComponent, CombatBookmarkComponent, FormsModule, EntryAnnotationsComponent, RemoveEntryDialogComponent, EntryRendererComponent, UiIconComponent, ItemCatalogComponent],
  templateUrl: './items-editor.component.html', styleUrl: './editor.css',
})
export class ItemsEditorComponent {
  readonly sheet = input.required<ExportedCharacter>();
  readonly edited = output<void>();
  private readonly view = inject(ChangeDetectorRef);
  readonly expanded = new Set<InventoryItem>();
  catalogOpen = false;
  listVisible = true;
  listSearch = '';
  pendingRemoval?: InventoryItem;
  get items() { return this.sheet().inventory ?? []; }
  get filteredItems() { return this.items.filter(item => item.name.toLowerCase().includes(this.listSearch.trim().toLowerCase())); }
  change() { this.view.markForCheck(); this.edited.emit(); }
  toggle(item: InventoryItem) { this.expanded.has(item) ? this.expanded.delete(item) : this.expanded.add(item); }
  openCatalog() { this.catalogOpen = true; }
  entries(item: InventoryItem): Entry[] { return item.entity?.item.entries ?? item.entity?.baseItem?.entries ?? []; }
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
