import { contentEntries } from '../content/content-entries';
import { characterOption, isCharacterOptionKind } from '../content/character-option-adapter';
import { PrerequisiteDetailsComponent } from '../sheet/prerequisite-details.component';
import { featureRecordMetadata, matchesFeatureRecord, featureRecordCategories, matchesFeatureRecordCategories } from './feature-selection';
import { EditorCombatIndex } from './editor-combat-index';
import { CatalogMembershipIndex } from './catalog-membership-index';
import { compareSearchMatches } from '../search-ranking';
import { EditorEntryRowComponent } from './editor-entry-row.component';
import { FeatureFiltersComponent } from '../feature-filters.component';
import { featureCategories, featureCategoryLabel, matchesFeatureCategories } from './feature-selection';
import { featureFilterData, featureFilterOptions, matchesFeatureFilters } from './feature-selection';
import { HorizontalRowDirective } from '../sheet/horizontal-row.directive';
import { CatalogResultRowComponent } from './catalog-result-row.component';
import { ListControlsComponent } from '../list-controls.component';
import { EditorListHeaderComponent } from './editor-list-header.component';
import { DescriptionDialogComponent } from './description-dialog.component';
import { CombatBookmarkComponent } from './combat-bookmark.component';
import { UiIconComponent } from '../ui-icon.component';
import { newEditorId } from './editor-identity';
import { ChangeDetectorRef, Component, DoCheck, OnDestroy, OnInit, effect, inject, input, output, signal, untracked } from '@angular/core';
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
import { FEATURE_TYPES, FeatureType, classFeatureKey, createFeatureEntry, featureEntries, featureTypeOf } from './feature-selection';

@Component({
  providers: [EditorCombatIndex],
  selector: 'app-editor-features', imports: [PrerequisiteDetailsComponent, EditorEntryRowComponent, FeatureFiltersComponent, HorizontalRowDirective, CatalogResultRowComponent, ListControlsComponent, EditorListHeaderComponent, DescriptionDialogComponent, CombatBookmarkComponent, UiIconComponent, FormsModule, RouterLink, EntryRendererComponent, EntryAnnotationsComponent, CatalogDialogComponent, SourceBookFilterComponent, RemoveEntryDialogComponent, FeatureSourcePickerComponent],
  templateUrl: './features-editor.component.html', styleUrl: './editor.css',
})
export class FeaturesEditorComponent implements OnInit, OnDestroy, DoCheck {
  readonly catalogEntries = contentEntries;
  private readonly combatIndex = inject(EditorCombatIndex);
  readonly sheet = input.required<ExportedCharacter>();
  private readonly membership = new CatalogMembershipIndex<FeatureEntryFull>();
  ngDoCheck() { this.combatIndex.clear(); this.membership.clear(); this.displayedCache = undefined; }
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
  readonly sourceBooks = inject(SourceBookFilterService);
  private readonly view = inject(ChangeDetectorRef);
  selectedType: FeatureType = 'CLASS_FEATURE';
  selectedSource: string | undefined;
  sourceFilter = 'ALL';
  search = '';
  catalogClasses: string[] = [];
  catalogLevels: number[] = [];
  displayedClasses: string[] = [];
  displayedLevels: number[] = [];
  catalogCategories: string[] = [];
  displayedCategories: string[] = [];
  readonly categoryLabel = featureCategoryLabel;
  readonly categories = featureCategories;
  readonly recordCategories = featureRecordCategories;
  readonly filterData = featureFilterData;
  readonly catalogOptions = signal<{ classes: string[]; levels: number[]; categories: string[] }>({ classes: [], levels: [], categories: [] });
  private displayedCache?: { type: FeatureType; options: ReturnType<typeof featureFilterOptions>; categories: string[] };
  private get displayedMetadata() {
    if (!this.displayedCache || this.displayedCache.type !== this.selectedType) {
      const data = (this.sheet().features ?? []).filter(feature => featureTypeOf(feature) === this.selectedType).map(featureFilterData);
      this.displayedCache = { type: this.selectedType, options: featureFilterOptions(data),
        categories: [...new Set(data.flatMap(value => featureCategories(value, this.selectedType)))].sort() };
    }
    return this.displayedCache;
  }
  get displayedOptions() { return this.displayedMetadata.options; }
  get displayedCategoryOptions() { return this.displayedMetadata.categories; }
  listSearch = '';
  customName = '';
  customDescription = '';
  catalogOpen = false;
  listVisible = true;
  catalogAdded = 0;
  readonly expanded = new Set<FeatureEntryFull>();
  pendingRemoval?: FeatureEntryFull;

