import type { ContentRecord } from './content.model';

function hasReprintTargets(value: unknown): boolean {
  return Array.isArray(value) && value.some(target => {
    if (typeof target === 'string') return !!target.trim();
    return !!target && typeof target === 'object' && 'uid' in target
      && typeof target['uid'] === 'string' && !!target['uid'].trim();
  });
}

/** Schemas prefer reprintedAs over the older boolean flag. Edition alone is insufficient. */
export function isReprinted(record: ContentRecord): boolean {
  const definition = record.referenceDefinition;
  return record.data['isReprinted'] === true || record.data['reprinted'] === true
    || hasReprintTargets(record.data['reprintedAs'])
    || !!definition && (('isReprinted' in definition && definition['isReprinted'] === true)
      || ('reprinted' in definition && definition['reprinted'] === true)
      || ('reprintedAs' in definition && hasReprintTargets(definition['reprintedAs'])));
}
