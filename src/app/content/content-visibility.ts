import type { ContentRecord } from './content.model';

/** Explicit flags only: a reprint link or a legacy edition does not imply replacement. */
export function isReprinted(record: ContentRecord): boolean {
  const definition = record.referenceDefinition;
  return record.data['isReprinted'] === true || record.data['reprinted'] === true
    || !!definition && (('isReprinted' in definition && definition['isReprinted'] === true)
      || ('reprinted' in definition && definition['reprinted'] === true));
}
