import { monsterDefinition } from '../content/monster-adapter';
import { EditorCombatIndex } from './editor-combat-index';
import { CatalogMembershipIndex, catalogEntryKeys } from './catalog-membership-index';
import { rankSearchResults } from '../search-ranking';
import { EditorEntryRowComponent } from './editor-entry-row.component';
import { CatalogResultRowComponent } from './catalog-result-row.component';
import { ListControlsComponent } from '../list-controls.component';
import { EditorListHeaderComponent } from './editor-list-header.component';
import { DescriptionDialogComponent } from './description-dialog.component';
import { CombatBookmarkComponent } from './combat-bookmark.component';
import { UiIconComponent } from '../ui-icon.component';
import { ChangeDetectorRef, Component, DoCheck, OnDestroy, OnInit, effect, inject, input, output, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ExportedCharacter, Monster } from '../models/character.model';
import { ContentRecord } from '../content/content.model';
import { IndexedDbContentCache } from '../content/content-cache';
import { CatalogQuery, EditorCatalog } from './editor-catalog';
import { CatalogDialogComponent } from './catalog-dialog.component';
import { RemoveEntryDialogComponent } from './remove-entry-dialog.component';
import { EntryAnnotationsComponent } from './entry-annotations.component';
import { SourceBookFilterComponent } from './source-book-filter.component';
import { SourceBookFilterService } from './source-book-filter.service';
import { newEditorId } from './editor-identity';
import { createMonsterEntry } from './monster-selection';
import { Companion, CompanionType, COMPANION_TYPES, companionHitPoints, isObjectCompanion, objectTypeName, setCompanionMaximumHitPoints } from '../models/companions';
import { createObjectEntry } from './object-selection';
import { CompanionStatBlockComponent } from '../sheet/companion-stat-block.component';
import { HorizontalRowDirective } from '../sheet/horizontal-row.directive';

@Component({
  providers: [EditorCombatIndex],
  selector: 'app-editor-monsters',
  imports: [HorizontalRowDirective, CompanionStatBlockComponent, EditorEntryRowComponent, CatalogResultRowComponent, ListControlsComponent, EditorListHeaderComponent, DescriptionDialogComponent, CombatBookmarkComponent, UiIconComponent, FormsModule, RouterLink, CatalogDialogComponent, RemoveEntryDialogComponent, EntryAnnotationsComponent, SourceBookFilterComponent],
  templateUrl: './monsters-editor.component.html', styleUrl: './editor.css',
})
export class MonstersEditorComponent implements OnInit, OnDestroy, DoCheck {
  catalogHp(record: ContentRecord): number | string {
    if (record.referenceDefinition?.kind === 'object') { const hp = record.referenceDefinition.hp; return typeof hp === 'number' ? hp : 'Special'; }
    const hp = monsterDefinition(record).hp;
    return hp && 'average' in hp ? hp.average : 'Special';
  }
  private readonly combatIndex = inject(EditorCombatIndex);
  readonly sheet = input.required<ExportedCharacter>();
  private readonly membership = new CatalogMembershipIndex<Companion>();
  ngDoCheck() { this.combatIndex.clear(); this.membership.clear(); }
  readonly edited = output<void>();
  readonly catalog = new EditorCatalog(new IndexedDbContentCache());
  readonly books = inject(SourceBookFilterService);
  private readonly view = inject(ChangeDetectorRef);
  readonly expanded = new Set<Companion>();
  private readonly previews = new WeakMap<ContentRecord, Companion>();
  readonly types = COMPANION_TYPES;
  selectedType: CompanionType = 'monster';
  get label() { return this.selectedType === 'object' ? 'Objects' : 'Monsters'; }
  readonly health = companionHitPoints;
  objectType(value: Companion) { return isObjectCompanion(value) ? objectTypeName(value.entity) : undefined; }
  catalogObjectType(record: ContentRecord) { return record.referenceDefinition?.kind === 'object' ? objectTypeName(record.referenceDefinition) : undefined; }
  setType(type: CompanionType) {
    if (type === this.selectedType) return;
    this.selectedType = type; this.search = ''; this.listSearch = ''; this.catalogOpen = false; this.pendingRemoval = undefined;
    this.membership.clear(); void this.refreshContent();
  }
  catalogOpen = false;
  listVisible = true;
  listSearch = '';
  catalogAdded = 0;
  search = '';
  customName = '';
  pendingRemoval?: Companion;
  setMaxHp(monster: Companion, value: number | null) { setCompanionMaximumHitPoints(monster, value); this.change(); }

