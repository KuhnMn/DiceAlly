import { ContentCache } from './content-cache';
import { mapContent } from './content-adapter';
import { ContentRecord, HomebrewFile, ImportRevision, JsonObject, object, string } from './content.model';

export const MAX_HOMEBREW_BYTES = 32 * 1024 * 1024;

async function digest(text: string): Promise<string> {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(bytes)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

/** File identity is stable across updates; the separate digest identifies the selected contents. */
export async function readHomebrewFile(value: unknown, name: string, url?: string): Promise<HomebrewFile> {
  const document = object(value);
  if (!document) throw new Error('Homebrew JSON must contain an object.');
  const serialized = JSON.stringify(document);
  if (new TextEncoder().encode(serialized).byteLength > MAX_HOMEBREW_BYTES) throw new Error('Homebrew files must be 32 MB or smaller.');
  const definitions = object(document['_meta'])?.['sources'];
  if (definitions !== undefined && !Array.isArray(definitions)) throw new Error('_meta.sources must be an array.');
  const sources = (definitions as unknown[] | undefined ?? []).map(source => string(object(source)?.['json']));
  if (sources.some(source => !source)) throw new Error('Every source in _meta.sources needs a json identifier.');
  if (new Set(sources).size !== sources.length) throw new Error('Duplicate source identifiers in _meta.sources.');
  return {
    id: await digest(url ?? name), name, url, sources,
    digest: await digest(serialized), importedAt: new Date().toISOString(), document,
  };
}

/** Collections sometimes repeat an entity with supplementary metadata. Never guess between conflicting rules. */
function mergeCompatibleDefinitions(first: unknown, second: unknown, path = 'definition'): unknown {
  if (first === undefined) return structuredClone(second);
  if (second === undefined || JSON.stringify(first) === JSON.stringify(second)) return structuredClone(first);
  if (Array.isArray(first) && Array.isArray(second)) {
    const contained = (small: unknown[], large: unknown[]) => small.every(value => large.some(other => JSON.stringify(other) === JSON.stringify(value)));
    if (contained(first, second)) return structuredClone(second);
    if (contained(second, first)) return structuredClone(first);
  }
  const left = object(first); const right = object(second);
  if (left && right) return Object.fromEntries([...new Set([...Object.keys(left), ...Object.keys(right)])]
    .map(key => [key, mergeCompatibleDefinitions(left[key], right[key], `${path}.${key}`)]));
  throw new Error(`Conflicting duplicate homebrew values at ${path}.`);
}

/** Replay only explicitly installed files, using the same adapters as the core library. */
export async function stageHomebrewFiles(cache: ContentCache, revision: ImportRevision, files: HomebrewFile[], signal?: AbortSignal) {
  revision.homebrewFiles = structuredClone(files);
  for (const file of files) {
    signal?.throwIfAborted();
    const path = `homebrew/${file.id}.json`;
    const mapped = mapContent(file.document, path);
    if (!mapped.records.length) throw new Error(`${file.name}: no supported content found.`);
    revision.diagnostics.push(...mapped.diagnostics);
    const groups = new Map<string, ContentRecord[]>();
    for (const record of mapped.records) {
      groups.set(record.key, [...groups.get(record.key) ?? [], record]);
    }
    const records: ContentRecord[] = [];
    for (const [key, group] of groups) {
      if (await cache.get(revision.id, key)) {
        const record = group[0];
        throw new Error(`${file.name}: duplicate content identity for ${record.name} (${record.publication}).`);
      }
      let merged = group[0];
      try {
        for (const other of group.slice(1)) merged = {
          ...merged, data: mergeCompatibleDefinitions(merged.data, other.data, merged.name) as JsonObject,
        };
        records.push(merged);
        if (group.length > 1) revision.diagnostics.push({ severity: 'warning', file: file.name, record: key,
          message: `Merged compatible duplicate definition: ${merged.name} (${merged.publication}).` });
      } catch (error) {
        if (!(error instanceof Error) || !error.message.startsWith('Conflicting duplicate homebrew')) throw error;
        revision.diagnostics.push({ severity: 'warning', file: file.name, record: key,
          message: `${error.message} Retained ${group.length} labeled alternatives; references to the unqualified definition require manual selection.` });
        records.push(...group.map((record, index) => ({
          ...record, key: JSON.stringify(['homebrew-variant', file.id, key, index + 1]),
          name: `${record.name} (Alternative ${index + 1})`, homebrewVariant: { originalKey: key, number: index + 1 },
        })));
      }
    }
    for (let start = 0; start < records.length; start += 128) {
      signal?.throwIfAborted();
      await cache.put(revision.id, records.slice(start, start + 128));
    }
    revision.metrics.records += records.length;
    revision.files.push(path);
    const dependencies = object(object(file.document['_meta'])?.['dependencies']);
    for (const [kind, sources] of Object.entries(dependencies ?? {})) {
      revision.diagnostics.push({ severity: 'warning', file: file.name,
        message: `Declared ${kind} dependencies: ${JSON.stringify(sources)}. External files are not downloaded automatically.` });
    }
  }
}
