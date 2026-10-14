import { ContentCache } from './content-cache';
import { inheritCopy } from './content-adapter';
import { ContentRecord, entityKey, ImportDiagnostic, ImportProgress, ImportRevision, object } from './content.model';
import { materializeContent } from './content-materializer';
import { buildReferenceIndex, linkContent } from './content-linker';
import { mergeSpellMemberships } from './spell-membership';

export class ContentImportError extends Error {
  constructor(message: string, readonly diagnostics: ImportDiagnostic[], readonly revision?: ImportRevision) { super(message); }
}
export interface FinalizationOptions {
  signal?: AbortSignal;
  progress?: (progress: ImportProgress) => void;
  overlay?: unknown;
  bytes: number;
  started: number;
  /** Appending homebrew uses the installed core snapshots as dependency inputs, not new definitions. */
  shouldProcess?: (record: ContentRecord) => boolean;
}
export function isHomebrew(record: ContentRecord) { return record.file.startsWith('homebrew/'); }

/** Both full-library and single-file imports share copy resolution, materialization and linking. */
export async function finalizeContentImport(cache: ContentCache, revision: ImportRevision, options: FinalizationOptions) {
  const signal = options.signal;
  const diagnostics = revision.diagnostics;
  const bytes = options.bytes;
  const shouldProcess = options.shouldProcess ?? (() => true);
  const report = (phase: ImportProgress['phase'], completed = 0, total = 0, file?: string) =>
    options.progress?.({ phase, completed, total, file, bytes, records: revision.metrics.records });
  report('link');
  let linked = 0;
  const resolve = async (record: ContentRecord, ancestors = new Set<string>()): Promise<ContentRecord> => {
    signal?.throwIfAborted();
    if (!shouldProcess(record)) return record;
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
    if (++linked % 128 === 0) report('link', linked, revision.metrics.records * 3, record.file);
  });
  report('materialize');
  const materialized = await materializeContent(cache, revision.id, diagnostics, signal,
    (completed, added, file) => options.progress?.({ phase: 'materialize', completed, total: 0, file, bytes, records: revision.metrics.records + added }), shouldProcess);
  revision.metrics.records += materialized.added;
  report('link');
  const referenceIndex = await buildReferenceIndex(cache, revision.id, signal);
  await cache.visit(revision.id, async record => {
    signal?.throwIfAborted();
    try {
      const { links, diagnostics: issues } = linkContent(record, referenceIndex);
      diagnostics.push(...issues.map(issue => isHomebrew(record) && issue.message.startsWith('missing ')
        ? { ...issue, severity: 'warning' as const } : issue));
      await cache.put(revision.id, [{ ...record, links }]);
    } catch (error) { diagnostics.push({ severity: 'error', file: record.file, record: record.key, message: String(error) }); }
    if (++linked % 128 === 0) report('link', linked, revision.metrics.records * 3, record.file);
  });
  // Android secondary spell-source file: publication -> spell name -> class membership data.
  const sources = object(options.overlay ?? {});
  if (!sources) throw new Error('Invalid spells/sources.json overlay.');
  await cache.visit(revision.id, async record => {
    signal?.throwIfAborted();
    if (record.kind === 'spell') {
      const publication = object(sources[record.publication]);
      const memberships = object(publication?.[record.name]);
      if (memberships || record.data['classes']) await cache.put(revision.id, [{ ...record,
        data: { ...record.data, classes: mergeSpellMemberships(record.data['classes'], memberships) } }]);
    }
    if (++linked % 128 === 0) report('link', linked, revision.metrics.records * 3, record.file);
  });

  // Missing external item/species definitions remain visible diagnostics, never trigger downloads.
  for (const issue of diagnostics) {
    if (issue.file.startsWith('homebrew/') && /Missing or ambiguous .* definition:|Item base not found:|Subrace parent not found:/.test(issue.message)) {
      issue.severity = 'warning';
    }
  }
  let mappedBytes = 0;
  let count = 0;
  await cache.visit(revision.id, async record => {
    signal?.throwIfAborted();
    count++;
    mappedBytes += new TextEncoder().encode(JSON.stringify(record)).byteLength;
  });
  revision.metrics = { bytes, records: count, elapsedMs: Math.round(performance.now() - options.started), mappedBytes };
  if (diagnostics.some(issue => issue.severity === 'error')) {
    throw new ContentImportError('Content validation failed. The previous cache is still active.', diagnostics, revision);
  }
  signal?.throwIfAborted();
  revision.status = 'ready';
  await cache.activate(revision, signal);
  report('complete', revision.files.length, revision.files.length);
  return revision;
}