  constructor() {
    let initial = true;
    effect(() => {
      this.books.selected();
      if (initial) { initial = false; return; }
      untracked(() => this.searchChanged());
    });
  }
  get monsters(): Companion[] { return this.selectedType === 'object' ? this.sheet().objects ?? [] : this.sheet().monsters ?? []; }
  get filteredMonsters() { return rankSearchResults(this.monsters.filter(monster => (monster.name ?? '').toLowerCase().includes(this.listSearch.trim().toLowerCase())), this.listSearch, monster => monster.name ?? ''); }
  ngOnInit() { void this.refreshContent(); }
  ngOnDestroy() { this.catalog.dispose(); }
  change() { this.combatIndex.clear(); this.view.markForCheck(); this.edited.emit(); }
  toggle(monster: Companion) { this.expanded.has(monster) ? this.expanded.delete(monster) : this.expanded.add(monster); }
  openCatalog() { this.catalogAdded = 0; this.catalogOpen = true; }
  private query(): CatalogQuery {
    const books = this.books.selected();
    return { kinds: [this.selectedType], search: this.search, includes: record => this.books.allows(record.publication, books) };
  }
  refreshContent() { return this.catalog.refresh(`Import game data to browse ${this.label.toLowerCase()}. Your saved companions remain editable.`, () => this.query()); }
  searchChanged() { this.catalog.scheduleSearch(() => this.query()); }
  nextPage(direction: number) { void this.catalog.nextPage(direction, this.query()); }
  hasExisting(record: ContentRecord) {
    return this.membership.has(this.monsters, catalogEntryKeys, JSON.stringify(['key', record.key]))
      || this.membership.has(this.monsters, catalogEntryKeys, JSON.stringify(['name', record.name, record.publication]));
  }
  preview(record: ContentRecord): Companion {
    let monster = this.previews.get(record);
    if (!monster) {
      const revision = this.catalog.revision();
      if (!revision) return { name: record.name };
      monster = record.kind === 'object' ? createObjectEntry(record, revision) : createMonsterEntry(record, revision);
      this.previews.set(record, monster);
    }
    return monster;
  }
  add(record: ContentRecord) {
    const revision = this.catalog.revision();
    if (!revision || record.kind !== this.selectedType) return;
    if (record.kind === 'object') (this.sheet().objects ??= []).push(createObjectEntry(record, revision));
    else (this.sheet().monsters ??= []).push(createMonsterEntry(record, revision));
    this.catalogAdded++; this.change();
  }
  addCustom() {
    const name = this.customName.trim(); if (!name) return;
    if (this.selectedType === 'object') {
      const object: import('../models/companions').ObjectCompanion = { kind: 'object', editorId: newEditorId(), name, source: 'Custom', userAdded: true, hitPoints: { enabled: false }, notes: [], uses: [] };
      (this.sheet().objects ??= []).push(object); this.expanded.add(object);
      this.customName = ''; this.catalogAdded++; this.change(); return;
    }
    const monster: Monster = { editorId: newEditorId(), name, source: 'Custom', userAdded: true,
      entity: { name, source: 'Custom' }, notes: [], uses: [], hpEnabled: false };
    (this.sheet().monsters ??= []).push(monster); this.expanded.add(monster);
    this.customName = ''; this.catalogAdded++; this.change();
  }
  remove(monster: Companion) {
    if (monster.notes?.length || monster.uses?.length) { this.pendingRemoval = monster; this.view.markForCheck(); }
    else this.deleteMonster(monster);
  }
  confirmRemoval() {
    const monster = this.pendingRemoval; this.pendingRemoval = undefined;
    if (monster) this.deleteMonster(monster);
  }
  private deleteMonster(monster: Companion) {
    const entries: Companion[] = isObjectCompanion(monster) ? this.sheet().objects ?? [] : this.sheet().monsters ?? [];
    const index = entries.indexOf(monster); if (index < 0) return;
    entries.splice(index, 1); this.expanded.delete(monster); this.change();
  }
}
