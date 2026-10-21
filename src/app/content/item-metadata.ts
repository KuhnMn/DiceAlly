import { ContentRecord, entityKey, normalize, object, string } from './content.model';

/** Shared UID resolution for materialization and item-specific rule notes. */
export function resolveItemMetadata(metadata: ReadonlyMap<string, ContentRecord>, kind: string, value: unknown, defaultSource: string): ContentRecord {
  const token = string(value, string(object(value)?.['uid']));
  const [identifier, publication] = token.split('|');
  if (!identifier) throw new Error(`Invalid ${kind} reference.`);
  const fields = kind === 'itemMastery' ? { name: identifier } : { abbreviation: identifier };
  const exact = metadata.get(entityKey(kind, { ...fields, source: publication || defaultSource }));
  if (exact) return exact;
  // Retain the existing legacy defaults; qualified UIDs never cross publications.
  if (!publication && defaultSource === 'PHB') {
    const legacy = metadata.get(entityKey(kind, { ...fields, source: 'DMG' }));
    if (legacy) return legacy;
  }
  const candidates = publication ? [] : [...metadata.values()].filter(record => record.kind === kind
    && normalize(kind === 'itemMastery' ? record.name : string(record.data['abbreviation'])) === normalize(identifier));
  if (candidates.length === 1) return candidates[0];
  throw new Error(`Missing or ambiguous ${kind} definition: ${token}`);
}
