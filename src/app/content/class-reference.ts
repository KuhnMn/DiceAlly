import { ContentLink, entityKey, JsonObject, object, string } from './content.model';
import type { ContentRecord } from './content.model';
import { contentEntries, visitEntryTree } from './content-entries';

/** Structured feature entries grant features; inline prose tags only link descriptions. */
export function featureEntryReferences(record: ContentRecord, kind: 'classFeature' | 'subclassFeature'): ContentLink[] {
  const references = new Map<string, ContentLink>();
  const type = kind === 'classFeature' ? 'refClassFeature' : 'refSubclassFeature';
  visitEntryTree(contentEntries(record), 'entries', () => {}, entry => {
    if (entry.type !== type) return;
    const reference = featureReference(entry[kind], kind, {});
    references.set(reference.target, reference);
  });
  return [...references.values()];
}

export function featureReference(value: unknown, kind: 'classFeature' | 'subclassFeature', _parent: JsonObject): ContentLink {
  const token = typeof value === 'string' ? value : string(object(value)?.[kind]);
  const p = token.split('|');
  const subclass = kind === 'subclassFeature';
  const level = Number(p[subclass ? 5 : 3]);
  if (!token || p.length < (subclass ? 6 : 4) || !Number.isInteger(level) || level < 0) {
    throw new Error(`Invalid ${kind} reference: ${token}`);
  }
  const data: JsonObject = {
    name: p[0], className: p[1], classSource: p[2] || 'PHB',
    source: p[subclass ? 6 : 4] || (subclass ? p[4] : p[2]) || 'PHB', level,
  };
  if (subclass) { data['subclassShortName'] = p[3]; data['subclassSource'] = p[4] || 'PHB'; }
  return { role: kind, target: entityKey(kind, data) };
}

