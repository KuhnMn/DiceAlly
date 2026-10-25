import type { ContentCache } from './content-cache';
import type { ContentRecord } from './content.model';
import { classDefinition } from './class-adapter';
import { recordFacets, type Filters } from '../compendium/compendium-catalog';

export const BROWSE_SUMMARY_VERSION = 1;
/** Small, revision-bound browsing indexes. No descriptions or character state. */
export interface ContentBrowseSummary {
  version: typeof BROWSE_SUMMARY_VERSION;
  revisionId: string;
  counts: Record<string, number>;
  sources: string[];
  facets: Record<string, Filters>;
  subclassSources: Record<string, string[]>;
}

export class BrowseSummaryBuilder {
  private readonly counts: Record<string, number> = {};
  private readonly sources = new Set<string>();
  private readonly facets = new Map<string, Map<string, Set<string>>>();
  private readonly subclasses = new Map<string, Set<string>>();
  constructor(private readonly revisionId: string) {}
  add(record: ContentRecord) {
    this.counts[record.kind] = (this.counts[record.kind] ?? 0) + 1;
    if (record.publication) this.sources.add(record.publication);
    let facets = this.facets.get(record.kind);
    if (!facets) { facets = new Map(); this.facets.set(record.kind, facets); }
    for (const [key, values] of Object.entries(recordFacets(record))) {
      if (!facets.has(key)) facets.set(key, new Set());
      for (const value of values ?? []) facets.get(key)!.add(value);
    }
    if (record.kind === 'subclass') {
      const parent = classDefinition(record).parent?.key;
      if (parent) {
        if (!this.subclasses.has(parent)) this.subclasses.set(parent, new Set());
        this.subclasses.get(parent)!.add(record.publication);
      }
    }
  }
  build(): ContentBrowseSummary {
    return { version: BROWSE_SUMMARY_VERSION, revisionId: this.revisionId, counts: { ...this.counts }, sources: [...this.sources].sort(),
      facets: Object.fromEntries([...this.facets].map(([kind, fields]) => [kind, Object.fromEntries([...fields].map(([key, values]) => [key, [...values].sort()]))])),
      subclassSources: Object.fromEntries([...this.subclasses].map(([parent, books]) => [parent, [...books].sort()])) };
  }
}

export async function readBrowseSummary(cache: ContentCache, revisionId: string): Promise<ContentBrowseSummary | undefined> {
  try {
    const summary = await cache.getBrowseSummary?.(revisionId);
    return summary?.version === BROWSE_SUMMARY_VERSION && summary.revisionId === revisionId ? summary : undefined;
  } catch { return undefined; } // Optional metadata must never block category reads.
}

// The overview and source selector share one backfill, including across component instances.
const pending = new Map<string, Promise<ContentBrowseSummary>>();
export function ensureBrowseSummary(cache: ContentCache, revisionId: string): Promise<ContentBrowseSummary> {
  const existing = pending.get(revisionId); if (existing) return existing;
  const task = (async () => {
    const stored = await readBrowseSummary(cache, revisionId); if (stored) return stored;
    const builder = new BrowseSummaryBuilder(revisionId);
    await cache.visit(revisionId, async record => { builder.add(record); });
    const summary = builder.build();
    await cache.saveBrowseSummary?.(revisionId, summary);
    return summary;
  })();
  pending.set(revisionId, task);
  void task.finally(() => { if (pending.get(revisionId) === task) pending.delete(revisionId); }).catch(() => {});
  return task;
}
