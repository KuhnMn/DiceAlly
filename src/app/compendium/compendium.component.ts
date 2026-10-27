import { ensureBrowseSummary, readBrowseSummary } from '../content/content-browse-summary';
import { ScrollToTopComponent } from '../scroll-to-top.component';
import { loadRelatedEntries } from './related-entries';
import { EntryHistory } from './entry-history';
import { ActiveFilterChipsComponent, ActiveFilterGroup } from './active-filter-chips.component';
import { sourceChipValues, sourceFilterCount } from './compendium-sources';
import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { map } from 'rxjs';
import { BreakpointObserver } from '@angular/cdk/layout';
import { toSignal } from '@angular/core/rxjs-interop';
import { IndexedDbContentCache } from '../content/content-cache';
import { ContentRecord, ImportRevision } from '../content/content.model';
import { activeContentRevision } from '../editor/active-content-revision';
import { ItemView, resolveItemView } from '../content/item-resolver';
import { ListControlsComponent } from '../list-controls.component';
import { UiIconComponent } from '../ui-icon.component';
import { SheetDetailDialogComponent } from '../sheet/sheet-detail-dialog.component';
import { CompendiumDetailsComponent } from './compendium-details.component';
import { SpellEffectFilterComponent } from '../spell-effect-filter.component';
import { SPELL_EFFECT_FILTER_GROUPS, SpellEffectFilter, matchesSpellEffects, spellEffectFilterCount, spellEffectsFromRecord } from '../content/spell-effects';
import { CONTENT_TYPES, ContentType, FACET_LABELS, Facet, Filters, facetLabel, kindLabel, matchesFilters, recordFacets, summary } from './compendium-catalog';
import { LibraryNavigationComponent } from '../library-navigation.component';
import { SourceBookFilterComponent } from '../editor/source-book-filter.component';
import { SourceBookFilterService } from '../editor/source-book-filter.service';
import { CompendiumSearchComponent } from './compendium-search.component';
import { requestedSourceBooks } from './compendium-navigation';
import { CompendiumSourceFilterComponent } from './compendium-source-filter.component';
import { CompendiumFilterService } from './compendium-filter.service';

@Component({
  selector: 'app-compendium',
  imports: [CompendiumSearchComponent, ScrollToTopComponent, ActiveFilterChipsComponent, SourceBookFilterComponent, CompendiumSourceFilterComponent, LibraryNavigationComponent, RouterLink, ListControlsComponent, UiIconComponent, SheetDetailDialogComponent, CompendiumDetailsComponent, SpellEffectFilterComponent],
  templateUrl: './compendium.component.html',
  styleUrl: './compendium.component.css',
})
export class CompendiumComponent implements OnInit, OnDestroy {
  readonly mobile = toSignal(inject(BreakpointObserver).observe('(max-width: 1023px)').pipe(map(result => result.matches)), { initialValue: false });
  readonly sourceDefaults = inject(SourceBookFilterService);
  private readonly filterPreferences = inject(CompendiumFilterService);
  private filterCategory: ContentType['id'] | null = null;
  private readonly route = inject(ActivatedRoute);
  private readonly cache = new IndexedDbContentCache();
  private subscription?: Subscription;
  private version = 0;
  private detailVersion = 0;
  private navigationVersion = 0;
  readonly navigationError = signal('');
  private timer?: ReturnType<typeof setTimeout>;
  private destroyed = false;
  readonly types = CONTENT_TYPES;
  readonly countsLoading = signal(true);
  readonly countsError = signal('');
  readonly counts = signal<Record<string, number>>({});
  readonly revision = signal<ImportRevision | null>(null);
  readonly type = signal<ContentType | null>(null);
  readonly loading = signal(true);
  readonly error = signal('');
  readonly invalidType = signal(false);
  readonly results = signal<ContentRecord[]>([]);
  readonly total = signal(0);
  readonly selected = signal<ContentRecord | null>(null);
  readonly related = signal<ContentRecord[]>([]);
  readonly itemView = signal<ItemView | null>(null);
  readonly detailError = signal('');
  readonly detailLoading = signal(false);
  readonly facetLabel = facetLabel;
  readonly summary = summary;
  readonly kindLabel = kindLabel;
  readonly facets = signal<{ key: Facet; label: string; values: string[] }[]>([]);
  query = '';
  filters: Filters = {};
  effects: SpellEffectFilter = {};
  sort: 'name' | 'level' | 'source' = 'name';
  offset = 0;
  readonly pageSize = 30;
  private get sourceBooks() { return this.facets().find(facet => facet.key === 'source')?.values ?? []; }
  get filterCount() { return Object.entries(this.filters).reduce((sum, [key, values]) => sum + (key === 'source'
    ? sourceFilterCount(values ?? [], this.sourceBooks) : values?.length ?? 0), 0) + spellEffectFilterCount(this.effects); }
  get activeFilters(): ActiveFilterGroup[] {
    return [
      ...(Object.entries(this.filters) as [Facet, string[]][]).map(([key, values]) => ({ key, label: FACET_LABELS[key], values: key === 'source'
        ? sourceChipValues(values, this.sourceBooks) : values.map(value => facetLabel(key, value)) })),
      ...SPELL_EFFECT_FILTER_GROUPS.map(group => ({ key: `effect:${group.key}`, label: group.label,
        values: (this.effects[group.key] ?? []).map(value => group.options.find(option => option.value === value)?.label ?? value) })),
    ].filter(group => group.values.length);
  }
  removeFilter(key: string) {
    if (key.startsWith('effect:')) { this.effects = { ...this.effects }; delete this.effects[key.slice(7) as keyof SpellEffectFilter]; }
    else { this.filters = { ...this.filters }; delete this.filters[key as Facet]; }
    if (key === 'source') this.closeDetails();
    this.scheduleSearch();
  }
  get page() { return Math.floor(this.offset / this.pageSize) + 1; }
  get pages() { return Math.max(1, Math.ceil(this.total() / this.pageSize)); }
  count(type: ContentType) { return type.id === 'class' ? this.counts()['class'] ?? 0 : type.kinds.reduce((sum, kind) => sum + (this.counts()[kind] ?? 0), 0); }

