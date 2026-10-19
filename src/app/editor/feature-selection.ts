import { newEditorId } from './editor-identity';
import { ContentRecord, ImportRevision, JsonObject, entityKey } from '../content/content.model';
import { Entry, FeatEntity, FeatureEntity, FeatureEntryFull, OptionalFeatureEntity } from '../models/character.model';
import { contentReference } from './editor-content-helpers';

export type FeatureType = 'CLASS_FEATURE' | 'FEAT' | 'OPTIONAL_FEATURE';
export const FEATURE_TYPES: { value: FeatureType; label: string; kinds: string[] }[] = [
  { value: 'CLASS_FEATURE', label: 'Class Features', kinds: ['classFeature', 'subclassFeature'] },
  { value: 'FEAT', label: 'Feats', kinds: ['feat'] },
  { value: 'OPTIONAL_FEATURE', label: 'Optional Features', kinds: ['optionalfeature'] },
];

/** Explicit acquisition metadata only; filtering never evaluates character eligibility. */
export function featureFilterValues(data: unknown): { classes: string[]; levels: number[] } {
  const value = data && typeof data === 'object' ? data as Record<string, unknown> : {};
  const classes = new Set<string>(), levels = new Set<number>();
  const addClass = (name: unknown) => { if (typeof name === 'string' && name.trim()) classes.add(name.trim()); };
  const addLevel = (level: unknown) => { if (typeof level === 'number' && Number.isInteger(level) && level > 0) levels.add(level); };
  addClass(value['className']); addLevel(value['level']);
  for (const prerequisite of Array.isArray(value['prerequisite']) ? value['prerequisite'] : []) {
    if (!prerequisite || typeof prerequisite !== 'object') continue;
    const level = prerequisite.level;
    if (level && typeof level === 'object') { addLevel(level.level); addClass(level.class?.name); }
    else addLevel(level);
  }
  return { classes: [...classes], levels: [...levels] };
}

export function featureFilterData(feature: FeatureEntryFull): unknown {
  return feature.featureEntity ?? feature.featEntity ?? feature.optionalFeatureEntity;
}

export function matchesFeatureFilters(data: unknown, classes: readonly string[], levels: readonly number[]): boolean {
  const values = featureFilterValues(data);
  return (!classes.length || values.classes.some(name => classes.some(selected => selected.toLowerCase() === name.toLowerCase())))
    && (!levels.length || values.levels.some(level => levels.includes(level)));
}

export function featureFilterOptions(data: unknown[]): { classes: string[]; levels: number[] } {
  const values = data.map(featureFilterValues);
  return { classes: [...new Set(values.flatMap(value => value.classes))].sort(), levels: [...new Set(values.flatMap(value => value.levels))].sort((a, b) => a - b) };
}

export function featureCategories(data: unknown, kind: FeatureType): string[] {
  const value = data && typeof data === 'object' ? data as Record<string, unknown> : {};
  const types = kind === 'FEAT' ? [value['category']] : value['featureType'];
  const categories = (Array.isArray(types) ? types : []).filter((value): value is string => typeof value === 'string' && !!value.trim()).map(value => value.trim());
  return categories.length ? [...new Set(categories)] : ['Other'];
}

export function featureCategoryLabel(type: string): string {
  const labels: Record<string, string> = { O: 'Origin', G: 'General', FS: 'Fighting Style', EB: 'Epic Boon', EI: 'Eldritch Invocation', MM: 'Metamagic', AS: 'Arcane Shot', 'MV:B': 'Battle Master Maneuver', 'FS:F': 'Fighter Fighting Style', 'FS:P': 'Paladin Fighting Style', 'FS:R': 'Ranger Fighting Style' };
  return labels[type] ?? type;
}

export function matchesFeatureCategories(data: unknown, kind: FeatureType, selected: readonly string[]): boolean {
  return !selected.length || featureCategories(data, kind).some(type => selected.includes(type));
}

/** Existing viewer JSON can identify a feature by its snapshot field or explicit type. */
export function featureTypeOf(feature: FeatureEntryFull): FeatureType {
  if (feature.featEntity || feature.featureType === 'FEAT') return 'FEAT';
  if (feature.optionalFeatureEntity || feature.featureType === 'OPTIONAL_FEATURE') return 'OPTIONAL_FEATURE';
  return 'CLASS_FEATURE';
}

/** Definition identity excludes the assigned source and per-instance notes/uses. */
export function classFeatureKey(feature: FeatureEntryFull): string {
  if (feature.contentReference) return feature.contentReference.key;
  const data = feature.featureEntity;
  const kind = data?.subclassShortName ? 'subclassFeature' : 'classFeature';
  return entityKey(kind, { name: feature.name, source: feature.source, ...data } as unknown as JsonObject);
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
    editorId: options.editorId ?? newEditorId(),
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
