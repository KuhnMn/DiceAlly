export type JsonObject = { [key: string]: unknown };
export interface ContentSource {
  owner: string;
  repository: string;
  branch: string;
  directory: string;
}
export const DEFAULT_CONTENT_SOURCE: ContentSource = {
  owner: '5etools-mirror-3', repository: '5etools-src', branch: 'main', directory: 'data',
};
export const ADAPTER_VERSION = 7;
export interface ContentLink {
  role: string;
  target: string;
  scope?: 'rule' | 'description' | 'catalog' | 'provenance';
  required?: boolean;
  status?: 'resolved' | 'missing' | 'ambiguous' | 'deferred';
  path?: string;
  reference?: string;
}
export interface ContentRecord {
  key: string;
  kind: string;
  name: string;
  publication: string;
  file: string;
  data: JsonObject;
  links: ContentLink[];
  derivation?: { operation: 'species' | 'subrace' | 'base-item' | 'item-group' | 'magicvariant'; inputs: ContentLink[]; version: number };
}
export interface ImportDiagnostic {
  severity: 'error' | 'warning';
  file: string;
  record?: string;
  message: string;
}
export interface ImportProgress {
  phase: 'resolve' | 'discover' | 'download' | 'link' | 'materialize' | 'complete';
  completed: number;
  total: number;
  file?: string;
  bytes: number;
  records: number;
}
export interface ImportRevision {
  id: string;
  namespace: string;
  source: ContentSource;
  sourceIdentity: string;
  commit: string;
  adapterVersion: number;
  createdAt: string;
  status: 'staging' | 'ready';
  files: string[];
  diagnostics: ImportDiagnostic[];
  metrics: { bytes: number; records: number; elapsedMs: number; mappedBytes: number };
}
export function object(value: unknown): JsonObject | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as JsonObject : undefined;
}
export function string(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}
export function normalize(value: string): string { return value.normalize('NFC').trim().toLowerCase(); }
export function validateSource(source: ContentSource): ContentSource {
  if (!/^[a-z\d-]+$/i.test(source.owner) || !/^[a-z\d._-]+$/i.test(source.repository)) {
    throw new Error('Enter a valid GitHub owner and repository name.');
  }
  const directory = source.directory.replace(/^\/+|\/+$/g, '');
  if (!source.branch.trim() || !directory || directory.split('/').some(p => !p || p === '.' || p === '..')) {
    throw new Error('Enter a branch and a relative data directory without traversal segments.');
  }
  return { ...source, branch: source.branch.trim(), directory };
}
export function sourceIdentity(source: ContentSource): string {
  return JSON.stringify(['github', normalize(source.owner), normalize(source.repository), source.directory]);
}
export function entityKey(kind: string, data: JsonObject): string {
  const publication = string(data['source'], kind === 'magicvariant' ? string(object(data['inherits'])?.['source']) : '');
  const name = ['itemType', 'itemProperty'].includes(kind) ? string(data['abbreviation'], string(data['name'])) : string(data['name'], string(data['abbreviation'], kind === 'subrace' ? string(data['raceName']) : ''));
  const parts: (string | number)[] = [kind, normalize(name), normalize(publication)];
  if (['classFeature', 'subclassFeature', 'subclass'].includes(kind)) {
    parts.push(normalize(string(data['className'])), normalize(string(data['classSource'])));
  }
  if (kind === 'subclassFeature') {
    parts.push(normalize(string(data['subclassShortName'])), normalize(string(data['subclassSource'])));
  }
  if (kind === 'classFeature' || kind === 'subclassFeature') parts.push(Number(data['level']));
  if (kind === 'subclass') parts.push(normalize(string(data['shortName'], string(data['name']))));
  if (kind === 'subrace') parts.push(normalize(string(data['raceName'])), normalize(string(data['raceSource'])));
  return JSON.stringify(parts);
}
