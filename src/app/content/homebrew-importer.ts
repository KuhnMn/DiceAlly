import { ContentCache } from './content-cache';
import { ADAPTER_VERSION, ContentSource, HomebrewFile, ImportProgress, ImportRevision, sourceIdentity, validateSource } from './content.model';
import { finalizeContentImport, isHomebrew } from './content-finalizer';
import { stageHomebrewFiles } from './homebrew-package';

export interface HomebrewImportOptions {
  namespace: string;
  source: ContentSource;
  base?: ImportRevision;
  file: HomebrewFile;
  bytes: number;
  signal?: AbortSignal;
  progress?: (progress: ImportProgress) => void;
}

/** Add/update one selected file atomically. The active core and other homebrew files remain installed. */
export async function importHomebrew(cache: ContentCache, options: HomebrewImportOptions): Promise<ImportRevision> {
  const started = performance.now();
  const { base, file, signal } = options;
  const source = validateSource(options.source);
  if (base && (base.namespace !== options.namespace || base.sourceIdentity !== sourceIdentity(source))) {
    throw new Error('The installed revision belongs to a different content library.');
  }
  signal?.throwIfAborted();
  // The same document can be selected as a local file or URL; do not install a second copy.
  if (base?.homebrewFiles?.some(installed => installed.digest === file.digest)) return base;
  const files = [...(base?.homebrewFiles ?? []).filter(existing => existing.id !== file.id), file];
  const revision: ImportRevision = {
    id: crypto.randomUUID(), namespace: options.namespace, source,
    sourceIdentity: sourceIdentity(source), commit: base?.commit ?? file.digest.slice(0, 40),
    adapterVersion: ADAPTER_VERSION, createdAt: new Date().toISOString(), status: 'staging',
    files: (base?.files ?? []).filter(path => !path.startsWith('homebrew/')), diagnostics: [],
    metrics: { bytes: 0, records: 0, elapsedMs: 0, mappedBytes: 0 },
  };
  signal?.throwIfAborted();
  await cache.stage(revision);
  try {
    // Keep installed materialized core records. Replay homebrew raw definitions so updating
    // a file removes obsolete entries and newly installed dependencies can resolve old links.
    if (base) await cache.visit(base.id, async record => {
      signal?.throwIfAborted();
      if (!isHomebrew(record)) {
        await cache.put(revision.id, [record]);
        revision.metrics.records++;
      }
    });
    await stageHomebrewFiles(cache, revision, files, signal);
    return await finalizeContentImport(cache, revision, {
      signal, progress: options.progress, bytes: options.bytes, started, shouldProcess: isHomebrew,
    });
  } catch (error) {
    await cache.discard(revision.id).catch(() => undefined);
    throw error;
  }
}
