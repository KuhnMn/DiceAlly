import { ContentCache } from './content-cache';
import { ContentLink, ContentRecord } from './content.model';

export interface DependencySnapshot {
  revisionId: string;
  roots: string[];
  records: ContentRecord[];
  unresolved: { from: string; link: ContentLink }[];
}
/** Load only the chosen dependency graph; selectors are interpreted by the future rules engine. */
export async function collectDependencies(cache: Pick<ContentCache, 'get'>, revisionId: string, roots: string[], options: {
  signal?: AbortSignal;
  maxRecords?: number;
  includeDescriptions?: boolean;
  follow?: (link: ContentLink, record: ContentRecord) => boolean;
} = {}): Promise<DependencySnapshot> {
  const limit = options.maxRecords ?? 1000;
  if (!Number.isInteger(limit) || limit < 1) throw new Error('Invalid dependency limit.');
  const queue = [...new Set(roots)];
  const seen = new Set<string>();
  const records: ContentRecord[] = [];
  const unresolved: DependencySnapshot['unresolved'] = [];
  for (let position = 0; position < queue.length; position++) {
    options.signal?.throwIfAborted();
    const key = queue[position];
    if (seen.has(key)) continue;
    seen.add(key);
    if (seen.size > limit) throw new Error(`Character dependency graph exceeds ${limit} records.`);
    const record = await cache.get(revisionId, key);
    if (!record) throw new Error(`Selected dependency is missing: ${key}`);
    records.push(structuredClone(record));
    for (const link of record.links) {
      const follow = options.follow ? options.follow(link, record)
        : link.scope !== 'catalog' && (link.scope !== 'description' || options.includeDescriptions === true);
      if (!follow) continue;
      if (link.status && link.status !== 'resolved') {
        unresolved.push({ from: key, link: structuredClone(link) });
        if (link.required !== false) throw new Error(`Required character dependency is ${link.status}: ${link.target}`);
        continue;
      }
      const dependency = await cache.get(revisionId, link.target);
      if (!dependency) {
        unresolved.push({ from: key, link: structuredClone(link) });
        if (link.required !== false) throw new Error(`Required character dependency is missing: ${link.target}`);
      } else if (!seen.has(link.target)) queue.push(link.target);
    }
  }
  return { revisionId, roots: [...new Set(roots)], records, unresolved };
}
