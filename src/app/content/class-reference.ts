import { ContentLink, entityKey, JsonObject, object, string } from './content.model';

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

