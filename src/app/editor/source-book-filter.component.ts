import { rankSearchResults } from '../search-ranking';
import { UiIconComponent } from '../ui-icon.component';
import { Component, OnInit, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IndexedDbContentCache } from '../content/content-cache';
import { SourceBookFilterService } from './source-book-filter.service';
import { activeContentRevision } from './active-content-revision';

@Component({
  selector: 'app-source-book-filter',
  imports: [UiIconComponent, FormsModule],
  templateUrl: './source-book-filter.component.html',
  styleUrl: './editor.css',
})
export class SourceBookFilterComponent implements OnInit {
  readonly heading = input('Source Books');
  readonly description = input('Filter the creator’s classes, species, features, spells and tools by book. These books also become the default filters in the compendium. No selection includes all books. Already added entries stay visible.');
  readonly filter = inject(SourceBookFilterService);
  readonly books = signal<string[]>([]);
  readonly loading = signal(false);
  readonly error = signal('');
  private readonly cache = new IndexedDbContentCache();
  private refreshTask?: Promise<void>;
  search = '';
  get visibleBooks() {
    const query = this.search.trim().toLowerCase();
    return rankSearchResults([...new Set([...this.books(), ...this.filter.selected()])].sort().filter(book => book.toLowerCase().includes(query)), query, book => book);
  }
  async ngOnInit() { await this.refresh(); }
  refresh(): Promise<void> {
    return this.refreshTask ??= this.loadBooks().finally(() => { this.refreshTask = undefined; });
  }
  private async loadBooks() {
    this.loading.set(true); this.error.set('');
    try {
      const revision = await activeContentRevision(this.cache);
      const books = new Set<string>();
      if (revision) await this.cache.visit(revision.id, async record => { if (record.publication) books.add(record.publication); });
      this.books.set([...books].sort());
    } catch (error) { this.error.set(String(error)); }
    finally { this.loading.set(false); }
  }
}
