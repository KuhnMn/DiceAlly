import { IndexedDbContentCache } from '../content/content-cache';
import { ContentRecord } from '../content/content.model';

/** Load only linked records, in bounded batches, stopping when the detail changes. */
export async function loadRelatedEntries(cache: IndexedDbContentCache, revision: string, record: ContentRecord,
  isCurrent: () => boolean): Promise<ContentRecord[]> {
  const keys = [...new Set([...(record.classDefinition?.features.map(feature => feature.key) ?? []),
    ...record.links.filter(link => link.scope !== 'provenance' && link.status !== 'missing').map(link => link.target)])]
    .filter(key => key !== record.key);
  const related: ContentRecord[] = [];
  for (let start = 0; start < keys.length; start += 20) {
    if (!isCurrent()) return [];
    const records = await Promise.all(keys.slice(start, start + 20).map(key => cache.get(revision, key)));
    related.push(...records.filter((value): value is ContentRecord => !!value));
  }
  return related;
}
