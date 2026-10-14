import { IndexedDbContentCache } from '../content/content-cache';
import { ImportRevision } from '../content/content.model';

/** Respect the selected content source; use an active ready import when none has been selected. */
export async function activeContentRevision(cache: IndexedDbContentCache): Promise<ImportRevision | undefined> {
  const namespace = 'development-local';
  const source = await cache.savedSource(namespace);
  if (source) return cache.active(namespace, source);
  return (await cache.revisions(namespace))
    .find(row => row.active && row.revision.status === 'ready')?.revision;
}
