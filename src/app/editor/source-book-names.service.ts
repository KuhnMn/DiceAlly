import { Injectable, signal } from '@angular/core';
import { ImportRevision, object, string } from '../content/content.model';
import { IndexedDbContentCache } from '../content/content-cache';
import { SOURCE_PUBLICATION_NAMES } from '../content/source-publication-names';
import { activeContentRevision } from './active-content-revision';

/** Publication titles are presentation metadata; selection continues to use source IDs. */
@Injectable({ providedIn: 'root' })
export class SourceBookNamesService {
  private readonly importedNames = signal<Readonly<Record<string, string>>>({});
  private refreshTask?: Promise<void>;

  fullName(source: string): string {
    const key = source.trim().toLowerCase();
    return this.importedNames()[key] ?? SOURCE_PUBLICATION_NAMES[key] ?? '';
  }

  searchText(source: string): string { return `${source} ${this.fullName(source)}`; }

  setRevision(revision: Pick<ImportRevision, 'homebrewFiles'> | undefined): void {
    const names: Record<string, string> = {};
    for (const file of revision?.homebrewFiles ?? []) {
      const sources = object(file.document['_meta'])?.['sources'];
      if (!Array.isArray(sources)) continue;
      for (const value of sources) {
        const source = object(value);
        const id = string(source?.['json']).trim().toLowerCase();
        const full = string(source?.['full']).trim();
        if (id && full) names[id] = full;
      }
    }
    this.importedNames.set(names);
  }

  refresh(): Promise<void> {
    return this.refreshTask ??= activeContentRevision(new IndexedDbContentCache())
      .then(revision => this.setRevision(revision))
      .catch(() => { /* Optional titles must not prevent source selection. */ })
      .finally(() => { this.refreshTask = undefined; });
  }
}
