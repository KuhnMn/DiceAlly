import type { JsonObject } from '../content/content.model';

/** Reject nonportable values/bounded-size violations before traversing an imported document. */
export function canonicalDocument(value: unknown): string {
  let nodes = 0;
  const walk = (entry: unknown,depth: number): unknown => {
    if (++nodes > 250000 || depth > 64) throw new Error('Character document exceeds structural limits.');
    if (entry === null || typeof entry === 'string' || typeof entry === 'boolean') return entry;
    if (typeof entry === 'number') { if (!Number.isFinite(entry)) throw new Error('Nonfinite document number.'); return entry; }
    if (Array.isArray(entry)) return entry.map(v => { if (v === undefined) throw new Error('Undefined array value.'); return walk(v,depth+1); });
    if (typeof entry === 'object' && entry && (Object.getPrototypeOf(entry) === Object.prototype || Object.getPrototypeOf(entry) === null)) {
      return Object.fromEntries(Object.keys(entry).sort().filter(key => (entry as JsonObject)[key] !== undefined).map(key => [key,walk((entry as JsonObject)[key],depth+1)]));
    }
    throw new Error('Character document must contain portable JSON values.');
  };
  const json = JSON.stringify(walk(value,0));
  if (new TextEncoder().encode(json).byteLength > 10*1024*1024) throw new Error('Character document exceeds 10 MiB.');
  return json;
}
