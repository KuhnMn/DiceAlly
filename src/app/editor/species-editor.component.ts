import { ChangeDetectorRef, Component, OnDestroy, effect, inject, input, output, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { IndexedDbContentCache } from '../content/content-cache';
import { ContentRecord, ImportRevision, object } from '../content/content.model';
import { ExportedCharacter, Species, SpeciesEntity } from '../models/character.model';
import { EntryRendererComponent } from '../entries/entry-renderer.component';
import { EntryAnnotationsComponent } from './entry-annotations.component';
import { CatalogDialogComponent } from './catalog-dialog.component';
import { SourceBookFilterComponent } from './source-book-filter.component';
import { SourceBookFilterService } from './source-book-filter.service';
import { contentReference } from './wizard-prefill';

@Component({
  selector: 'app-editor-species',
  imports: [FormsModule, RouterLink, EntryRendererComponent, EntryAnnotationsComponent, CatalogDialogComponent, SourceBookFilterComponent],
  templateUrl: './species-editor.component.html',
  styleUrl: './local-editor.component.css',
})
export class SpeciesEditorComponent implements OnDestroy {
  readonly sheet = input.required<ExportedCharacter>();
  readonly edited = output<void>();
  readonly results = signal<ContentRecord[]>([]);
  readonly revision = signal<ImportRevision | null>(null);
  readonly total = signal(0);
  readonly loading = signal(false);
  readonly message = signal('');
  readonly pageSize = 30;
  private readonly cache = new IndexedDbContentCache();
  private readonly books = inject(SourceBookFilterService);
  private readonly view = inject(ChangeDetectorRef);
  private request = 0;
  private refreshRequest = 0;
  private timer?: ReturnType<typeof setTimeout>;
  catalogOpen = false;
  expanded = false;
  search = '';
  offset = 0;
  customName = '';
  customDescription = '';
  constructor() {
    effect(() => {
      this.books.selected();
      untracked(() => { if (this.catalogOpen) this.searchChanged(); });
    });
  }
  get selected() { return this.sheet().species; }
  change() { this.view.markForCheck(); this.edited.emit(); }
  async openCatalog() { this.catalogOpen = true; if (!this.revision()) await this.refreshContent(); }
  ngOnDestroy() { clearTimeout(this.timer); this.request++; this.refreshRequest++; }
  async refreshContent() {
    const request = ++this.refreshRequest; this.loading.set(true);
    try {
      const source = await this.cache.savedSource('development-local');
      const revision = source ? await this.cache.active('development-local', source)
        : (await this.cache.revisions('development-local')).find(row => row.active && row.revision.status === 'ready')?.revision;
      if (request !== this.refreshRequest) return;
      this.revision.set(revision ?? null); this.offset = 0; this.results.set([]); this.total.set(0);
      if (!revision) { this.message.set('Import content to browse species, or create a custom species below.'); return; }
      await this.searchContent();
    } catch (error) { if (request === this.refreshRequest) this.message.set(String(error)); }
    finally { if (request === this.refreshRequest) this.loading.set(false); }
  }
  searchChanged() {
    clearTimeout(this.timer); this.request++; this.offset = 0; this.results.set([]); this.total.set(0);
    this.timer = setTimeout(() => void this.searchContent(), 200);
  }
  async searchContent() {
    const revision = this.revision(); if (!revision) return;
    const request = ++this.request; const books = this.books.selected(); this.loading.set(true);
    try {
      const result = await this.cache.searchCategory(revision.id, ['species'], this.search, this.offset, this.pageSize,
        record => this.books.allows(record.publication, books));
      if (request !== this.request) return;
      this.results.set(result.records); this.total.set(result.total); this.message.set('');
    } catch (error) { if (request === this.request) this.message.set(String(error)); }
    finally { if (request === this.request) this.loading.set(false); }
  }
  nextPage(direction: number) { this.offset = Math.max(0, this.offset + direction * this.pageSize); void this.searchContent(); }
  isSelected(record: ContentRecord) {
    return this.selected?.contentReference
      ? this.selected.contentReference.key === record.key && this.selected.contentReference.revisionId === this.revision()?.id
      : this.selected?.name === record.name && this.selected?.source === record.publication;
  }
  select(record: ContentRecord) {
    const revision = this.revision(); if (!revision || record.kind !== 'species') return;
    const snapshot = structuredClone(record.data);
    const speed = object(snapshot['speed']);
    if (speed) snapshot['speed'] = Object.fromEntries(Object.entries(speed).map(([mode, value]) => [mode, object(value)?.['number'] ?? value]));
    this.replace({ name: record.name, source: record.publication, userAdded: true,
      contentReference: contentReference(record, revision), entity: snapshot as unknown as SpeciesEntity }, record.key);
  }
  private replace(next: Species, key?: string) {
    const previous = this.selected;
    const same = previous?.name === next.name && previous?.source === next.source;
    if (!same && previous && (previous.notes?.length || previous.uses?.length)
      && !confirm(`Replace ${previous.name} and remove its notes and use settings?`)) return;
    next.notes = same ? structuredClone(previous?.notes ?? []) : [];
    next.uses = same ? structuredClone(previous?.uses ?? []) : [];
    this.sheet().species = next;
    if (this.sheet().creatorWizard) this.sheet().creatorWizard!.speciesKey = key;
    this.catalogOpen = false; this.expanded = true; this.change();
  }
  addCustom() {
    const name = this.customName.trim(); if (!name) return;
    this.replace({ name, source: 'Custom', userAdded: true,
      entity: { name, source: 'Custom', entries: this.customDescription ? [{ text: this.customDescription }] : [] } });
    if (!this.catalogOpen) { this.customName = ''; this.customDescription = ''; }
  }
  remove() {
    const selected = this.selected; if (!selected) return;
    if ((selected.notes?.length || selected.uses?.length) && !confirm(`Remove ${selected.name} and its notes and use settings?`)) return;
    this.sheet().species = undefined;
    if (this.sheet().creatorWizard) this.sheet().creatorWizard!.speciesKey = undefined;
    this.expanded = false; this.change();
  }
}
