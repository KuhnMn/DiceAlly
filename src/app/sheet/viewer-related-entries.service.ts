import { Injectable } from '@angular/core';
import { IndexedDbContentCache } from '../content/content-cache';
import { ContentRecord, ImportRevision } from '../content/content.model';
import { ContentReference } from '../models/character.model';
import { activeContentRevision } from '../editor/active-content-revision';
import { loadRelatedEntries } from '../compendium/related-entries';

export interface ViewerRelatedEntries {
  revision: ImportRevision;
  record: ContentRecord;
  related: ContentRecord[];
}

/** Optional local-library enrichment. Never changes a character or downloads content. */
@Injectable({ providedIn: 'root' })
export class ViewerRelatedEntriesService {
  private readonly cache = new IndexedDbContentCache();

  async load(reference: ContentReference, isCurrent: () => boolean): Promise<ViewerRelatedEntries | null> {
    const active = await activeContentRevision(this.cache);
    const available = active?.sourceIdentity === reference.sourceIdentity ? []
      : (await this.cache.revisions('development-local')).filter(row => row.revision.sourceIdentity === reference.sourceIdentity
        && row.revision.status === 'ready');
    const revision = active?.sourceIdentity === reference.sourceIdentity ? active
      : (available.find(row => row.active) ?? available.find(row => row.revision.id === reference.revisionId))?.revision;
    if (!revision || !isCurrent()) return null;
    const record = await this.cache.get(revision.id, reference.key);
    if (!record || !isCurrent()) return null;
    return this.open(record, revision, isCurrent);
  }

  async open(record: ContentRecord, revision: ImportRevision, isCurrent: () => boolean): Promise<ViewerRelatedEntries> {
    const related = await loadRelatedEntries(this.cache, revision.id, record, isCurrent);
    return { record, revision, related };
  }
}