  async ngOnInit() {
    let ready = false, category: string | null = null;
    // Reflect navigation before IndexedDB work, so a list never shows clickable home tiles.
    this.subscription = this.route.paramMap.subscribe(params => {
      category = params.get('type');
      this.showCategory(category);
      if (ready) void this.chooseType(category);
    });
    if (this.route.queryParamMap) this.subscription.add(this.route.queryParamMap.subscribe(() => {
      if (ready) void this.chooseType(this.route.snapshot.paramMap.get('type'));
    }));
    const loaded = await this.loadLibrary();
    ready = true;
    if (loaded && !this.destroyed) await this.chooseType(category);
  }
  async loadLibrary() {
    this.loading.set(true); this.error.set('');
    try {
      const revision = await activeContentRevision(this.cache);
      if (this.destroyed) return false;
      this.revision.set(revision ?? null); this.counts.set({});
      return true;
    } catch (error) { if (!this.destroyed) this.error.set(`Could not read the content library: ${String(error)}`); }
    finally { if (!this.destroyed) this.loading.set(false); }
    return false;
  }
  async reload() { if (await this.loadLibrary() && !this.destroyed) await this.chooseType(this.route.snapshot.paramMap.get('type')); }
  async loadCounts() {
    const revision = this.revision();
    this.countsError.set(''); this.countsLoading.set(!!revision);
    if (!revision) return;
    try {
      const summary = await ensureBrowseSummary(this.cache, revision.id);
      if (!this.destroyed && this.revision()?.id === revision.id) this.counts.set(summary.counts);
    } catch {
      if (!this.destroyed && this.revision()?.id === revision.id) this.countsError.set('Category counts are unavailable. You can still open every category.');
    } finally {
      if (!this.destroyed && this.revision()?.id === revision.id) this.countsLoading.set(false);
    }
  }
  private showCategory(id: string | null) {
    const type = this.types.find(type => type.id === id) ?? null;
    this.type.set(type); this.invalidType.set(!!id && !type);
    return type;
  }
  async chooseType(id: string | null) {
    this.saveFilters();
    clearTimeout(this.timer);
    const version = ++this.version;
    const navigation = ++this.navigationVersion;
    this.navigationError.set('');
    const type = this.showCategory(id);
    const requested = this.route.snapshot.queryParamMap;
    this.query = requested?.get('q') ?? '';
    const requestedBooks = requestedSourceBooks(requested);
    const explicitFilters = requestedBooks !== null || requested?.has('source') || requested?.has('q') || requested?.has('entry');
    const saved = type && !explicitFilters ? this.filterPreferences.load(type.id) : undefined;
    this.filterCategory = type?.id ?? null;
    this.filters = saved?.filters ?? { source: requestedBooks ?? (requested?.get('source') ? [requested.get('source')!] : [...this.sourceDefaults.selected()]) };
    this.effects = saved?.effects ?? {}; this.sort = 'name'; this.offset = 0;
    this.closeDetails(); this.results.set([]); this.total.set(0); this.facets.set([]);
    const revision = this.revision();
    if (!type || !revision) { this.loading.set(false); if (!type) void this.loadCounts(); return; }
    this.loading.set(true);
    try {
      const options = new Map<Facet, Set<string>>();
      const summary = await readBrowseSummary(this.cache, revision.id);
      const addOptions = (fields: Filters) => {
        for (const [key, values] of Object.entries(fields) as [Facet, string[]][]) {
          if (!options.has(key)) options.set(key, new Set());
          values.forEach(value => options.get(key)!.add(value));
        }
      };
      if (summary) for (const kind of type.kinds) addOptions(summary.facets[kind] ?? {});
      else await this.cache.searchCategory(revision.id, type.kinds, '', 0, 0, record => {
        addOptions(recordFacets(record));
        return false;
      });
      if (version !== this.version) return;
      this.facets.set((Object.keys(FACET_LABELS) as Facet[]).flatMap(key => {
        const values = [...options.get(key) ?? []].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
        return values.length ? [{ key, label: FACET_LABELS[key], values }] : [];
      }));
      const requestedSource = requested?.get('source');
      if (requestedSource && requestedBooks === null) this.filters.source = [[...options.get('source') ?? []].find(source => source.toLowerCase() === requestedSource.toLowerCase()) ?? requestedSource];
      await this.search();
      const entry = requested?.get('entry');
      if (entry && navigation === this.navigationVersion && !this.destroyed) {
        try {
          const record = await this.cache.get(revision.id, entry);
          if (navigation !== this.navigationVersion || this.destroyed) return;
          if (!record || !(type.kinds as readonly string[]).includes(record.kind) || !this.sourceDefaults.allows(record.publication, this.filters.source ?? [])) {
            this.navigationError.set('The requested entry is unavailable in this category or excluded by Source Books.');
          } else {
            if (navigation === this.navigationVersion && !this.destroyed) await this.openDetails(record);
          }
        } catch {
          if (navigation === this.navigationVersion && !this.destroyed) this.navigationError.set('Could not open the requested entry.');
        }
      }
    } catch (error) { if (version === this.version) { this.error.set(`Could not load this category: ${String(error)}`); this.loading.set(false); } }
  }
  scheduleSearch() {
    this.saveFilters();
    clearTimeout(this.timer); ++this.version;
    this.offset = 0; this.loading.set(true);
    this.timer = setTimeout(() => { void this.search(); }, 180);
  }
  toggle(key: Facet, value: string) {
    const values = this.filters[key] ?? [];
    this.filters = { ...this.filters, [key]: values.includes(value) ? values.filter(entry => entry !== value) : [...values, value] };
    this.scheduleSearch();
  }
  setSources(sources: string[]) { this.filters = { ...this.filters, source: [...sources] }; this.closeDetails(); this.scheduleSearch(); }
  clearFilters() { this.query = ''; this.filters = {}; this.effects = {}; this.scheduleSearch(); }
  removeQuery() { this.query = ''; this.scheduleSearch(); }
  async search() {
    clearTimeout(this.timer);
    const revision = this.revision(), type = this.type();
    if (!revision || !type || this.destroyed) return;
    this.saveFilters();
    const version = ++this.version;
    const filters = structuredClone(this.filters);
    const effects = structuredClone(this.effects);
    this.loading.set(true); this.error.set('');
    try {
      const page = await this.cache.searchCategory(revision.id, type.kinds, this.query, this.offset, this.pageSize,
        record => matchesFilters(record, filters) && (record.kind !== 'spell' || !spellEffectFilterCount(effects) || matchesSpellEffects(spellEffectsFromRecord(record), effects)),
        (a, b) => this.sort === 'source' ? a.publication.localeCompare(b.publication) : this.sort === 'level'
          ? Number(recordFacets(a).level?.[0] ?? -1) - Number(recordFacets(b).level?.[0] ?? -1) : a.name.localeCompare(b.name));
      if (version !== this.version) return;
      this.results.set(page.records); this.total.set(page.total);
    } catch (error) { if (version === this.version) this.error.set(`Could not search the library: ${String(error)}`); }
    finally { if (version === this.version) this.loading.set(false); }
  }
  async turnPage(direction: number) {
    this.offset = Math.max(0, this.offset + direction * this.pageSize);
    await this.search();
  }
  readonly detailHistory = new EntryHistory();
  openRelated(record: ContentRecord) {
    const current = this.selected();
    if (current && current.key !== record.key) this.detailHistory.push(current);
    return this.openDetails(record, true);
  }
  async backDetails() {
    const previous = this.detailHistory.pop();
    if (previous) await this.openDetails(previous, true);
  }
  async openDetails(record: ContentRecord, keepHistory = false) {
    if (!keepHistory) this.detailHistory.clear();
    const version = ++this.detailVersion;
    this.selected.set(record); this.related.set([]); this.itemView.set(null); this.detailError.set(''); this.detailLoading.set(true);
    const revision = this.revision();
    if (!revision) { this.detailLoading.set(false); return; }
    try {
      if (record.kind === 'item') {
        const view = await resolveItemView(this.cache, revision.id, record);
        if (version !== this.detailVersion) return;
        this.itemView.set(view);
      }
      const related = await loadRelatedEntries(this.cache, revision.id, record, () => version === this.detailVersion);
      if (version === this.detailVersion) this.related.set(related);
    } catch (error) { if (version === this.detailVersion) this.detailError.set(`Related entries could not be loaded: ${String(error)}`); }
    finally { if (version === this.detailVersion) this.detailLoading.set(false); }
  }
  closeDetails() { ++this.detailVersion; this.detailHistory.clear(); this.selected.set(null); this.related.set([]); this.itemView.set(null); this.detailLoading.set(false); this.detailError.set(''); }
  private saveFilters() {
    if (this.filterCategory) this.filterPreferences.save(this.filterCategory, { filters: this.filters, effects: this.effects });
  }
  ngOnDestroy() { this.saveFilters(); this.destroyed = true; ++this.version; ++this.detailVersion; ++this.navigationVersion; clearTimeout(this.timer); this.subscription?.unsubscribe(); }
}
