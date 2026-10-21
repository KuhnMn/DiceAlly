import { canonicalCharacterOption, characterOption } from '../content/character-option-adapter';
import { ContentRulesIndex, FeatureInstance } from './feature-rules';
import { checkPrerequisites, PrerequisiteContext } from './prerequisites';
export interface OptionalFeatureSlot {
  id: string;
  selectionId: string;
  ownerKey: string;
  count: number;
  featureTypes: string[];
  selectedKeys: string[];
}
/** Slots must be supplied by an eligible progression handler; prerequisites are never assumed. */
export function deriveOptionalFeatures(slots: OptionalFeatureSlot[], index: ContentRulesIndex,
  previous: FeatureInstance[] = [], suppressions: readonly string[] = [],context?: PrerequisiteContext) {
  const diagnostics: string[] = []; const suppressed = new Set(suppressions); const ids = new Set<string>();
  // Rebuild this source's generated grants; preserve manual entries and unrelated feature types.
  const instances = structuredClone(previous.filter(p => p.manual || p.sourceIdentity !== index.sourceIdentity || p.snapshot.kind !== 'optionalfeature')
    .map(p => p.sourceIdentity === index.sourceIdentity && p.snapshot.kind === 'optionalfeature' ? { ...p,grants: [] } : p));
  if (!index.sourceIdentity || !index.revisionId) diagnostics.push('Pinned content context is required.');
  if (new Set(previous.map(p => p.id)).size !== previous.length) diagnostics.push('Duplicate feature instance IDs.');
  for (const slot of slots) {
    if (!slot.id || ids.has(slot.id) || !slot.selectionId || !Number.isInteger(slot.count) || slot.count < 1
      || !slot.featureTypes.length || slot.selectedKeys.length !== slot.count || new Set(slot.selectedKeys).size !== slot.count) {
      diagnostics.push(`Invalid or incomplete optional feature slot: ${slot.id}`); continue;
    }
    ids.add(slot.id);
    const owner = index.records.get(slot.ownerKey);
    if (!owner || !['class','subclass','classFeature','subclassFeature'].includes(owner.kind)) {
      diagnostics.push(`Missing eligible slot owner: ${slot.ownerKey}`); continue;
    }
    for (const key of slot.selectedKeys) {
      const record = index.records.get(key);
      if (!record || record.kind !== 'optionalfeature') { diagnostics.push(`Missing optional feature: ${key}`); continue; }
      let definition: ReturnType<typeof characterOption>;
      try { definition = characterOption(record); } catch (error) { diagnostics.push(String(error)); continue; }
      if (!definition.featureTypes.some(type => slot.featureTypes.includes(type))) {
        diagnostics.push(`Optional feature has the wrong type: ${key}`); continue;
      }
      const prerequisite = definition.prerequisites;
      if (prerequisite.length) {
        if (!context) { diagnostics.push(`Prerequisite context required for ${key}`); continue; }
        const result = checkPrerequisites(prerequisite,context);
        if (!result.satisfied) { diagnostics.push(...result.diagnostics.map(d => `${key}: ${d}`)); continue; }
      }
      const grant = { id: JSON.stringify(['optional-grant',index.sourceIdentity,slot.selectionId,slot.ownerKey,slot.id,key]),
        selectionId: slot.selectionId,ownerKey: slot.ownerKey,role: 'optionalfeature' as const };
      if (suppressed.has(grant.id)) continue;
      const matches = previous.filter(p => p.sourceIdentity === index.sourceIdentity && p.contentKey === key);
      if (matches.length > 1 || (matches[0] && matches[0].revisionId !== index.revisionId)) {
        diagnostics.push(`Ambiguous instance or explicit content update required: ${key}`); continue;
      }
      const existing = matches[0];
      let instance = instances.find(p => p.sourceIdentity === index.sourceIdentity && p.contentKey === key);
      if (!instance) {
        instance = existing ? { ...structuredClone(existing),grants: [] } : { id: JSON.stringify(['optional-instance',index.sourceIdentity,key]),
          sourceIdentity: index.sourceIdentity,revisionId: index.revisionId,contentKey: key,manual: false,grants: [],snapshot: canonicalCharacterOption(record),customization: {} };
        instances.push(instance);
      }
      if (!instance.grants.some(g => g.id === grant.id)) instance.grants.push(grant);
    }
  }
  if (new Set(instances.map(p => p.id)).size !== instances.length) diagnostics.push('Feature instance ID collision.');
  const retained = new Set(instances.map(p => p.id));
  return { canAccept: diagnostics.length === 0,diagnostics,instances: diagnostics.length ? structuredClone(previous) : instances,
    removed: diagnostics.length ? [] : structuredClone(previous.filter(p => !retained.has(p.id))) };
}
