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
import { MonsterStatBlockComponent } from '../sheet/monster-stat-block.component';
import { SourceBookFilterComponent } from './source-book-filter.component';
import { SourceBookFilterService } from './source-book-filter.service';
import { newEditorId } from './editor-identity';
import { createMonsterEntry, setMonsterMaxHp } from './monster-selection';

@Component({
  providers: [EditorCombatIndex],
  selector: 'app-editor-monsters',
  imports: [EditorEntryRowComponent, CatalogResultRowComponent, ListControlsComponent, EditorListHeaderComponent, DescriptionDialogComponent, CombatBookmarkComponent, UiIconComponent, FormsModule, RouterLink, CatalogDialogComponent, RemoveEntryDialogComponent, EntryAnnotationsComponent, MonsterStatBlockComponent, SourceBookFilterComponent],
  templateUrl: './monsters-editor.component.html', styleUrl: './editor.css',
})
export class MonstersEditorComponent implements OnInit, OnDestroy, DoCheck {
  catalogHp(record: ContentRecord): number | string {
    const hp = monsterDefinition(record).hp;
    return hp && 'average' in hp ? hp.average : 'Special';
  }
  private readonly combatIndex = inject(EditorCombatIndex);
  readonly sheet = input.required<ExportedCharacter>();
  private readonly membership = new CatalogMembershipIndex<Monster>();
  ngDoCheck() { this.combatIndex.clear(); this.membership.clear(); }
  readonly edited = output<void>();
  readonly catalog = new EditorCatalog(new IndexedDbContentCache());
  readonly books = inject(SourceBookFilterService);
  private readonly view = inject(ChangeDetectorRef);
  readonly expanded = new Set<Monster>();
  private readonly previews = new WeakMap<ContentRecord, Monster>();
  catalogOpen = false;
  listVisible = true;
  listSearch = '';
  catalogAdded = 0;
  search = '';
  customName = '';
  pendingRemoval?: Monster;
  setMaxHp(monster: Monster, value: number | null) { setMonsterMaxHp(monster, value); this.change(); }

  constructor() {
    let initial = true;
    effect(() => {
      this.books.selected();
      if (initial) { initial = false; return; }
      untracked(() => this.searchChanged());
    });
  }
  get monsters() { return this.sheet().monsters ?? []; }
  get filteredMonsters() { return rankSearchResults(this.monsters.filter(monster => (monster.name ?? '').toLowerCase().includes(this.listSearch.trim().toLowerCase())), this.listSearch, monster => monster.name ?? ''); }
  ngOnInit() { void this.refreshContent(); }
  ngOnDestroy() { this.catalog.dispose(); }
  change() { this.combatIndex.clear(); this.view.markForCheck(); this.edited.emit(); }
  toggle(monster: Monster) { this.expanded.has(monster) ? this.expanded.delete(monster) : this.expanded.add(monster); }
  openCatalog() { this.catalogAdded = 0; this.catalogOpen = true; }
  private query(): CatalogQuery {
    const books = this.books.selected();
    return { kinds: ['monster'], search: this.search, includes: record => this.books.allows(record.publication, books) };
  }
  refreshContent() { return this.catalog.refresh('Import game data to browse monsters. Your saved companions remain editable.', () => this.query()); }
  searchChanged() { this.catalog.scheduleSearch(() => this.query()); }
  nextPage(direction: number) { void this.catalog.nextPage(direction, this.query()); }
  hasExisting(record: ContentRecord) {
    return this.membership.has(this.monsters, catalogEntryKeys, JSON.stringify(['key', record.key]))
      || this.membership.has(this.monsters, catalogEntryKeys, JSON.stringify(['name', record.name, record.publication]));
  }
  preview(record: ContentRecord): Monster {
    let monster = this.previews.get(record);
    if (!monster) {
      const revision = this.catalog.revision();
      if (!revision) return { name: record.name };
      monster = createMonsterEntry(record, revision);
      this.previews.set(record, monster);
    }
    return monster;
  }
  add(record: ContentRecord) {
    const revision = this.catalog.revision();
    if (!revision || record.kind !== 'monster') return;
    (this.sheet().monsters ??= []).push(createMonsterEntry(record, revision));
    this.catalogAdded++; this.change();
  }
  addCustom() {
    const name = this.customName.trim(); if (!name) return;
    const monster: Monster = { editorId: newEditorId(), name, source: 'Custom', userAdded: true,
      entity: { name, source: 'Custom' }, notes: [], uses: [], hpEnabled: false };
    (this.sheet().monsters ??= []).push(monster); this.expanded.add(monster);
    this.customName = ''; this.catalogAdded++; this.change();
  }
  remove(monster: Monster) {
    if (monster.notes?.length || monster.uses?.length) { this.pendingRemoval = monster; this.view.markForCheck(); }
    else this.deleteMonster(monster);
  }
  confirmRemoval() {
    const monster = this.pendingRemoval; this.pendingRemoval = undefined;
    if (monster) this.deleteMonster(monster);
  }
  private deleteMonster(monster: Monster) {
    const index = this.monsters.indexOf(monster); if (index < 0) return;
    this.sheet().monsters!.splice(index, 1); this.expanded.delete(monster); this.change();
  }
}
