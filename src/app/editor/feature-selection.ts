import { ContentRecord, ImportRevision } from '../content/content.model';
import { Entry, FeatEntity, FeatureEntity, FeatureEntryFull, OptionalFeatureEntity } from '../models/character.model';
import { contentReference } from './editor-content-helpers';

export type FeatureType = 'CLASS_FEATURE' | 'FEAT' | 'OPTIONAL_FEATURE';
export const FEATURE_TYPES: { value: FeatureType; label: string; kinds: string[] }[] = [
  { value: 'CLASS_FEATURE', label: 'Class Features', kinds: ['classFeature', 'subclassFeature'] },
  { value: 'FEAT', label: 'Feats', kinds: ['feat'] },
  { value: 'OPTIONAL_FEATURE', label: 'Optional Features', kinds: ['optionalfeature'] },
];

/** Existing viewer JSON can identify a feature by its snapshot field or explicit type. */
export function featureTypeOf(feature: FeatureEntryFull): FeatureType {
  if (feature.featEntity || feature.featureType === 'FEAT') return 'FEAT';
  if (feature.optionalFeatureEntity || feature.featureType === 'OPTIONAL_FEATURE') return 'OPTIONAL_FEATURE';
  return 'CLASS_FEATURE';
}

export function featureEntries(feature: FeatureEntryFull): Entry[] {
  return feature.featureEntity?.entries ?? feature.featEntity?.entries ?? feature.optionalFeatureEntity?.entries ?? [];
}

/**
 * Manual catalog additions and wizard prefill produce the same portable feature shape.
 * The wizard supplies a stable ID and userAdded=false; manual entries get a fresh ID.
 * Copying the snapshot prevents edits to the draft from changing cached content.
 */
export function createFeatureEntry(
  record: ContentRecord,
  revision: ImportRevision,
  options: { sourceName?: string; editorId?: string; userAdded?: boolean } = {},
): FeatureEntryFull {
  const type = FEATURE_TYPES.find(type => type.kinds.includes(record.kind))?.value;
  if (!type) throw new Error(`Unsupported feature kind: ${record.kind}`);
  const feature: FeatureEntryFull = {
    editorId: options.editorId ?? crypto.randomUUID(),
    name: record.name,
    source: record.publication,
    featureType: type,
    featureSourceName: options.sourceName,
    userAdded: options.userAdded ?? true,
    notes: [],
    uses: [],
    contentReference: contentReference(record, revision),
  };
  const snapshot = structuredClone(record.data);
  if (type === 'FEAT') feature.featEntity = snapshot as unknown as FeatEntity;
  else if (type === 'OPTIONAL_FEATURE') feature.optionalFeatureEntity = snapshot as unknown as OptionalFeatureEntity;
  else feature.featureEntity = snapshot as unknown as FeatureEntity;
  return feature;
}
