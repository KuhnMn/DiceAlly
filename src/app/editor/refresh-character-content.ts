import { ContentCache } from '../content/content-cache';
import { ContentRecord, ImportRevision, JsonObject, entityKey } from '../content/content.model';
import { characterOptionSourceData } from '../content/character-option-adapter';
import { ContentReference, ExportedCharacter } from '../models/character.model';
import { canonicalDocument } from '../rules/canonical-document';
import { contentReference, speciesSnapshot } from './editor-content-helpers';
import { createFeatureEntry } from './feature-selection';
import { createInventoryEntry } from './item-selection';
import { createMonsterEntry } from './monster-selection';
import { spellSnapshot } from './spell-selection';

export interface DescriptionRefreshResult {
  sheet: ExportedCharacter;
  refreshed: number;
  skipped: { name: string; reason: string }[];
}

type LinkedEntry = { name?: string; source?: string; contentReference?: ContentReference };

/** Refresh detached definitions only. Character choices, annotations and play state remain authored state. */
export async function refreshCharacterDescriptions(
  sheet: ExportedCharacter, cache: Pick<ContentCache, 'get'>, revision: ImportRevision,
): Promise<DescriptionRefreshResult> {
  const result: DescriptionRefreshResult = { sheet: structuredClone(sheet), refreshed: 0, skipped: [] };
  const records = new Map<string, Promise<ContentRecord | undefined>>();
  const get = (key: string) => {
    let record = records.get(key);
    if (!record) { record = cache.get(revision.id, key); records.set(key, record); }
    return record;
  };
  const find = async (entry: LinkedEntry, kinds: string[], identity: JsonObject = {}): Promise<ContentRecord | undefined> => {
    const skip = (reason: string) => { result.skipped.push({ name: entry.name ?? 'Unnamed entry', reason }); return undefined; };
    const reference = entry.contentReference;
    if (reference) {
      if (reference.sourceIdentity !== revision.sourceIdentity) return skip('Belongs to a different content library');
      const record = await get(reference.key);
      if (!record || !kinds.includes(record.kind)) return skip('Not found in the current library');
      return record;
    }
    if (entry.source?.toLowerCase() === 'custom') return skip('Custom entry');
    // Portable imports may lack provenance. Require exact publication and every feature qualifier.
    const name = entry.name ?? identity['name'];
    const source = entry.source ?? identity['source'];
    if (!name || !source) return skip('No exact name and publication');
    const matches: ContentRecord[] = [];
    for (const kind of kinds) {
      if (['classFeature', 'subclassFeature'].includes(kind)
        && (!identity['className'] || !identity['classSource'] || identity['level'] == null)) continue;
      if (kind === 'subclassFeature' && (!identity['subclassShortName'] || !identity['subclassSource'])) continue;
      const record = await get(entityKey(kind, { ...identity, name, source }));
      if (record && record.kind === kind) matches.push(record);
    }
    return matches.length === 1 ? matches[0] : skip(matches.length ? 'Ambiguous identity' : 'No exact match in the current library');
  };
  const updated = (entry: LinkedEntry, record: ContentRecord) => {
    entry.contentReference = contentReference(record, revision);
    result.refreshed++;
  };

  for (const spell of result.sheet.spells ?? []) {
    const record = await find(spell, ['spell']);
    if (!record) continue;
    spell.entity = spellSnapshot(record);
    updated(spell, record);
  }
  for (const feature of result.sheet.features ?? []) {
    const entity = feature.featureEntity;
    const kinds = feature.contentReference ? ['classFeature', 'subclassFeature', 'feat', 'optionalfeature']
      : feature.featEntity || feature.featureType === 'FEAT' ? ['feat']
      : feature.optionalFeatureEntity || feature.featureType === 'OPTIONAL_FEATURE' ? ['optionalfeature']
      : entity?.subclassShortName ? ['subclassFeature'] : ['classFeature', 'subclassFeature'];
    const record = await find(feature, kinds, entity ? {
      className: entity.className, classSource: entity.classSource, level: entity.level,
      ...(entity.subclassShortName ? { subclassShortName: entity.subclassShortName } : {}),
      ...(entity.subclassSource ? { subclassSource: entity.subclassSource } : {}),
    } : {});
    if (!record) continue;
    const fresh = createFeatureEntry(record, revision);
    delete feature.featureEntity; delete feature.featEntity; delete feature.optionalFeatureEntity;
    feature.featureEntity = fresh.featureEntity;
    feature.featEntity = fresh.featEntity;
    feature.optionalFeatureEntity = fresh.optionalFeatureEntity;
    updated(feature, record);
  }
  for (const item of result.sheet.inventory ?? []) {
    if (item.isDummy) { result.skipped.push({ name: item.name, reason: 'Custom entry' }); continue; }
    const record = await find(item, ['item']);
    if (!record) continue;
    item.entity = (await createInventoryEntry(cache, record, revision)).entity;
    updated(item, record);
  }
  for (const monster of result.sheet.monsters ?? []) {
    const record = await find(monster, ['monster']);
    if (!record) continue;
    monster.entity = createMonsterEntry(record, revision).entity;
    updated(monster, record);
  }
  const species = result.sheet.species;
  if (species) {
    const record = await find(species, ['species']);
    if (record) { species.entity = speciesSnapshot(record); updated(species, record); }
  }
  const background = result.sheet.background;
  if (background) {
    const record = await find(background, ['background']);
    if (record) { background.entity = characterOptionSourceData(record); updated(background, record); }
  }
  // No recalculation: wizard baselines, manual character fields and combat overrides remain untouched.
  // Exercise the same bounded serializer used by the editor before committing the replacement draft.
  canonicalDocument(result.sheet);
  return result;
}
