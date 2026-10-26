import { readBrowseSummary } from '../content/content-browse-summary';
import { ScrollToTopComponent } from '../scroll-to-top.component';
import { loadRelatedEntries } from './related-entries';
import { EntryHistory } from './entry-history';
import { Component, OnInit, OnDestroy, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { CompendiumSearchComponent } from './compendium-search.component';
import { requestedSourceBooks } from './compendium-navigation';
import { IndexedDbContentCache } from '../content/content-cache';
import { ContentRecord, ImportRevision } from '../content/content.model';
import { classDefinition } from '../content/class-adapter';
import { activeContentRevision } from '../editor/active-content-revision';
import { LibraryNavigationComponent } from '../library-navigation.component';
import { ListControlsComponent } from '../list-controls.component';
import { UiIconComponent } from '../ui-icon.component';
import { SheetDetailDialogComponent } from '../sheet/sheet-detail-dialog.component';
import { CompendiumDetailsComponent } from './compendium-details.component';
import { belongsToClass, ClassFeatureRow, groupProgression, loadProgression } from './class-compendium';
import { SourceBookFilterService } from '../editor/source-book-filter.service';
import { CompendiumSourceFilterComponent } from './compendium-source-filter.component';
import { ClassResourcesComponent } from './class-resources.component';
import { ActiveFilterChipsComponent } from './active-filter-chips.component';
import { sourceChipValues, sourceFilterCount } from './compendium-sources';
import { ClassProficienciesComponent } from './class-proficiencies.component';

@Component({
  selector: 'app-class-compendium',
  imports: [CompendiumSearchComponent, ScrollToTopComponent, ClassProficienciesComponent, ActiveFilterChipsComponent, CompendiumSourceFilterComponent, ClassResourcesComponent, RouterLink, LibraryNavigationComponent, ListControlsComponent, UiIconComponent, SheetDetailDialogComponent, CompendiumDetailsComponent],
  templateUrl: './class-compendium.component.html',
  styleUrl: './compendium.component.css',
})
export class ClassCompendiumComponent implements OnInit, OnDestroy {
  readonly sourceDefaults = inject(SourceBookFilterService);
  private readonly cache = new IndexedDbContentCache();
  private readonly route = inject(ActivatedRoute);
  private routeSubscription?: Subscription;
  private navigationVersion = 0;
  readonly navigationError = signal('');
  private version = 0;
  private subclassVersion = 0;
  private destroyed = false;
  readonly revision = signal<ImportRevision | null>(null);
  readonly classes = signal<ContentRecord[]>([]);
  readonly selectedClass = signal<ContentRecord | null>(null);
  readonly subclasses = signal<ContentRecord[]>([]);
  readonly selectedSubclass = signal<ContentRecord | null>(null);
  readonly baseFeatures = signal<ClassFeatureRow[]>([]);
  readonly subclassFeatures = signal<ClassFeatureRow[]>([]);
  readonly missingBase = signal<string[]>([]);
  readonly missingSubclass = signal<string[]>([]);
  readonly loading = signal(true);
  readonly progressionLoading = signal(false);
  readonly subclassLoading = signal(false);
  readonly error = signal('');
  readonly progressionError = signal('');
  readonly detail = signal<ContentRecord | null>(null);
  readonly related = signal<ContentRecord[]>([]);
  readonly detailLoading = signal(false);
  readonly detailError = signal('');
  private detailVersion = 0;
  readonly query = signal('');
  readonly selectedSources = signal([...this.sourceDefaults.selected()]);
  readonly subclassSources = signal([...this.selectedSources()]);
  readonly subclassBooks = computed(() => [...new Set(this.subclasses().map(record => record.publication))].sort());
  readonly visibleSubclasses = computed(() => this.subclasses().filter(record => this.sourceDefaults.allows(record.publication, this.subclassSources())));
  readonly featureQuery = signal('');
  private readonly subclassPublications = signal<Record<string, string[]>>({});
  private booksForClass(record: ContentRecord): string[] {
    return [record.publication, ...this.subclassPublications()[record.homebrewVariant?.originalKey ?? record.key] ?? []];
  }
  readonly sources = computed(() => [...new Set(this.classes().flatMap(record => this.booksForClass(record)))].sort());
  readonly sourceCount = computed(() => sourceFilterCount(this.selectedSources(), this.sources()));
  readonly sourceChips = computed(() => sourceChipValues(this.selectedSources(), this.sources()));
  readonly subclassSourceChips = computed(() => sourceChipValues(this.subclassSources(), this.subclassBooks()));
  readonly visibleClasses = computed(() => {
    const terms = this.query().trim().toLowerCase().split(/\s+/).filter(Boolean);
    return this.classes().filter(record => this.booksForClass(record).some(book => this.sourceDefaults.allows(book, this.selectedSources()))
      && terms.every(term => `${record.name} ${record.publication}`.toLowerCase().includes(term)));
  });
  readonly levels = computed(() => groupProgression(this.baseFeatures(), this.subclassFeatures(), this.featureQuery()));
  readonly missingCount = computed(() => this.missingBase().length + this.missingSubclass().length);
  async ngOnInit() {
    this.routeSubscription = this.route.queryParamMap.subscribe(() => {
      if (this.revision() && !this.loading()) void this.openRequestedEntry();
    });
    await this.reload();
  }
  async reload() {
    const version = ++this.version;
    this.resetClass(); this.loading.set(true); this.error.set('');
    try {
      const revision = await activeContentRevision(this.cache);
      const records: ContentRecord[] = [];
      const summary = revision ? await readBrowseSummary(this.cache, revision.id) : undefined;
      const subclassBooks: Record<string, string[]> = summary?.subclassSources ?? {};
      if (revision) await this.cache.searchCategory(revision.id, summary ? ['class'] : ['class', 'subclass'], '', 0, 0, record => {
        if (record.kind === 'class') records.push(record);
        else {
          const parent = classDefinition(record).parent?.key;
          if (parent) { const books = subclassBooks[parent] ??= []; if (!books.includes(record.publication)) books.push(record.publication); }
        }
        return false;
      });
      if (this.destroyed || version !== this.version) return;
      this.revision.set(revision ?? null);
      this.subclassPublications.set(subclassBooks);
      this.classes.set(records.sort((a, b) => a.name.localeCompare(b.name) || a.publication.localeCompare(b.publication)));
      this.loading.set(false);
      await this.openRequestedEntry();
    } catch (error) { if (version === this.version) this.error.set(`Could not load classes: ${String(error)}`); }
    finally { if (version === this.version) this.loading.set(false); }
  }
  private async openRequestedEntry() {
    const navigation = ++this.navigationVersion, version = this.version;
    const requested = this.route.snapshot.queryParamMap, key = requested.get('entry'), revision = this.revision();
    this.navigationError.set('');
    if (!key || !revision) return;
    const current = () => navigation === this.navigationVersion && !this.destroyed;
    try {
      const entry = await this.cache.get(revision.id, key);
      if (!current() || version !== this.version) return;
      const sources = requestedSourceBooks(requested) ?? [...this.sourceDefaults.selected()];
      this.selectedSources.set(sources);
      if (!entry || !['class', 'subclass'].includes(entry.kind) || !this.sourceDefaults.allows(entry.publication, sources)) {
        ++this.version; this.resetClass();
        this.navigationError.set('The requested class or subclass is unavailable or excluded by Source Books.'); return;
      }
      const parentKey = entry.kind === 'class' ? entry.key : classDefinition(entry).parent?.key;
      const variants = this.classes().filter(record => record.homebrewVariant?.originalKey === parentKey);
      const owner = this.classes().find(record => record.key === parentKey) ?? (variants.length === 1 ? variants[0] : undefined);
      if (!owner) { ++this.version; this.resetClass(); this.navigationError.set('The parent class for this entry is not installed.'); return; }
      await this.chooseClass(owner);
      if (!current() || this.selectedClass()?.key !== owner.key) return;
      if (entry.kind === 'subclass') await this.chooseSubclass(this.subclasses().find(record => record.key === entry.key) ?? null);
    } catch {
      if (current() && version === this.version) { ++this.version; this.resetClass(); this.navigationError.set('Could not open the requested class or subclass.'); }
    }
  }
  resetClass() {
    ++this.subclassVersion; this.closeDetails(); this.selectedClass.set(null); this.selectedSubclass.set(null);
    this.subclasses.set([]); this.baseFeatures.set([]); this.subclassFeatures.set([]); this.featureQuery.set('');
    this.missingBase.set([]); this.missingSubclass.set([]); this.progressionError.set('');
    this.progressionLoading.set(false); this.subclassLoading.set(false);
  }
  showAllClasses() { ++this.version; this.resetClass(); }
  setSubclassSources(sources: string[]) {
    this.subclassSources.set([...sources]);
    const selected = this.selectedSubclass();
    if (selected && !this.sourceDefaults.allows(selected.publication, sources)) {
      this.closeDetails();
      void this.chooseSubclass(null);
    }
  }
  async chooseClass(record: ContentRecord) {
    const revision = this.revision();
    if (!revision || record.kind !== 'class') return;
    const version = ++this.version;
    this.resetClass(); this.subclassSources.set([...this.selectedSources()]); this.selectedClass.set(record); this.progressionLoading.set(true);
    try {
      const subclasses: ContentRecord[] = [];
      const [, progression] = await Promise.all([
        this.cache.searchCategory(revision.id, ['subclass'], '', 0, 0, entry => {
          if (belongsToClass(entry, record)) subclasses.push(entry);
          return false;
        }),
        loadProgression(this.cache, revision.id, record),
      ]);
      if (version !== this.version || this.destroyed) return;
      this.subclasses.set(subclasses.sort((a, b) => a.name.localeCompare(b.name) || a.publication.localeCompare(b.publication)));
      this.baseFeatures.set(progression.rows); this.missingBase.set(progression.missing);
    } catch (error) { if (version === this.version) this.progressionError.set(`Could not load this class: ${String(error)}`); }
    finally { if (version === this.version) this.progressionLoading.set(false); }
  }
  async chooseSubclass(subclass: ContentRecord | null) {
    const owner = this.selectedClass(), revision = this.revision();
    if (!owner || !revision || (subclass && (!belongsToClass(subclass, owner) || !this.sourceDefaults.allows(subclass.publication, this.subclassSources())))) return;
    const version = ++this.subclassVersion;
    this.selectedSubclass.set(subclass); this.subclassFeatures.set([]); this.missingSubclass.set([]);
    this.progressionError.set(''); this.subclassLoading.set(!!subclass);
    if (!subclass) return;
    try {
      const progression = await loadProgression(this.cache, revision.id, owner, subclass);
      if (version !== this.subclassVersion || this.destroyed) return;
      this.subclassFeatures.set(progression.rows); this.missingSubclass.set(progression.missing);
    } catch (error) { if (version === this.subclassVersion) this.progressionError.set(`Could not load this subclass: ${String(error)}`); }
    finally { if (version === this.subclassVersion) this.subclassLoading.set(false); }
  }
  selectSubclass(key: string) { return this.chooseSubclass(this.visibleSubclasses().find(record => record.key === key) ?? null); }
  readonly detailHistory = new EntryHistory();
  openRelated(record: ContentRecord) {
    const current = this.detail();
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
    this.detail.set(record); this.related.set([]); this.detailError.set(''); this.detailLoading.set(true);
    const revision = this.revision();
    if (!revision) { this.detailLoading.set(false); return; }
    try {
      const related = await loadRelatedEntries(this.cache, revision.id, record, () => version === this.detailVersion);
      if (version === this.detailVersion) this.related.set(related);
    } catch (error) {
      if (version === this.detailVersion) this.detailError.set(`Related entries could not be loaded: ${String(error)}`);
    } finally { if (version === this.detailVersion) this.detailLoading.set(false); }
  }
  closeDetails() {
    ++this.detailVersion; this.detailHistory.clear(); this.detail.set(null); this.related.set([]); this.detailLoading.set(false); this.detailError.set('');
  }
  ngOnDestroy() { this.destroyed = true; ++this.version; ++this.subclassVersion; ++this.detailVersion; ++this.navigationVersion; this.routeSubscription?.unsubscribe(); }
}
