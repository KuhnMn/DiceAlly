import { ChangeDetectorRef, Component, OnInit, OnDestroy, effect, inject, input, output, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { IndexedDbContentCache } from '../content/content-cache';
import type { ContentRecord } from '../content/content.model';
import type { ExportedCharacter } from '../models/character.model';
import { FacilityEntry, facilityTypeLabel } from '../models/bastion';
import { compareSearchMatches } from '../search-ranking';
import { ListControlsComponent } from '../list-controls.component';
import { UiIconComponent } from '../ui-icon.component';
import { BastionPlanComponent } from '../sheet/bastion-plan.component';
import { FacilityDetailsComponent } from '../sheet/facility-details.component';
import { EditorListHeaderComponent } from './editor-list-header.component';
import { EditorEntryRowComponent } from './editor-entry-row.component';
import { EntryAnnotationsComponent } from './entry-annotations.component';
import { DescriptionDialogComponent } from './description-dialog.component';
import { CatalogDialogComponent } from './catalog-dialog.component';
import { CatalogResultRowComponent } from './catalog-result-row.component';
import { RemoveEntryDialogComponent } from './remove-entry-dialog.component';
import { SourceBookFilterComponent } from './source-book-filter.component';
import { SourceBookFilterService } from './source-book-filter.service';
import { EditorCatalog, CatalogQuery } from './editor-catalog';
import { createFacilityEntry, facilitySnapshot } from './facility-selection';
import { newEditorId } from './editor-identity';

@Component({
  selector: 'app-editor-bastions',
  imports: [FormsModule, RouterLink, ListControlsComponent, UiIconComponent, BastionPlanComponent, FacilityDetailsComponent,
    EditorListHeaderComponent, EditorEntryRowComponent, EntryAnnotationsComponent, DescriptionDialogComponent,
    CatalogDialogComponent, CatalogResultRowComponent, RemoveEntryDialogComponent, SourceBookFilterComponent],
  templateUrl: './bastions-editor.component.html',
  styleUrls: ['./editor.css', './editor-feature-fields.css'],
  host: { class: 'block min-w-0' },
})
export class BastionsEditorComponent implements OnInit, OnDestroy {
  readonly sheet = input.required<ExportedCharacter>();
  readonly edited = output<void>();
  private readonly cache = new IndexedDbContentCache();
  private readonly view = inject(ChangeDetectorRef);
  readonly catalog = new EditorCatalog(this.cache);
  private readonly previews = new WeakMap<ContentRecord, FacilityEntry>();
  readonly sourceBooks = inject(SourceBookFilterService);
  readonly typeLabel = facilityTypeLabel;
  listVisible = true;
  listSearch = '';
  catalogOpen = false;
  catalogAdded = 0;
  search = '';
  type = 'ALL';
  level = '';
  catalogLevels: number[] = [];
  customName = '';
  customDescription = '';
  customType = 'basic';
  customLevel: number | null = null;
  readonly expanded = new Set<FacilityEntry>();
  pendingRemoval?: FacilityEntry;

  constructor() {
    let initial = true;
    effect(() => {
      this.sourceBooks.selected();
      if (initial) { initial = false; return; }
      untracked(() => { void this.refreshContent(); });
    });
  }
  get facilities() { return this.sheet().bastion?.facilities ?? []; }
  get selected() {
    return this.facilities.filter(entry => entry.name.toLowerCase().includes(this.listSearch.trim().toLowerCase()))
      .sort((a, b) => compareSearchMatches(a.name, b.name, this.listSearch));
  }
  ngOnInit() { void this.refreshContent(); }
  ngOnDestroy() { this.catalog.dispose(); }
  change() { this.view.markForCheck(); this.edited.emit(); }
  setPlan(value: string) { (this.sheet().bastion ??= {}).planUrl = value.trim(); this.change(); }
  toggle(entry: FacilityEntry) { this.expanded.has(entry) ? this.expanded.delete(entry) : this.expanded.add(entry); }
  openCatalog() { this.catalogAdded = 0; this.catalogOpen = true; }
  refreshContent() {
    const books = this.sourceBooks.selected();
    return this.catalog.refresh('Import content to browse facilities. Your existing facilities and notes remain editable.', () => this.catalogQuery(), async (revision, isCurrent) => {
      const levels = new Set<number>();
      await this.cache.searchCategory(revision.id, ['facility'], '', 0, 0, record => {
        const level = record.referenceDefinition?.kind === 'facility' ? record.referenceDefinition.level : record.data['level'];
        if (this.sourceBooks.allows(record.publication, books) && typeof level === 'number') levels.add(level);
        return false;
      });
      if (isCurrent()) { this.catalogLevels = [...levels].sort((a, b) => a - b); if (this.level && !levels.has(Number(this.level))) this.level = ''; }
    });
  }
  private catalogQuery(): CatalogQuery {
    const books = this.sourceBooks.selected(), type = this.type, level = this.level;
    return { kinds: ['facility'], search: this.search, includes: record => {
      const data = record.referenceDefinition?.kind === 'facility' ? record.referenceDefinition : record.data;
      return this.sourceBooks.allows(record.publication, books) && (type === 'ALL' || data['facilityType'] === type)
        && (!level || data['level'] === Number(level));
    } };
  }
  searchChanged() { this.catalog.scheduleSearch(() => this.catalogQuery()); }
  clearFilters() { this.type = 'ALL'; this.level = ''; this.searchChanged(); }
  nextPage(direction: number) { void this.catalog.nextPage(direction, this.catalogQuery()); }
  catalogEntry(record: ContentRecord): FacilityEntry {
    let entry = this.previews.get(record);
    if (!entry) {
      entry = { editorId: record.key, name: record.name, source: record.publication, entity: facilitySnapshot(record) };
      this.previews.set(record, entry);
    }
    return entry;
  }
  hasExisting(record: ContentRecord) { return this.facilities.some(entry => entry.contentReference?.key === record.key); }
  add(record: ContentRecord) {
    const revision = this.catalog.revision();
    if (!revision || record.kind !== 'facility') return;
    ((this.sheet().bastion ??= {}).facilities ??= []).push(createFacilityEntry(record, revision));
    this.catalogAdded++; this.change();
  }
  addCustom() {
    const name = this.customName.trim(); if (!name) return;
    const level = this.customLevel;
    if (level != null && (!Number.isInteger(level) || level < 0)) return;
    const entry: FacilityEntry = { editorId: newEditorId(), name, source: 'Custom', userAdded: true,
      entity: { version: 1, name, source: 'Custom', facilityType: this.customType, ...(level != null ? { level } : {}),
        entries: this.customDescription.trim() ? [this.customDescription.trim()] : [] },
      notes: [] };
    ((this.sheet().bastion ??= {}).facilities ??= []).push(entry);
    this.expanded.add(entry); this.catalogAdded++; this.customName = ''; this.customDescription = ''; this.customLevel = null; this.change();
  }
  remove(entry: FacilityEntry) {
    if (entry.notes?.some(group => group.notes.length)) { this.pendingRemoval = entry; return; }
    this.deleteEntry(entry);
  }
  confirmRemoval() { if (this.pendingRemoval) this.deleteEntry(this.pendingRemoval); this.pendingRemoval = undefined; }
  private deleteEntry(entry: FacilityEntry) {
    const index = this.facilities.indexOf(entry); if (index < 0) return;
    this.sheet().bastion!.facilities!.splice(index, 1); this.expanded.delete(entry); this.change();
  }
}
