import { Injectable, signal } from '@angular/core';
import type { ContentRecord } from '../content/content.model';
import { isReprinted } from '../content/content-visibility';

const STORAGE_KEY = 'ally-creator-source-books';
const REPRINT_STORAGE_KEY = 'ally-hide-reprinted-content';

/** A browsing preference shared by creator catalogs and compendium defaults, independent of the sheet. */
@Injectable({ providedIn: 'root' })
export class SourceBookFilterService {
  readonly selected = signal<string[]>(this.readSelection());
  readonly hideReprinted = signal(this.readHideReprinted());

  isVisible(record: ContentRecord, hideReprinted = this.hideReprinted()) {
    return !hideReprinted || !isReprinted(record);
  }

  allowsRecord(record: ContentRecord, selection: readonly string[] = this.selected()) {
    return this.allows(record.publication, selection) && this.isVisible(record);
  }

  setHideReprinted(hidden: boolean) {
    this.hideReprinted.set(hidden);
    try { localStorage.setItem(REPRINT_STORAGE_KEY, JSON.stringify(hidden)); } catch { /* Memory-only when storage is unavailable. */ }
  }

  allows(book: string, selection: readonly string[] = this.selected()) {
    return !selection.length || selection.includes(book);
  }

  setSelection(books: string[]) {
    const selection = [...new Set(books)].sort();
    this.selected.set(selection);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(selection)); } catch { /* Memory-only when storage is unavailable. */ }
  }

  toggle(book: string) {
    const selected = this.selected();
    this.setSelection(selected.includes(book) ? selected.filter(value => value !== book) : [...selected, book]);
  }

  private readSelection(): string[] {
    try {
      const value: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
      return Array.isArray(value) && value.every(book => typeof book === 'string') ? value : [];
    } catch { return []; }
  }

  private readHideReprinted(): boolean {
    try { return localStorage.getItem(REPRINT_STORAGE_KEY) === 'true'; } catch { return false; }
  }
}
