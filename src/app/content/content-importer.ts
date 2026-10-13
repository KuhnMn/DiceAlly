import { ContentCache } from './content-cache';
import { inheritCopy, mapContent } from './content-adapter';
import { ADAPTER_VERSION, ContentRecord, ContentSource, entityKey, ImportDiagnostic, ImportProgress, ImportRevision, object, sourceIdentity, validateSource } from './content.model';
import { discoverFiles, FetchContent, fetchContent, rawUrl, resolveCommit } from './github-source';
import { materializeContent } from './content-materializer';
import { buildReferenceIndex, linkContent } from './content-linker';

export interface ImportOptions {
  namespace: string;
  source: ContentSource;
  signal?: AbortSignal;
  progress?: (progress: ImportProgress) => void;
}
export class ContentImportError extends Error {
  constructor(message: string, readonly diagnostics: ImportDiagnostic[], readonly revision?: ImportRevision) { super(message); }
}
export async function importContent(cache: ContentCache, options: ImportOptions, fetcher: FetchContent = fetchContent): Promise<ImportRevision> {
  const started = performance.now();
  const source = validateSource(options.source);
  const signal = options.signal;
  let bytes = 0, count = 0, mappedBytes = 0;
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
        mappedBytes += new TextEncoder().encode(JSON.stringify(batch)).byteLength;
        await cache.put(revision.id, batch);
      }
      count += mapped.records.length;
    }
    let needsTemplates = false;
    await cache.visit(revision.id, async record => {
      if (object(record.data['_copy'])?.['_templates'] !== undefined) needsTemplates = true;
    });
    if (needsTemplates) {
      const file = 'bestiary/template.json';
      report('download', discovery.files.length, discovery.files.length + 1, file);
      const result = await fetcher(rawUrl(source, commit, file), signal);
      bytes += result.bytes;
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
      count += templates.length;
      mappedBytes += new TextEncoder().encode(JSON.stringify(templates)).byteLength;
      revision.files.push(file);
    }
    report('link');
    let linked = 0;
    const resolve = async (record: ContentRecord, ancestors = new Set<string>()): Promise<ContentRecord> => {
      signal?.throwIfAborted();
      const copy = object(record.data['_copy']);
      if (!copy) return record;
      if (ancestors.has(record.key)) throw new Error('Cyclic copy inheritance.');
      ancestors.add(record.key);
      const key = entityKey(record.kind, { ...record.data, ...copy });
      const base = await cache.get(revision.id, key);
      if (!base) throw new Error(`Copy base not found: ${key}`);
      const inherited = await resolve(base, ancestors);
      const templates = [];
      const refs = copy['_templates'];
      if (refs !== undefined && !Array.isArray(refs)) throw new Error('Copy templates must be an array.');
      for (const value of (refs as unknown[] | undefined) ?? []) {
        const ref = object(value);
        if (!ref) throw new Error('Invalid copy template reference.');
        const templateKey = entityKey('monsterTemplate', ref);
        const template = await cache.get(revision.id, templateKey);
        if (!template) throw new Error(`Copy template not found: ${templateKey}`);
        templates.push((await resolve(template, new Set(ancestors))).data);
      }
      const updated = { ...record, data: inheritCopy(inherited.data, record.data, templates, record.kind) };
      await cache.put(revision.id, [updated]);
      return updated;
    };
    await cache.visit(revision.id, async record => {
      try { await resolve(record); }
      catch (error) {
        signal?.throwIfAborted();
        diagnostics.push({ severity: 'error', file: record.file, record: record.key, message: String(error) });
      }
      if (++linked % 128 === 0) report('link', linked, count * 3, record.file);
    });
    report('materialize');
    const materialized = await materializeContent(cache, revision.id, diagnostics, signal,
      (completed, added, file) => options.progress?.({ phase: 'materialize', completed, total: 0, file, bytes, records: count + added }));
    count += materialized.added;
    report('link');
    const referenceIndex = await buildReferenceIndex(cache, revision.id, signal);
    await cache.visit(revision.id, async record => {
      signal?.throwIfAborted();
      try {
        const { links, diagnostics: issues } = linkContent(record, referenceIndex);
        diagnostics.push(...issues);
        await cache.put(revision.id, [{ ...record, links }]);
      } catch (error) { diagnostics.push({ severity: 'error', file: record.file, record: record.key, message: String(error) }); }
      if (++linked % 128 === 0) report('link', linked, count * 3, record.file);
    });
    // Android secondary spell-source file: publication -> spell name -> class membership data.
    const sources = object(overlay);
    if (!sources) throw new Error('Invalid spells/sources.json overlay.');
    await cache.visit(revision.id, async record => {
      signal?.throwIfAborted();
      if (record.kind === 'spell') {
        const publication = object(sources[record.publication]);
        const memberships = object(publication?.[record.name]);
        if (memberships) await cache.put(revision.id, [{ ...record, data: { ...record.data, classes: memberships } }]);
      }
      if (++linked % 128 === 0) report('link', linked, count * 3, record.file);
    });
    // Measure persisted materialized records rather than only the raw input projection.
    mappedBytes = 0;
    let storedRecords = 0;
    await cache.visit(revision.id, async record => {
      signal?.throwIfAborted();
      storedRecords++;
      mappedBytes += new TextEncoder().encode(JSON.stringify(record)).byteLength;
    });
    count = storedRecords;
    revision.metrics = { bytes, records: count, elapsedMs: Math.round(performance.now() - started), mappedBytes };
    if (diagnostics.some(d => d.severity === 'error')) {
      throw new ContentImportError('Content validation failed. The previous cache is still active.', diagnostics, revision);
    }
    signal?.throwIfAborted();
    revision.status = 'ready';
    await cache.activate(revision, signal);
    report('complete', discovery.files.length, discovery.files.length);
    return revision;
  } catch (error) {
    await cache.discard(revision.id).catch(() => undefined);
    throw error;
  }
}
