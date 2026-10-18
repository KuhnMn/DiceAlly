import { DescriptionDialogComponent } from './description-dialog.component';
import { CombatBookmarkComponent } from './combat-bookmark.component';
import { HorizontalRowDirective } from '../sheet/horizontal-row.directive';
import { UiIconComponent } from '../ui-icon.component';
import { copySpellToList } from './spell-selection';
import { newEditorId } from './editor-identity';
import { ChangeDetectorRef, Component, OnDestroy, OnInit, effect, inject, input, output, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { IndexedDbContentCache } from '../content/content-cache';
import { ContentRecord, ImportRevision } from '../content/content.model';
import { ExportedCharacter, SpellEntryFull } from '../models/character.model';
import { EntryRendererComponent } from '../entries/entry-renderer.component';
import { CharacterHelpersService } from '../sheet/character-helpers.service';
import { FeatureSourcePickerComponent } from './feature-source-picker.component';
import { EntryAnnotationsComponent } from './entry-annotations.component';
import { SpellCatalogFilter, SpellList, matchesSpell, spellClasses, spellIdentity, spellSnapshot } from './spell-selection';
import { SourceBookFilterService } from './source-book-filter.service';
import { SourceBookFilterComponent } from './source-book-filter.component';
import { CatalogDialogComponent } from './catalog-dialog.component';
import { RemoveEntryDialogComponent } from './remove-entry-dialog.component';
import { CatalogQuery, EditorCatalog } from './editor-catalog';
import { contentReference } from './editor-content-helpers';

@Component({
  selector: 'app-editor-spells',
  imports: [DescriptionDialogComponent, CombatBookmarkComponent, HorizontalRowDirective, UiIconComponent, FormsModule, RouterLink, EntryRendererComponent, EntryAnnotationsComponent, CatalogDialogComponent, SourceBookFilterComponent, RemoveEntryDialogComponent, FeatureSourcePickerComponent],
  templateUrl: './spells-editor.component.html',
  styleUrl: './local-editor.component.css',
})
export class SpellsEditorComponent implements OnInit, OnDestroy {
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
  readonly openSources = output<void>();
  readonly adding = signal(false);
  readonly classNames = signal<string[]>([]);
  readonly levels = Array.from({ length: 10 }, (_, level) => level);
  readonly expanded = new Set<SpellEntryFull>();
  private readonly sourceBooks = inject(SourceBookFilterService);
  private readonly view = inject(ChangeDetectorRef);
  readonly helpers = inject(CharacterHelpersService);
  private destroyed = false;
  selectedSource: string | undefined;
  sourceFilter = 'ALL';
  list: SpellList = 'KNOWN';
  displayedLevels: number[] = [];
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
      untracked(() => this.filterChanged());
    });
  }

  get sources() { return (this.sheet().character?.featureSources ?? []).filter(source => source.isSpellcastingSource && source.name?.trim()); }
  get orphanSources() {
    return [...new Set(this.spells.map(spell => spell.castingSourceName ?? ''))]
      .filter(name => !this.sources.some(source => source.name === name));
  }
  get targetSource() { return this.selectedSource === undefined ? this.sources[0]?.name : this.selectedSource || undefined; }
  get spells() { return this.sheet().spells ?? []; }
  get showSpellbook() { return this.sources.some(source => source.useSpellbook) || this.spells.some(spell => spell.listType === 'SPELLBOOK'); }
  get lists(): SpellList[] { return this.showSpellbook ? ['KNOWN', 'SPELLBOOK', 'PREPARED'] : ['KNOWN', 'PREPARED']; }
  get selected() {
    return this.spells.filter(spell => spell.listType === this.list
      && (this.sourceFilter === 'ALL' || (spell.castingSourceName ?? '') === this.sourceFilter)
      && (!this.displayedLevels.length || this.displayedLevels.includes(spell.entity?.level ?? 0))
      && spell.name.toLowerCase().includes(this.listSearch.trim().toLowerCase()))
      .sort((a, b) => (a.entity?.level ?? 0) - (b.entity?.level ?? 0) || a.name.localeCompare(b.name));
  }
  label(list: SpellList) { return list === 'KNOWN' ? 'Known' : list === 'SPELLBOOK' ? 'Spellbook' : 'Prepared'; }
  listSearch = '';
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
  toggleDisplayedLevel(level: number) {
    this.displayedLevels = this.displayedLevels.includes(level)
      ? this.displayedLevels.filter(value => value !== level) : [...this.displayedLevels, level];
  }
  count(list: SpellList) { return this.spells.filter(spell => spell.listType === list && (this.sourceFilter === 'ALL' || (spell.castingSourceName ?? '') === this.sourceFilter)).length; }
  setSource(name: string) {
    this.sourceFilter = name;
    if (name === '' || this.sources.some(source => source.name === name)) this.selectedSource = name;
  }
  hasList(spell: SpellEntryFull, list: SpellList) { return this.spells.some(entry => spellIdentity(entry) === spellIdentity(spell) && entry.listType === list); }
  usesSpellbook(spell: SpellEntryFull) { return this.sources.some(source => source.name === spell.castingSourceName && source.useSpellbook); }
  change() { this.view.markForCheck(); this.edited.emit(); }
  toggle(spell: SpellEntryFull) { this.expanded.has(spell) ? this.expanded.delete(spell) : this.expanded.add(spell); }
  addToList(spell: SpellEntryFull, list: SpellList) {
    if (this.hasList(spell, list) || (list === 'SPELLBOOK' && !this.usesSpellbook(spell))) return;
    const copy = copySpellToList(spell, list);
    (this.sheet().spells ??= []).push(copy); this.change();
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
    return this.spells.some(spell => spell.castingSourceName === source
      && (spell.contentReference?.key === record.key || (!spell.contentReference && spell.name === record.name && spell.source === record.publication)));
  }
  private entry(record: ContentRecord, revision: ImportRevision, source: string | undefined): SpellEntryFull {
    return { editorId: newEditorId(), name: record.name, source: record.publication, castingSourceName: source,
      listType: 'KNOWN', userAdded: true, notes: [], uses: [], entity: spellSnapshot(record),
      contentReference: contentReference(record, revision) };
  }
  add(record: ContentRecord) {
    const revision = this.revision();
    if (!revision || record.kind !== 'spell' || this.isAdded(record)) return;
    (this.sheet().spells ??= []).push(this.entry(record, revision, this.targetSource)); this.catalogAdded++; this.change();
  }
  async addMatching() {
    const revision = this.revision(); if (!revision || this.adding()) return;
    // Capture the exact query and destination before awaiting IndexedDB. Commit only after success.
    const filter = structuredClone(this.filter); const source = this.targetSource; const sheet = this.sheet();
    const books = this.sourceBooks.selected();
    this.adding.set(true);
    try {
      const result = await this.cache.searchCategory(revision.id, ['spell'], '', 0, Number.MAX_SAFE_INTEGER,
        record => this.sourceBooks.allows(record.publication, books) && matchesSpell(record, filter));
      if (this.destroyed || this.sheet() !== sheet) return;
      const additions = result.records.filter(record => !this.isAdded(record, source)).map(record => this.entry(record, revision, source));
      (sheet.spells ??= []).push(...additions);
      this.catalogAdded += additions.length;
      if (additions.length) this.change();
      this.message.set(`Added ${additions.length} spells to Known${source ? ` · ${source}` : ''}. ${result.total - additions.length} already available.`);
    } catch (error) { this.message.set(`Could not add spells: ${String(error)}`); }
    finally { this.adding.set(false); }
  }
  addCustom() {
    const name = this.customName.trim();
    if (!name || !Number.isInteger(this.customLevel) || this.customLevel < 0 || this.customLevel > 9) return;
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
  refreshContent() {
    this.classNames.set([]);
    return this.catalog.refresh(
      'Import content to browse spells. Saved spells remain available without the catalog.',
      () => this.catalogQuery(),
      async (revision, isCurrent) => {
        const classes = new Set<string>();
        // Collect filter options without retaining the entire spell catalog.
        await this.cache.searchCategory(revision.id, ['spell'], '', 0, 0, record => {
          spellClasses(record.data).forEach(entry => classes.add(entry.name));
          return false;
        });
        if (isCurrent()) this.classNames.set([...classes].sort());
      },
    );
  }
  filterChanged() { this.catalog.scheduleSearch(() => this.catalogQuery()); }
  searchContent() { return this.catalog.search(this.catalogQuery()); }
  nextPage(direction: number) { void this.catalog.nextPage(direction, this.catalogQuery()); }
  private catalogQuery(): CatalogQuery {
    const books = this.sourceBooks.selected();
    const filter = structuredClone(this.filter);
    return {
      kinds: ['spell'],
      search: '',
      includes: record => this.sourceBooks.allows(record.publication, books) && matchesSpell(record, filter),
    };
  }
}
