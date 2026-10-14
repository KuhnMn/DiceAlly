import { ChangeDetectorRef, Component, OnDestroy, OnInit, effect, inject, input, output, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { IndexedDbContentCache } from '../content/content-cache';
import { ContentRecord, JsonObject, entityKey } from '../content/content.model';
import { ExportedCharacter, FeatureEntryFull } from '../models/character.model';
import { FeatureSourcePickerComponent } from './feature-source-picker.component';
import { EntryRendererComponent } from '../entries/entry-renderer.component';
import { EntryAnnotationsComponent } from './entry-annotations.component';
import { SourceBookFilterService } from './source-book-filter.service';
import { SourceBookFilterComponent } from './source-book-filter.component';
import { CatalogDialogComponent } from './catalog-dialog.component';
import { RemoveEntryDialogComponent } from './remove-entry-dialog.component';
import { CatalogQuery, EditorCatalog } from './editor-catalog';
import { FEATURE_TYPES, FeatureType, createFeatureEntry, featureEntries, featureTypeOf } from './feature-selection';

@Component({
  selector: 'app-editor-features', imports: [FormsModule, RouterLink, EntryRendererComponent, EntryAnnotationsComponent, CatalogDialogComponent, SourceBookFilterComponent, RemoveEntryDialogComponent, FeatureSourcePickerComponent],
  templateUrl: './features-editor.component.html', styleUrl: './local-editor.component.css',
})
export class FeaturesEditorComponent implements OnInit, OnDestroy {
  readonly sheet = input.required<ExportedCharacter>();
  readonly edited = output<void>();
  readonly openSources = output<void>();
  readonly types = FEATURE_TYPES;
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
  private readonly sourceBooks = inject(SourceBookFilterService);
  private readonly view = inject(ChangeDetectorRef);
  selectedType: FeatureType = 'CLASS_FEATURE';
  selectedSource: string | undefined;
  sourceFilter = 'ALL';
  search = '';
  customName = '';
  customDescription = '';
  catalogOpen = false;
  catalogAdded = 0;
  readonly expanded = new Set<FeatureEntryFull>();
  pendingRemoval?: FeatureEntryFull;

  constructor() {
    let initial = true;
    effect(() => {
      this.sourceBooks.selected();
      if (initial) { initial = false; return; }
      untracked(() => this.searchChanged());
    });
  }

  get sources() { return (this.sheet().character?.featureSources ?? []).filter(source => source.isGeneralFeatureSource && source.name); }
  get targetSource() { return this.selectedSource === undefined ? this.sources[0]?.name : this.selectedSource || undefined; }
  get unassignedFeatures() { return (this.sheet().features ?? []).some(feature => !feature.featureSourceName); }
  get selected() {
    return (this.sheet().features ?? []).filter(feature => featureTypeOf(feature) === this.selectedType
      && (this.sourceFilter === 'ALL' || (feature.featureSourceName ?? '') === this.sourceFilter));
  }
  readonly entries = featureEntries;
  qualifier(record: ContentRecord): string {
    return [record.data['className'], record.data['subclassShortName'], record.data['level'] != null ? `Level ${record.data['level']}` : '', record.publication].filter(Boolean).join(' · ');
  }
  change() { this.view.markForCheck(); this.edited.emit(); }
  openCatalog() {
    if (this.sourceFilter !== 'ALL') this.selectedSource = this.sourceFilter;
    this.catalogAdded = 0; this.catalogOpen = true;
  }
  toggle(feature: FeatureEntryFull) { this.expanded.has(feature) ? this.expanded.delete(feature) : this.expanded.add(feature); }
  async ngOnInit() { await this.refreshContent(); }
  ngOnDestroy() { this.catalog.dispose(); }
  refreshContent() {
    return this.catalog.refresh(
      'Import content to browse features. Selected features, notes and uses remain editable.',
      () => this.catalogQuery(),
    );
  }
  setType(type: FeatureType) {
    this.selectedType = type;
    this.search = '';
    this.catalog.resetSearch();
    this.view.markForCheck();
    void this.searchContent();
  }
  searchChanged() { this.catalog.scheduleSearch(() => this.catalogQuery()); }
  searchContent() { return this.catalog.search(this.catalogQuery()); }
  nextPage(direction: number) { void this.catalog.nextPage(direction, this.catalogQuery()); }
  private catalogQuery(): CatalogQuery {
    const books = this.sourceBooks.selected();
    return {
      kinds: this.types.find(type => type.value === this.selectedType)!.kinds,
      search: this.search,
      includes: record => this.sourceBooks.allows(record.publication, books),
    };
  }
  isSelected(record: ContentRecord) {
    const source = this.targetSource;
    return (this.sheet().features ?? []).some(feature => {
      if (feature.featureSourceName !== source) return false;
      if (feature.contentReference) return feature.contentReference.key === record.key;
      const snapshot = record.kind === 'feat' ? feature.featEntity : record.kind === 'optionalfeature' ? feature.optionalFeatureEntity : feature.featureEntity;
      return !!snapshot && entityKey(record.kind, snapshot as unknown as JsonObject) === record.key;
    });
  }
  add(record: ContentRecord) {
    if (!this.types.find(type => type.value === this.selectedType)!.kinds.includes(record.kind)) return;
    const revision = this.revision(); if (!revision || this.isSelected(record)) return;
    const feature = createFeatureEntry(record, revision, { sourceName: this.targetSource });
    (this.sheet().features ??= []).push(feature); this.catalogAdded++; this.change();
  }
  addCustom() {
    const name = this.customName.trim(); if (!name) return;
    const data = { name, source: 'Custom', entries: this.customDescription ? [{ text: this.customDescription }] : [] };
    const feature: FeatureEntryFull = { editorId: crypto.randomUUID(), name, source: 'Custom', featureType: this.selectedType,
      featureSourceName: this.targetSource, userAdded: true, notes: [], uses: [] };
    if (this.selectedType === 'FEAT') feature.featEntity = data;
    else if (this.selectedType === 'OPTIONAL_FEATURE') feature.optionalFeatureEntity = { ...data, featureType: [] };
    else feature.featureEntity = { ...data, level: 0, className: '', classSource: '' };
    (this.sheet().features ??= []).push(feature); this.expanded.add(feature);
    this.catalogAdded++;
    this.customName = ''; this.customDescription = ''; this.change();
  }
  remove(feature: FeatureEntryFull) {
    if (feature.notes?.length || feature.uses?.length) { this.pendingRemoval = feature; this.view.markForCheck(); return; }
    this.deleteFeature(feature);
  }
  confirmRemoval() {
    const feature = this.pendingRemoval; this.pendingRemoval = undefined;
    if (feature) this.deleteFeature(feature);
  }
  private deleteFeature(feature: FeatureEntryFull) {
    const index = this.sheet().features?.indexOf(feature) ?? -1;
    if (index < 0) return;
    this.sheet().features!.splice(index, 1); this.expanded.delete(feature); this.change();
  }

}
