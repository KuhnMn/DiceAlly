import { contentEntries } from '../content/content-entries';
import { higherLevelEntries } from '../entries/entry-compatibility';
import { spellDefinition, spellRecordClasses } from '../content/spell-adapter';
import { EditorCombatIndex } from './editor-combat-index';
import { compareSearchMatches } from '../search-ranking';
import { EditorEntryRowComponent } from './editor-entry-row.component';
import { CatalogResultRowComponent } from './catalog-result-row.component';
import { SpellSchoolFilterComponent } from '../spell-school-filter.component';
import { SPELL_SCHOOLS, SpellSchool, matchesSpellSchool, shortSpellSchoolLabel } from './spell-selection';
import { spellSourceCounts } from './spell-selection';
import { SpellCastingTimeFilterComponent } from '../spell-casting-time-filter.component';
import { ListControlsComponent } from '../list-controls.component';
import { EditorListHeaderComponent } from './editor-list-header.component';
import { DescriptionDialogComponent } from './description-dialog.component';
import { CombatBookmarkComponent } from './combat-bookmark.component';
import { HorizontalRowDirective } from '../sheet/horizontal-row.directive';
import { UiIconComponent } from '../ui-icon.component';
import { newEditorId } from './editor-identity';
import { ChangeDetectorRef, Component, DoCheck, OnDestroy, OnInit, effect, inject, input, output, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { IndexedDbContentCache } from '../content/content-cache';
import { ContentRecord, ImportRevision } from '../content/content.model';
import { ExportedCharacter, SpellEntryFull } from '../models/character.model';
import { EntryRendererComponent } from '../entries/entry-renderer.component';
import { CharacterHelpersService } from '../sheet/character-helpers.service';
import { FeatureSourcePickerComponent } from './feature-source-picker.component';
import { EntryAnnotationsComponent } from './entry-annotations.component';
import { SpellCastingTime, matchesCastingTime, spellListLabel, copySpellToList, SpellCatalogFilter, SpellList, matchesSpell, spellIdentity, spellSnapshot } from './spell-selection';
import { SourceBookFilterService } from './source-book-filter.service';
import { SourceBookFilterComponent } from './source-book-filter.component';
import { CatalogDialogComponent } from './catalog-dialog.component';
import { RemoveEntryDialogComponent } from './remove-entry-dialog.component';
import { CatalogQuery, EditorCatalog } from './editor-catalog';
import { contentReference } from './editor-content-helpers';
import { SpellEffectFilterComponent } from '../spell-effect-filter.component';
import { SpellEffectSummaryComponent } from '../sheet/spell-effect-summary.component';
import { SpellEffectFilter, matchesSpellEffects, spellEffectFilterCount, spellEffectsFromRecord } from '../content/spell-effects';
import { spellCastingStats } from './spell-source-stats';

@Component({
  providers: [EditorCombatIndex],
  selector: 'app-editor-spells',
  imports: [SpellEffectFilterComponent, SpellEffectSummaryComponent, EditorEntryRowComponent, CatalogResultRowComponent, SpellSchoolFilterComponent, SpellCastingTimeFilterComponent, ListControlsComponent, EditorListHeaderComponent, DescriptionDialogComponent, CombatBookmarkComponent, HorizontalRowDirective, UiIconComponent, FormsModule, RouterLink, EntryRendererComponent, EntryAnnotationsComponent, CatalogDialogComponent, SourceBookFilterComponent, RemoveEntryDialogComponent, FeatureSourcePickerComponent],
  templateUrl: './spells-editor.component.html',
  styleUrl: './editor.css',
})
export class SpellsEditorComponent implements OnInit, OnDestroy, DoCheck {
  readonly catalogEntries = contentEntries;
  readonly higherLevelEntries = higherLevelEntries;
  readonly definition = spellDefinition;
  private readonly combatIndex = inject(EditorCombatIndex);
  readonly sheet = input.required<ExportedCharacter>();
  setConcentrationReminder(enabled: boolean) {
    const character = this.sheet().character;
    if (character) { character.concentrationReminderEnabled = enabled; this.change(); }
  }
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
  readonly openSources = output<void>();
  readonly adding = signal(false);
  readonly classNames = signal<string[]>([]);
  readonly catalogLevels = signal<number[]>([]);
  readonly catalogSchools = signal<readonly typeof SPELL_SCHOOLS[number][]>([]);
  readonly levels = Array.from({ length: 10 }, (_, level) => level);
  readonly expanded = new Set<SpellEntryFull>();
  readonly sourceBooks = inject(SourceBookFilterService);
  private readonly view = inject(ChangeDetectorRef);
  readonly helpers = inject(CharacterHelpersService);
  private destroyed = false;
  selectedSource: string | undefined;
  sourceFilter = 'ALL';
  displayedMemberships: ('PREPARED' | 'SPELLBOOK')[] = [];
  displayedLevels: number[] = [];
  displayedCastingTimes: SpellCastingTime[] = [];
  displayedSchools: SpellSchool[] = [];
  displayedEffects: SpellEffectFilter = {};
  readonly effectFilterCount = spellEffectFilterCount;
  readonly catalogEffects = spellEffectsFromRecord;
  castingStats(sourceName?: string) { return spellCastingStats(this.sheet(), sourceName, this.helpers); }
  readonly shortSchoolLabel = shortSpellSchoolLabel;
  filter: SpellCatalogFilter = { search: '', classes: [], levels: [] };
  customName = '';
  customLevel = 0;
  customDescription = '';
  catalogOpen = false;
  listVisible = true;
  catalogAdded = 0;
  pendingRemoval?: SpellEntryFull;

  openCatalog() { this.catalogAdded = 0; this.catalogOpen = true; }

  constructor() {
    let initial = true;
    effect(() => {
      this.sourceBooks.selected();
      if (initial) { initial = false; return; }
      untracked(() => { void this.refreshContent(); });
    });
  }

  get sources() { return (this.sheet().character?.featureSources ?? []).filter(source => source.isSpellcastingSource && source.name?.trim()); }
  get orphanSources() {
    return [...new Set(this.spells.map(spell => spell.castingSourceName ?? ''))]
      .filter(name => !this.sources.some(source => source.name === name));
  }
  get targetSource() {
    return this.selectedSource === undefined ? this.sources[0]?.name : this.sources.find(source => source.name === this.selectedSource)?.name;
  }
  get spells() { return this.sheet().spells ?? []; }
  private counts?: ReturnType<typeof spellSourceCounts>;
  private index?: {
    spells: SpellEntryFull[]; length: number;
    memberships: Map<string, Map<string, SpellEntryFull>>;
    managed: SpellEntryFull[];
    added: Set<string>;
  };
  // The draft is edited in place, including by nested annotation editors. Rebuild
  // once per check rather than relying on signal/reference changes alone.
  ngDoCheck() { this.combatIndex.clear(); this.index = undefined; this.counts = undefined; }
  private get spellIndex() {
    const spells = this.spells;
    if (this.index?.spells === spells && this.index.length === spells.length) return this.index;
    this.counts = undefined;
    const memberships = new Map<string, Map<string, SpellEntryFull>>();
    const entries = new Map<string, SpellEntryFull>(), added = new Set<string>();
    for (const spell of spells) {
      const identity = spellIdentity(spell), previous = entries.get(identity);
      let lists = memberships.get(identity);
      if (!lists) { lists = new Map(); memberships.set(identity, lists); }
      if (spell.listType && !lists.has(spell.listType)) lists.set(spell.listType, spell);
      if (!previous || spell.listType === 'KNOWN' || (previous.listType === 'PREPARED' && spell.listType === 'SPELLBOOK')) entries.set(identity, spell);
      added.add(JSON.stringify([spell.castingSourceName ?? '', spell.contentReference
        ? ['key', spell.contentReference.key] : ['name', spell.name, spell.source]]));
    }
    return this.index = { spells, length: spells.length, memberships, managed: [...entries.values()], added };
  }
  get sourceSpellCounts() {
    this.spellIndex;
    return this.counts ??= spellSourceCounts(this.spells, this.sources, this.orphanSources);
  }
  get showSpellbook() { return this.sources.some(source => source.useSpellbook) || this.spells.some(spell => spell.listType === 'SPELLBOOK'); }
  get managedSpells() {
    return this.spellIndex.managed;
  }
  get selected() {
    return this.managedSpells.filter(spell => (this.sourceFilter === 'ALL' || (spell.castingSourceName ?? '') === this.sourceFilter)
      && (!this.displayedMemberships.length || this.displayedMemberships.some(list => this.hasList(spell, list)))
      && (!this.displayedLevels.length || this.displayedLevels.includes(spell.entity?.level ?? 0))
      && matchesCastingTime(spell.entity?.time, this.displayedCastingTimes)
      && matchesSpellSchool(spell.entity?.school, this.displayedSchools)
      && matchesSpellEffects(spell.entity, this.displayedEffects)
      && spell.name.toLowerCase().includes(this.listSearch.trim().toLowerCase()))
      .sort((a, b) => compareSearchMatches(a.name, b.name, this.listSearch)
        || (a.entity?.level ?? 0) - (b.entity?.level ?? 0) || a.name.localeCompare(b.name));
  }
  label(list: string) { return spellListLabel(list as SpellList); }
  listSearch = '';
  toggleMembershipFilter(list: 'PREPARED' | 'SPELLBOOK') {
    this.displayedMemberships = this.displayedMemberships.includes(list) ? this.displayedMemberships.filter(value => value !== list) : [...this.displayedMemberships, list];
  }
  toggleClass(name: string) {
    this.filter.classes = this.filter.classes.includes(name)
      ? this.filter.classes.filter(value => value !== name) : [...this.filter.classes, name];
    this.filterChanged();
  }
  toggleCatalogLevel(level: number) {
    this.filter.levels = this.filter.levels.includes(level)
      ? this.filter.levels.filter(value => value !== level) : [...this.filter.levels, level];
    this.filterChanged();
  }
  clearCatalogFilters() {
    this.filter = { search: '', classes: [], levels: [], schools: [] };
    this.filterChanged();
  }
  toggleDisplayedLevel(level: number) {
    this.displayedLevels = this.displayedLevels.includes(level)
      ? this.displayedLevels.filter(value => value !== level) : [...this.displayedLevels, level];
  }
  count(list: SpellList) { return this.spells.filter(spell => spell.listType === list && (this.sourceFilter === 'ALL' || (spell.castingSourceName ?? '') === this.sourceFilter)).length; }
  setSource(name: string) {
    this.sourceFilter = name;
    if (name === '' || this.sources.some(source => source.name === name)) this.selectedSource = name;
  }
  hasList(spell: SpellEntryFull, list: SpellList) { return this.spellIndex.memberships.get(spellIdentity(spell))?.has(list) ?? false; }
  usesSpellbook(spell: SpellEntryFull) { return this.sources.some(source => source.name === spell.castingSourceName && source.useSpellbook); }
  requiresConcentration(spell: SpellEntryFull) { return !!spell.entity?.duration?.some(duration => duration.concentration); }
  change() { this.combatIndex.clear(); this.index = undefined; this.counts = undefined; this.view.markForCheck(); this.edited.emit(); }
  toggle(spell: SpellEntryFull) {
    const identity = spellIdentity(spell), row = this.managedSpells.find(entry => spellIdentity(entry) === identity) ?? spell;
    this.expanded.has(row) ? this.expanded.delete(row) : this.expanded.add(row);
  }
  preparedEntry(spell: SpellEntryFull) { return this.spellIndex.memberships.get(spellIdentity(spell))?.get('PREPARED'); }
  addToList(spell: SpellEntryFull, list: SpellList) {
    if (this.hasList(spell, list) || (list === 'SPELLBOOK' && !this.usesSpellbook(spell))) return;
    const copy = copySpellToList(spell, list);
    (this.sheet().spells ??= []).push(copy); this.change();
  }
  toggleMembership(spell: SpellEntryFull, list: 'PREPARED' | 'SPELLBOOK') {
    if (list === 'SPELLBOOK' && !this.usesSpellbook(spell)) return;
    const identity = spellIdentity(spell);
    const existing = this.spells.find(entry => entry.listType === list && spellIdentity(entry) === identity);
    if (existing) this.remove(existing);
    else this.addToList(spell, list);
  }
  remove(spell: SpellEntryFull) {
    // Android retains a known entry while its prepared version exists.
    if (spell.listType === 'KNOWN' && this.hasList(spell, 'PREPARED')) return;
    if (spell.notes?.length || spell.uses?.length) { this.pendingRemoval = spell; this.view.markForCheck(); return; }
    this.deleteSpell(spell);
  }
  confirmRemoval() {
    const spell = this.pendingRemoval; this.pendingRemoval = undefined;
    if (spell && !(spell.listType === 'KNOWN' && this.hasList(spell, 'PREPARED'))) this.deleteSpell(spell);
  }
  private deleteSpell(spell: SpellEntryFull) {
    const index = this.spells.indexOf(spell);
    if (index < 0) return;
    this.spells.splice(index, 1); this.expanded.delete(spell); this.change();
  }
  isAdded(record: ContentRecord, source = this.targetSource) {
    const added = this.spellIndex.added;
    return added.has(JSON.stringify([source ?? '', ['key', record.key]]))
      || added.has(JSON.stringify([source ?? '', ['name', record.name, record.publication]]));
  }
  private entry(record: ContentRecord, revision: ImportRevision, source: string | undefined): SpellEntryFull {
    return { editorId: newEditorId(), name: record.name, source: record.publication, castingSourceName: source,
      listType: 'KNOWN', userAdded: true, notes: [], uses: [], entity: spellSnapshot(record),
      contentReference: contentReference(record, revision) };
  }
  add(record: ContentRecord) {
    if (!this.targetSource) return;
    const revision = this.revision();
    if (!revision || record.kind !== 'spell' || this.isAdded(record)) return;
    (this.sheet().spells ??= []).push(this.entry(record, revision, this.targetSource)); this.catalogAdded++; this.change();
  }
  async addMatching() {
    if (!this.targetSource) return;
    const revision = this.revision(); if (!revision || this.adding()) return;
    // Capture the exact query and destination before awaiting IndexedDB. Commit only after success.
    const filter = structuredClone(this.filter); const source = this.targetSource; const sheet = this.sheet();
    const books = this.sourceBooks.selected();
    this.adding.set(true);
    try {
      const result = await this.cache.searchCategory(revision.id, ['spell'], '', 0, Number.MAX_SAFE_INTEGER,
        record => this.sourceBooks.allows(record.publication, books) && matchesSpell(record, filter));
      if (this.destroyed || this.sheet() !== sheet || !this.sources.some(entry => entry.name === source)) return;
      const additions = result.records.filter(record => !this.isAdded(record, source)).map(record => this.entry(record, revision, source));
      (sheet.spells ??= []).push(...additions);
      this.catalogAdded += additions.length;
      if (additions.length) this.change();
      this.message.set(`Added ${additions.length} spells to Spelllist${source ? ` · ${source}` : ''}. ${result.total - additions.length} already available.`);
    } catch (error) { this.message.set(`Could not add spells: ${String(error)}`); }
    finally { this.adding.set(false); }
  }
  addCustom() {
    if (!this.targetSource) return;
    const name = this.customName.trim();
    if (!name || !Number.isInteger(this.customLevel) || this.customLevel < 0 || this.customLevel > 9) return;
    if (this.spells.some(spell => spell.name === name && spell.source === 'Custom'
      && (spell.castingSourceName ?? '') === (this.targetSource ?? ''))) return;
    const spell: SpellEntryFull = { editorId: newEditorId(), name, source: 'Custom', castingSourceName: this.targetSource,
      listType: 'KNOWN', userAdded: true, notes: [], uses: [], entity: { name, source: 'Custom', level: this.customLevel,
        school: '', time: [], range: {}, components: {}, duration: [], entries: this.customDescription ? [{ text: this.customDescription }] : [] } };
    (this.sheet().spells ??= []).push(spell); this.catalogAdded++; this.customName = ''; this.customDescription = ''; this.change();
  }
  async ngOnInit() { await this.refreshContent(); }
  ngOnDestroy() {
    this.destroyed = true;
    this.catalog.dispose();
  }
  private refreshTask?: Promise<void>;
  refreshContent() {
    this.classNames.set([]);
    this.catalogLevels.set([]); this.catalogSchools.set([]);
    const books = this.sourceBooks.selected();
    return this.refreshTask = this.catalog.refresh(
      'Import content to browse spells. Saved spells remain available without the catalog.',
      () => this.catalogQuery(),
      async (revision, isCurrent) => {
        const classes = new Set<string>(), levels = new Set<number>(), schools = new Set<SpellSchool>();
        // Collect filter options without retaining the entire spell catalog.
        await this.cache.searchCategory(revision.id, ['spell'], '', 0, 0, record => {
          if (!this.sourceBooks.allows(record.publication, books)) return false;
          spellRecordClasses(record).filter(entry => this.sourceBooks.allows(entry.source ?? record.publication, books)).forEach(entry => classes.add(entry.name));
          if (record.kind === 'spell') levels.add(spellDefinition(record).level);
          SPELL_SCHOOLS.filter(school => matchesSpellSchool(spellDefinition(record).school, [school.value])).forEach(school => schools.add(school.value));
          return false;
        });
        if (isCurrent()) {
          this.classNames.set([...classes].sort()); this.catalogLevels.set([...levels].sort((a, b) => a - b));
          this.catalogSchools.set(SPELL_SCHOOLS.filter(school => schools.has(school.value)));
          this.filter.classes = this.filter.classes.filter(name => classes.has(name));
          this.filter.levels = this.filter.levels.filter(level => levels.has(level));
          this.filter.schools = this.filter.schools?.filter(school => schools.has(school));
        }
      },
    );
  }
  filterChanged() { this.catalog.scheduleSearch(() => this.catalogQuery()); }
  async searchContent() { await this.refreshTask; return this.catalog.search(this.catalogQuery()); }
  nextPage(direction: number) { void this.catalog.nextPage(direction, this.catalogQuery()); }
  private catalogQuery(): CatalogQuery {
    const books = this.sourceBooks.selected();
    const filter = structuredClone(this.filter);
    return {
      kinds: ['spell'],
      order: (a, b) => spellDefinition(a).level - spellDefinition(b).level,
      search: filter.search,
      includes: record => this.sourceBooks.allows(record.publication, books) && matchesSpell(record, filter),
    };
  }
}
