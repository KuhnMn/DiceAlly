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
import { CompendiumSourceFilterComponent } from './compendium-source-filter.component';
import { speciesBadges } from './species-summary';

@Component({
  selector: 'app-compendium',
  imports: [ActiveFilterChipsComponent, SourceBookFilterComponent, CompendiumSourceFilterComponent, LibraryNavigationComponent, RouterLink, ListControlsComponent, UiIconComponent, SheetDetailDialogComponent, CompendiumDetailsComponent, SpellEffectFilterComponent],
  templateUrl: './compendium.component.html',
  styleUrl: './compendium.component.css',
})
export class CompendiumComponent implements OnInit, OnDestroy {
  readonly mobile = toSignal(inject(BreakpointObserver).observe('(max-width: 1023px)').pipe(map(result => result.matches)), { initialValue: false });
  readonly sourceDefaults = inject(SourceBookFilterService);
  private readonly route = inject(ActivatedRoute);
  private readonly cache = new IndexedDbContentCache();
  private subscription?: Subscription;
  private version = 0;
  private detailVersion = 0;
  private timer?: ReturnType<typeof setTimeout>;
  private destroyed = false;
  readonly types = CONTENT_TYPES;
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
  readonly speciesBadges = speciesBadges;
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
    await this.loadLibrary();
    if (!this.destroyed) this.subscription = this.route.paramMap.subscribe(params => { void this.chooseType(params.get('type')); });
  }
  async loadLibrary() {
    this.loading.set(true); this.error.set('');
    try {
      const revision = await activeContentRevision(this.cache);
      const counts: Record<string, number> = {};
      if (revision) await this.cache.visit(revision.id, async record => { counts[record.kind] = (counts[record.kind] ?? 0) + 1; });
      if (this.destroyed) return false;
      this.revision.set(revision ?? null); this.counts.set(counts);
      return true;
    } catch (error) { if (!this.destroyed) this.error.set(`Could not read the content library: ${String(error)}`); }
    finally { if (!this.destroyed) this.loading.set(false); }
    return false;
  }
  async reload() { if (await this.loadLibrary() && !this.destroyed) await this.chooseType(this.route.snapshot.paramMap.get('type')); }
  async chooseType(id: string | null) {
    clearTimeout(this.timer);
    const version = ++this.version;
    const type = this.types.find(type => type.id === id) ?? null;
    this.type.set(type); this.invalidType.set(!!id && !type);
    this.query = ''; this.filters = { source: [...this.sourceDefaults.selected()] }; this.effects = {}; this.sort = 'name'; this.offset = 0;
    this.closeDetails(); this.results.set([]); this.total.set(0); this.facets.set([]);
    const revision = this.revision();
    if (!type || !revision) { this.loading.set(false); return; }
    this.loading.set(true);
    try {
      const options = new Map<Facet, Set<string>>();
      await this.cache.searchCategory(revision.id, type.kinds, '', 0, 0, record => {
        for (const [key, values] of Object.entries(recordFacets(record)) as [Facet, string[]][]) {
          if (!options.has(key)) options.set(key, new Set());
          values.forEach(value => options.get(key)!.add(value));
        }
        return false;
      });
      if (version !== this.version) return;
      if (type.id === 'item' && options.get('kind')?.has('baseitem')) {
        const kinds = [...options.get('kind')!].filter(kind => kind !== 'baseitem');
        // An empty selection means all kinds, so retain an explicit exclusion even
        // when this library currently contains only base-item definitions.
        this.filters = { ...this.filters, kind: kinds.length ? kinds : type.kinds.filter(kind => kind !== 'baseitem') };
      }
      this.facets.set((Object.keys(FACET_LABELS) as Facet[]).flatMap(key => {
        const values = [...options.get(key) ?? []].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
        return values.length ? [{ key, label: FACET_LABELS[key], values }] : [];
      }));
      await this.search();
    } catch (error) { if (version === this.version) { this.error.set(`Could not load this category: ${String(error)}`); this.loading.set(false); } }
  }
  scheduleSearch() {
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
  async openDetails(record: ContentRecord) {
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
      const keys = [...new Set([...(record.classDefinition?.features.map(feature => feature.key) ?? []),
        ...record.links.filter(link => link.scope !== 'provenance' && link.status !== 'missing').map(link => link.target)])]
        .filter(key => key !== record.key);
      const related: ContentRecord[] = [];
      // Bound concurrent reads; retain only linked entries, never the full content corpus.
      for (let start = 0; start < keys.length; start += 20) {
        if (version !== this.detailVersion) return;
        const records = await Promise.all(keys.slice(start, start + 20).map(key => this.cache.get(revision.id, key)));
        related.push(...records.filter((value): value is ContentRecord => !!value));
      }
      if (version === this.detailVersion) this.related.set(related);
    } catch (error) { if (version === this.detailVersion) this.detailError.set(`Related entries could not be loaded: ${String(error)}`); }
    finally { if (version === this.detailVersion) this.detailLoading.set(false); }
  }
  closeDetails() { ++this.detailVersion; this.selected.set(null); this.related.set([]); this.itemView.set(null); this.detailLoading.set(false); this.detailError.set(''); }
  ngOnDestroy() { this.destroyed = true; ++this.version; ++this.detailVersion; clearTimeout(this.timer); this.subscription?.unsubscribe(); }
}
