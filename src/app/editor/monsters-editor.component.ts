import { CombatBookmarkComponent } from './combat-bookmark.component';
import { UiIconComponent } from '../ui-icon.component';
import { ChangeDetectorRef, Component, OnDestroy, OnInit, effect, inject, input, output, untracked } from '@angular/core';
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
  selector: 'app-editor-monsters',
  imports: [CombatBookmarkComponent, UiIconComponent, FormsModule, RouterLink, CatalogDialogComponent, RemoveEntryDialogComponent, EntryAnnotationsComponent, MonsterStatBlockComponent, SourceBookFilterComponent],
  templateUrl: './monsters-editor.component.html', styleUrl: './local-editor.component.css',
})
export class MonstersEditorComponent implements OnInit, OnDestroy {
  readonly sheet = input.required<ExportedCharacter>();
  readonly edited = output<void>();
  readonly catalog = new EditorCatalog(new IndexedDbContentCache());
  private readonly books = inject(SourceBookFilterService);
  private readonly view = inject(ChangeDetectorRef);
  readonly expanded = new Set<Monster>();
  private readonly previews = new WeakMap<ContentRecord, Monster>();
  catalogOpen = false;
  listVisible = true;
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
  ngOnInit() { void this.refreshContent(); }
  ngOnDestroy() { this.catalog.dispose(); }
  change() { this.view.markForCheck(); this.edited.emit(); }
  toggle(monster: Monster) { this.expanded.has(monster) ? this.expanded.delete(monster) : this.expanded.add(monster); }
  openCatalog() { this.catalogAdded = 0; this.catalogOpen = true; }
  private query(): CatalogQuery {
    const books = this.books.selected();
    return { kinds: ['monster'], search: this.search, includes: record => this.books.allows(record.publication, books) };
  }
  refreshContent() { return this.catalog.refresh('Import game data to browse monsters. Your saved companions remain editable.', () => this.query()); }
  searchChanged() { this.catalog.scheduleSearch(() => this.query()); }
  nextPage(direction: number) { void this.catalog.nextPage(direction, this.query()); }
  isSelected(record: ContentRecord) {
    return this.monsters.some(monster => monster.contentReference?.key === record.key
      || (!monster.contentReference && monster.name === record.name && monster.source === record.publication));
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
    if (!revision || record.kind !== 'monster' || this.isSelected(record)) return;
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
