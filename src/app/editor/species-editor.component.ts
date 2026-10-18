import { DescriptionDialogComponent } from './description-dialog.component';
import { CombatBookmarkComponent } from './combat-bookmark.component';
import { UiIconComponent } from '../ui-icon.component';
import { newEditorId } from './editor-identity';
import { ChangeDetectorRef, Component, OnDestroy, effect, inject, input, output, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { IndexedDbContentCache } from '../content/content-cache';
import { ContentRecord } from '../content/content.model';
import { ExportedCharacter, Species } from '../models/character.model';
import { EntryRendererComponent } from '../entries/entry-renderer.component';
import { EntryAnnotationsComponent } from './entry-annotations.component';
import { CatalogDialogComponent } from './catalog-dialog.component';
import { SourceBookFilterComponent } from './source-book-filter.component';
import { SourceBookFilterService } from './source-book-filter.service';
import { contentReference, speciesSnapshot } from './editor-content-helpers';
import { RemoveEntryDialogComponent } from './remove-entry-dialog.component';
import { CatalogQuery, EditorCatalog } from './editor-catalog';

@Component({
  selector: 'app-editor-species',
  imports: [DescriptionDialogComponent, CombatBookmarkComponent, UiIconComponent, FormsModule, RouterLink, EntryRendererComponent, EntryAnnotationsComponent, CatalogDialogComponent, SourceBookFilterComponent, RemoveEntryDialogComponent],
  templateUrl: './species-editor.component.html',
  styleUrl: './editor.css',
})
export class SpeciesEditorComponent implements OnDestroy {
  readonly sheet = input.required<ExportedCharacter>();
  readonly edited = output<void>();
  private readonly cache = new IndexedDbContentCache();
  private readonly catalog = new EditorCatalog(this.cache);
  readonly results = this.catalog.results;
  readonly revision = this.catalog.revision;
  readonly total = this.catalog.total;
  readonly loading = this.catalog.loading;
  readonly message = this.catalog.message;
  readonly pageSize = this.catalog.pageSize;
  get offset() { return this.catalog.offset; }
  set offset(value: number) { this.catalog.offset = value; }
  private readonly books = inject(SourceBookFilterService);
  private readonly view = inject(ChangeDetectorRef);
  catalogOpen = false;
  expanded = false;
  search = '';
  customName = '';
  customDescription = '';
  pendingChange?: { name: string; action: string; apply: () => void };
  constructor() {
    effect(() => {
      this.books.selected();
      untracked(() => { if (this.catalogOpen) this.searchChanged(); });
    });
  }
  get selected() { return this.sheet().species; }
  change() { this.view.markForCheck(); this.edited.emit(); }
  async openCatalog() { this.catalogOpen = true; if (!this.revision()) await this.refreshContent(); }
  ngOnDestroy() { this.catalog.dispose(); }
  refreshContent() {
    return this.catalog.refresh(
      'Import content to browse species, or create a custom species below.',
      () => this.catalogQuery(),
    );
  }
  searchChanged() { this.catalog.scheduleSearch(() => this.catalogQuery()); }
  searchContent() { return this.catalog.search(this.catalogQuery()); }
  nextPage(direction: number) { void this.catalog.nextPage(direction, this.catalogQuery()); }
  private catalogQuery(): CatalogQuery {
    const books = this.books.selected();
    return {
      kinds: ['species'],
      search: this.search,
      includes: record => this.books.allows(record.publication, books),
    };
  }
  isSelected(record: ContentRecord) {
    return this.selected?.contentReference
      ? this.selected.contentReference.key === record.key && this.selected.contentReference.revisionId === this.revision()?.id
      : this.selected?.name === record.name && this.selected?.source === record.publication;
  }
  select(record: ContentRecord) {
    const revision = this.revision(); if (!revision || record.kind !== 'species') return;
    this.replace({ editorId: newEditorId(), name: record.name, source: record.publication, userAdded: true,
      contentReference: contentReference(record, revision), entity: speciesSnapshot(record) }, record.key);
  }
  private replace(next: Species, key?: string, confirmed = false) {
    const previous = this.selected;
    const same = previous?.name === next.name && previous?.source === next.source;
    if (!confirmed && !same && previous && (previous.notes?.length || previous.uses?.length)) {
      this.pendingChange = { name: previous.name ?? 'Species', action: 'Replace', apply: () => this.replace(next, key, true) };
      this.view.markForCheck(); return;
    }
    next.notes = same ? structuredClone(previous?.notes ?? []) : [];
    next.uses = same ? structuredClone(previous?.uses ?? []) : [];
    if (same && previous?.editorId) next.editorId = previous.editorId;
    this.sheet().species = next;
    if (this.sheet().creatorWizard) this.sheet().creatorWizard!.speciesKey = key;
    this.catalogOpen = false; this.expanded = true; this.change();
  }
  addCustom() {
    const name = this.customName.trim(); if (!name) return;
    this.replace({ editorId: newEditorId(), name, source: 'Custom', userAdded: true,
      entity: { name, source: 'Custom', entries: this.customDescription ? [{ text: this.customDescription }] : [] } });
    if (!this.catalogOpen) { this.customName = ''; this.customDescription = ''; }
  }
  confirmChange() {
    const change = this.pendingChange; this.pendingChange = undefined;
    change?.apply();
  }
  remove(confirmed = false) {
    const selected = this.selected; if (!selected) return;
    if (!confirmed && (selected.notes?.length || selected.uses?.length)) {
      this.pendingChange = { name: selected.name ?? 'Species', action: 'Remove', apply: () => this.remove(true) };
      this.view.markForCheck(); return;
    }
    this.sheet().species = undefined;
    if (this.sheet().creatorWizard) this.sheet().creatorWizard!.speciesKey = undefined;
    this.expanded = false; this.change();
  }
}
