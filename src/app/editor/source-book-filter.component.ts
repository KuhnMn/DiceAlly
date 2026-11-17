import { ensureBrowseSummary } from '../content/content-browse-summary';
import { rankSearchResults } from '../search-ranking';
import { UiIconComponent } from '../ui-icon.component';
import { Component, OnInit, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IndexedDbContentCache } from '../content/content-cache';
import { SourceBookFilterService } from './source-book-filter.service';
import { activeContentRevision } from './active-content-revision';
import { SourceBookNamesService } from './source-book-names.service';
import { SourceBookOptionComponent } from './source-book-option.component';

@Component({
  selector: 'app-source-book-filter',
  imports: [UiIconComponent, FormsModule, SourceBookOptionComponent],
  templateUrl: './source-book-filter.component.html',
  styleUrls: ['./editor.css', './editor-selectors.css'],
})
export class SourceBookFilterComponent implements OnInit {
  readonly heading = input('Source Books');
  readonly description = input('Filter the creator’s classes, species, features, spells and tools by book. New compendium categories start with these books, then remember their own filters. No selection includes all books. Already added entries stay visible.');
  readonly filter = inject(SourceBookFilterService);
  readonly names = inject(SourceBookNamesService);
  readonly books = signal<string[]>([]);
  readonly loading = signal(false);
  readonly error = signal('');
  private readonly cache = new IndexedDbContentCache();
  private refreshTask?: Promise<void>;
  search = '';
  get visibleBooks() {
    const query = this.search.trim().toLowerCase();
    return rankSearchResults([...new Set([...this.books(), ...this.filter.selected()])].sort()
      .filter(book => this.names.searchText(book).toLowerCase().includes(query)), query, book => this.names.searchText(book));
  }
  async ngOnInit() { await this.refresh(); }
  refresh(): Promise<void> {
    return this.refreshTask ??= this.loadBooks().finally(() => { this.refreshTask = undefined; });
  }
  private async loadBooks() {
    this.loading.set(true); this.error.set('');
    try {
      const revision = await activeContentRevision(this.cache);
      this.names.setRevision(revision);
      this.books.set(revision ? (await ensureBrowseSummary(this.cache, revision.id)).sources : []);
    } catch (error) { this.error.set(String(error)); }
    finally { this.loading.set(false); }
  }
}
