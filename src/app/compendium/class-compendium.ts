import { ContentRecord, normalize } from '../content/content.model';
import { IndexedDbContentCache } from '../content/content-cache';
import { classDefinition } from '../content/class-adapter';

export interface ClassFeatureRow { record: ContentRecord; level: number; subclass: boolean; }
export interface FeatureProgression { rows: ClassFeatureRow[]; missing: string[]; }
const identity = (record: ContentRecord) => record.homebrewVariant?.originalKey ?? record.key;

export function belongsToClass(record: ContentRecord, owner: ContentRecord): boolean {
  return ['subclass', 'classFeature', 'subclassFeature'].includes(record.kind)
    && classDefinition(record).parent?.key === identity(owner);
}
export function belongsToSubclass(record: ContentRecord, owner: ContentRecord, subclass: ContentRecord): boolean {
  if (record.kind !== 'subclassFeature' || !belongsToClass(record, owner) || !belongsToClass(subclass, owner)) return false;
  const membership = classDefinition(record).subclass;
  return normalize(membership?.shortName ?? '') === normalize(classDefinition(subclass).shortName ?? subclass.name)
    && normalize(membership?.source ?? '') === normalize(subclass.publication);
}

/** Explicit feature references define a progression; a parent-only fallback supports historical imports. */
export async function loadProgression(cache: IndexedDbContentCache, revisionId: string, owner: ContentRecord, subclass?: ContentRecord): Promise<FeatureProgression> {
  const selected = subclass ?? owner;
  if (subclass && !belongsToClass(subclass, owner)) throw new Error('This subclass belongs to another class edition.');
  const references = classDefinition(selected).features;
  const belongs = (record: ContentRecord) => subclass ? belongsToSubclass(record, owner, subclass)
    : record.kind === 'classFeature' && belongsToClass(record, owner);
  const records: ContentRecord[] = [], missing: string[] = [];
  if (references.length) {
    const keys = [...new Set(references.map(reference => reference.key))];
    for (let start = 0; start < keys.length; start += 20) {
      const batch = keys.slice(start, start + 20);
      const values = await Promise.all(batch.map(key => cache.get(revisionId, key)));
      values.forEach((record, index) => {
        if (record && belongs(record)) records.push(record);
        else missing.push(batch[index]);
      });
    }
  } else {
    await cache.searchCategory(revisionId, [subclass ? 'subclassFeature' : 'classFeature'], '', 0, 0, record => {
      if (belongs(record)) records.push(record);
      return false;
    });
  }
  return { rows: records.map(record => ({ record, level: classDefinition(record).level ?? 0, subclass: !!subclass })), missing };
}

export function groupProgression(base: ClassFeatureRow[], subclass: ClassFeatureRow[], query = ''): { level: number; features: ClassFeatureRow[] }[] {
  const unique = new Map([...base, ...subclass].map(row => [row.record.key, row]));
  const groups = new Map<number, ClassFeatureRow[]>();
  const terms = normalize(query).split(/\s+/).filter(Boolean);
  for (const row of unique.values()) {
    if (!terms.every(term => normalize(`${row.record.name} ${row.record.publication}`).includes(term))) continue;
    if (!groups.has(row.level)) groups.set(row.level, []);
    groups.get(row.level)!.push(row);
  }
  return [...groups].sort(([a], [b]) => a - b).map(([level, features]) => ({ level,
    features: features.sort((a, b) => Number(a.subclass) - Number(b.subclass)) }));
}
