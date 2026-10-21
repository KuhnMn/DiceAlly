import { ContentCache } from './content-cache';
import { mapContent } from './content-adapter';
import { ADAPTER_VERSION, ContentSource, HomebrewFile, ImportDiagnostic, ImportProgress, ImportRevision, object, sourceIdentity, validateSource } from './content.model';
import { FetchContent, fetchContent, rawUrl, resolveCommit } from './github-source';
import { discoverFiles } from './content-discovery';
import { finalizeContentImport } from './content-finalizer';
import { stageHomebrewFiles } from './homebrew-package';
import { validateCoreDocument } from './content-schema';
import { CONTENT_SCHEMA_ID } from './generated/schema-version';
export { ContentImportError } from './content-finalizer';

export interface ImportOptions {
  namespace: string;
  source: ContentSource;
  homebrewFiles?: HomebrewFile[];
  signal?: AbortSignal;
  progress?: (progress: ImportProgress) => void;
}
export async function importContent(cache: ContentCache, options: ImportOptions, fetcher: FetchContent = fetchContent): Promise<ImportRevision> {
  const started = performance.now();
  const source = validateSource(options.source);
  const signal = options.signal;
  let bytes = 0, count = 0;
  const diagnostics: ImportDiagnostic[] = [];
  const report = (phase: ImportProgress['phase'], completed = 0, total = 0, file?: string) =>
    options.progress?.({ phase, completed, total, file, bytes, records: count });
  signal?.throwIfAborted();
  report('resolve');
  const commit = await resolveCommit(source, fetcher, signal);
  report('discover');
  const discovery = await discoverFiles(source, commit, fetcher, signal);
  bytes += discovery.bytes;
  const revision: ImportRevision = {
    id: crypto.randomUUID(), namespace: options.namespace, source, sourceIdentity: sourceIdentity(source), commit,
    adapterVersion: ADAPTER_VERSION, createdAt: new Date().toISOString(), status: 'staging',
    schemaSnapshot: CONTENT_SCHEMA_ID,
    files: discovery.files, diagnostics, metrics: { bytes: 0, records: 0, elapsedMs: 0, mappedBytes: 0 },
  };
  await cache.stage(revision);
  try {
    let overlay: unknown;
    // A single file in memory at a time. Parsing, mapping and database writes occur in the worker.
    for (const [index, file] of discovery.files.entries()) {
      signal?.throwIfAborted();
      report('download', index, discovery.files.length, file);
      const result = await fetcher(rawUrl(source, commit, file), signal);
      bytes += result.bytes;
      await validateCoreDocument(result.value, file);
      if (file === 'spells/sources.json') { overlay = result.value; continue; }
      const mapped = mapContent(result.value, file);
      diagnostics.push(...mapped.diagnostics);
      // A key collision across files must not silently overwrite records.
      const seen = new Set<string>();
      for (const record of mapped.records) {
        if (seen.has(record.key) || await cache.get(revision.id, record.key)) {
          diagnostics.push({ severity: 'error', file, record: record.key, message: 'Duplicate logical content identity.' });
        }
        seen.add(record.key);
      }
      for (let start = 0; start < mapped.records.length; start += 128) {
        signal?.throwIfAborted();
        const batch = mapped.records.slice(start, start + 128);
        await cache.put(revision.id, batch);
      }
      count += mapped.records.length;
    }
    revision.metrics.records = count;
    if (!object(overlay)) throw new Error('Invalid spells/sources.json overlay.');
    await stageHomebrewFiles(cache, revision, options.homebrewFiles ?? [], signal);
    let needsTemplates = false;
    await cache.visit(revision.id, async record => {
      if (object(record.data['_copy'])?.['_templates'] !== undefined) needsTemplates = true;
    });
    if (needsTemplates) {
      const file = 'bestiary/template.json';
      report('download', discovery.files.length, discovery.files.length + 1, file);
      const result = await fetcher(rawUrl(source, commit, file), signal);
      bytes += result.bytes;
      await validateCoreDocument(result.value, file);
      const mapped = mapContent(result.value, file);
      diagnostics.push(...mapped.diagnostics);
      const seen = new Set<string>();
      for (const record of mapped.records) {
        if (record.kind !== 'monsterTemplate') continue;
        if (seen.has(record.key)) throw new Error(`Duplicate template identity: ${record.key}`);
        seen.add(record.key);
      }
      const templates = mapped.records.filter(record => record.kind === 'monsterTemplate');
      if (!templates.length) throw new Error('bestiary/template.json has no monster templates.');
      await cache.put(revision.id, templates);
      revision.metrics.records += templates.length;
      revision.files.push(file);
    }
    return await finalizeContentImport(cache, revision, {
      signal, progress: options.progress, overlay, bytes, started,
    });
  } catch (error) {
    await cache.discard(revision.id).catch(() => undefined);
    throw error;
  }
}