  constructor() {
    let initial = true;
    effect(() => {
      this.sourceBooks.selected();
      if (initial) { initial = false; return; }
      untracked(() => { void this.refreshContent(); });
    });
  }

  get sources() { return (this.sheet().character?.featureSources ?? []).filter(source => source.isGeneralFeatureSource && source.name?.trim()); }
  get targetSource() {
    return this.selectedSource === undefined ? this.sources[0]?.name : this.sources.find(source => source.name === this.selectedSource)?.name;
  }
  get unassignedFeatures() { return (this.sheet().features ?? []).some(feature => !feature.featureSourceName); }
  get selected() {
    return (this.sheet().features ?? []).filter(feature => featureTypeOf(feature) === this.selectedType
      && (this.sourceFilter === 'ALL' || (feature.featureSourceName ?? '') === this.sourceFilter)
      && (this.selectedType === 'CLASS_FEATURE' ? matchesFeatureFilters(featureFilterData(feature), this.displayedClasses, this.displayedLevels) : matchesFeatureCategories(featureFilterData(feature), this.selectedType, this.displayedCategories))
      && feature.name.toLowerCase().includes(this.listSearch.trim().toLowerCase()))
      .sort((a, b) => compareSearchMatches(a.name, b.name, this.listSearch));
  }
  readonly entries = featureEntries;
  featurePrerequisites(feature: FeatureEntryFull) { return feature.featEntity?.prerequisite ?? feature.optionalFeatureEntity?.prerequisite; }
  catalogPrerequisites(record: ContentRecord) { return isCharacterOptionKind(record.kind) ? characterOption(record).prerequisites : undefined; }
  catalogMetadata(record: ContentRecord) { return featureRecordMetadata(record); }
  qualifier(record: ContentRecord): string {
    const metadata = featureRecordMetadata(record);
    return [...metadata.classes, metadata.subclass, ...metadata.levels.map(level => `Level ${level}`), record.publication].filter(Boolean).join(' ? ');
  }
  change() { this.membership.clear(); this.displayedCache = undefined; this.combatIndex.clear(); this.view.markForCheck(); this.edited.emit(); }
  openCatalog() {
    if (this.sourceFilter !== 'ALL') this.selectedSource = this.sourceFilter;
    this.catalogAdded = 0; this.catalogOpen = true;
  }
  toggle(feature: FeatureEntryFull) { this.expanded.has(feature) ? this.expanded.delete(feature) : this.expanded.add(feature); }
  async ngOnInit() { await this.refreshContent(); }
  ngOnDestroy() { this.catalog.dispose(); }
  private refreshTask?: Promise<void>;
  refreshContent() {
    const books = this.sourceBooks.selected(), kind = this.selectedType;
    this.catalogOptions.set({ classes: [], levels: [], categories: [] });
    return this.refreshTask = this.catalog.refresh(
      'Import content to browse features. Selected features, notes and uses remain editable.',
      () => this.catalogQuery(),
      async (revision, isCurrent) => {
        const classes = new Set<string>(), levels = new Set<number>(), categories = new Set<string>();
        await this.cache.searchCategory(revision.id, FEATURE_TYPES.find(type => type.value === kind)!.kinds, '', 0, 0, record => {
          if (!this.sourceBooks.allows(record.publication, books)) return false;
          if (kind === 'CLASS_FEATURE') {
            const values = featureRecordMetadata(record);
            values.classes.forEach(name => classes.add(name)); values.levels.forEach(level => levels.add(level));
          }
          if (kind !== 'CLASS_FEATURE') featureRecordCategories(record).forEach(type => categories.add(type));
          return false;
        });
        if (isCurrent()) {
          this.catalogOptions.set({ classes: [...classes].sort(), levels: [...levels].sort((a, b) => a - b), categories: [...categories].sort() });
          this.catalogClasses = this.catalogClasses.filter(name => classes.has(name)); this.catalogLevels = this.catalogLevels.filter(level => levels.has(level));
          this.catalogCategories = this.catalogCategories.filter(type => categories.has(type));
        }
      },
    );
  }
  setType(type: FeatureType) {
    this.selectedType = type;
    this.catalogClasses = []; this.catalogLevels = []; this.catalogCategories = [];
    this.displayedClasses = []; this.displayedLevels = []; this.displayedCategories = [];
    this.search = '';
    this.catalog.resetSearch();
    this.view.markForCheck();
    void this.refreshContent();
  }
  searchChanged() { this.catalog.scheduleSearch(() => this.catalogQuery()); }
  clearCatalogFilters() {
    this.search = ''; this.catalogClasses = []; this.catalogLevels = []; this.catalogCategories = []; this.searchChanged();
  }
  async searchContent() { await this.refreshTask; return this.catalog.search(this.catalogQuery()); }
  nextPage(direction: number) { void this.catalog.nextPage(direction, this.catalogQuery()); }
  private catalogQuery(): CatalogQuery {
    const books = this.sourceBooks.selected();
    const classes = [...this.catalogClasses], levels = [...this.catalogLevels];
    const kind = this.selectedType, categories = [...this.catalogCategories];
    return {
      kinds: this.types.find(type => type.value === this.selectedType)!.kinds,
      order: (a, b) => Math.min(...featureRecordMetadata(a).levels, Infinity) - Math.min(...featureRecordMetadata(b).levels, Infinity),
      search: this.search,
      includes: record => this.sourceBooks.allows(record.publication, books) && (kind === 'CLASS_FEATURE' ? matchesFeatureRecord(record, classes, levels) : matchesFeatureRecordCategories(record, categories)),
    };
  }
  isSelected(record: ContentRecord) {
    return ['classFeature', 'subclassFeature'].includes(record.kind) && this.hasExisting(record);
  }
  hasExisting(record: ContentRecord) {
    const source = this.targetSource;
    return this.membership.has(this.sheet().features ?? [], feature => {
      const source = feature.featureSourceName ?? '';
      if (feature.contentReference) return [JSON.stringify([source, feature.contentReference.key])];
      return [
        ['feat', feature.featEntity], ['optionalfeature', feature.optionalFeatureEntity],
        ['classFeature', feature.featureEntity], ['subclassFeature', feature.featureEntity],
      ].flatMap(([kind, snapshot]) => snapshot ? [JSON.stringify([source, entityKey(kind as string, snapshot as unknown as JsonObject)])] : []);
    }, JSON.stringify([source ?? '', record.key]));
  }
  add(record: ContentRecord) {
    if (!this.targetSource) return;
    if (!this.types.find(type => type.value === this.selectedType)!.kinds.includes(record.kind)) return;
    const revision = this.revision(); if (!revision || this.isSelected(record)) return;
    const feature = createFeatureEntry(record, revision, { sourceName: this.targetSource });
    (this.sheet().features ??= []).push(feature); this.catalogAdded++; this.change();
  }
  addCustom() {
    if (!this.targetSource) return;
    const name = this.customName.trim(); if (!name) return;
    const data = { name, source: 'Custom', entries: this.customDescription ? [{ text: this.customDescription }] : [] };
    const feature: FeatureEntryFull = { editorId: newEditorId(), name, source: 'Custom', featureType: this.selectedType,
      featureSourceName: this.targetSource, userAdded: true, notes: [], uses: [] };
    if (this.selectedType === 'FEAT') feature.featEntity = data;
    else if (this.selectedType === 'OPTIONAL_FEATURE') feature.optionalFeatureEntity = { ...data, featureType: [] };
    else feature.featureEntity = { ...data, level: 0, className: '', classSource: '' };
    if (this.selectedType === 'CLASS_FEATURE' && (this.sheet().features ?? []).some(other =>
      featureTypeOf(other) === 'CLASS_FEATURE' && (other.featureSourceName ?? '') === (feature.featureSourceName ?? '')
      && classFeatureKey(other) === classFeatureKey(feature))) return;
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
