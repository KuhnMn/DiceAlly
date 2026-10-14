import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IndexedDbContentCache } from '../content/content-cache';
import { SourceBookFilterService } from './source-book-filter.service';

@Component({
  selector: 'app-source-book-filter',
  imports: [FormsModule],
  templateUrl: './source-book-filter.component.html',
  styleUrl: './local-editor.component.css',
})
export class SourceBookFilterComponent implements OnInit {
  readonly filter = inject(SourceBookFilterService);
  readonly books = signal<string[]>([]);
  readonly loading = signal(false);
  readonly error = signal('');
  private readonly cache = new IndexedDbContentCache();
  private refreshTask?: Promise<void>;
  search = '';
  get visibleBooks() {
    const query = this.search.trim().toLowerCase();
    return [...new Set([...this.books(), ...this.filter.selected()])].sort().filter(book => book.toLowerCase().includes(query));
  }
  async ngOnInit() { await this.refresh(); }
  refresh(): Promise<void> {
    return this.refreshTask ??= this.loadBooks().finally(() => { this.refreshTask = undefined; });
  }
  private async loadBooks() {
    this.loading.set(true); this.error.set('');
    try {
      const source = await this.cache.savedSource('development-local');
      const revision = source ? await this.cache.active('development-local', source)
        : (await this.cache.revisions('development-local')).find(row => row.active && row.revision.status === 'ready')?.revision;
      const books = new Set<string>();
      if (revision) await this.cache.visit(revision.id, async record => { if (record.publication) books.add(record.publication); });
      this.books.set([...books].sort());
    } catch (error) { this.error.set(String(error)); }
    finally { this.loading.set(false); }
  }
}
