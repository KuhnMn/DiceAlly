import { monsterSourceData } from '../content/monster-adapter';
import { itemSourceData } from '../content/item-adapter';
import { spellSourceData } from '../content/spell-adapter';
import { ContentRecord } from '../content/content.model';
import { CharacterDocument, canonicalDocument, validateCharacterDocument } from './character-document';
import { previewCharacterRules } from './character-preview';
import { ContentRulesIndex } from './feature-rules';
import { deriveResourcesAndActions } from './resource-action-rules';
import { applySessionAction, SessionAction } from './session-rules';
import { object } from '../content/content.model';

export type DocumentAdjustment = { id: string; kind: 'hp'; maximum: number }
  | { id: string; kind: 'usage'; poolId: string; maximum: number }
  | { id: string; kind: 'removed-pool'; poolId: string };
export interface DocumentPreview {
  canAccept: boolean;
  diagnostics: string[];
  adjustments: DocumentAdjustment[];
  proposed?: CharacterDocument;
  removed: { featureIds: string[]; spellIds: string[]; sourceIds: string[]; speciesIds: string[] };
}
// Keep the authoritative acceptance plan private: callers may edit the public review copy.
const plans = new WeakMap<DocumentPreview,{ base: string; proposed: CharacterDocument; adjustments: DocumentAdjustment[] }>();
function selectedSnapshots(index: ContentRulesIndex,roots: string[]): ContentRecord[] {
  const queue = [...new Set(roots)]; const seen = new Set<string>(); const records: ContentRecord[] = [];
  for (const key of queue) {
    if (seen.has(key)) continue; seen.add(key);
    if (seen.size > 1000) throw new Error('Selected snapshot graph exceeds 1000 records.');
    const record = index.records.get(key); if (!record) throw new Error(`Missing selected dependency: ${key}`);
    records.push(structuredClone(record));
    for (const link of record.links) {
      if (link.scope === 'catalog' || link.scope === 'description' || link.required === false) continue;
      if (link.status && link.status !== 'resolved') throw new Error(`Unresolved selected dependency: ${link.target}`);
      if (!seen.has(link.target)) queue.push(link.target);
    }
  }
  return records;
}
export function previewDocument(document: CharacterDocument,index: ContentRulesIndex): DocumentPreview {
  const base = validateCharacterDocument(document); const diagnostics: string[] = [];
  const removed: DocumentPreview['removed'] = { featureIds: [],spellIds: [],sourceIds: [],speciesIds: [] };
  try {
    const binding = base.contentBindings.find(b => b.sourceIdentity === index.sourceIdentity && b.revisionId === index.revisionId);
    if (!binding) throw new Error('Document must be explicitly bound to this content revision.');
    if (base.contentBindings.length !== 1) throw new Error('Multiple-source document derivation requires an extension handler.');
    const available: ContentRulesIndex = binding.enabledPublications.length ? { ...index,records: new Map([...index.records].filter(([,r]) => binding.enabledPublications.includes(r.publication))) } : index;
    // Restore matching retired instances when reselected, retaining their IDs and user customization.
    const retired = Array.isArray(base.compatibility['retiredInstances']) ? base.compatibility['retiredInstances'] as Record<string,unknown>[] : [];
    const savedFeatures = retired.filter(r => r?.['manual'] === false && r['snapshot'] && r['sourceIdentity'] === index.sourceIdentity
      && r['revisionId'] === index.revisionId && r['list'] === undefined) as unknown as CharacterDocument['instances']['features'];
    const savedSpells = retired.filter(r => r?.['manual'] === false && r['snapshot'] && r['sourceIdentity'] === index.sourceIdentity
      && r['revisionId'] === index.revisionId && ['innate','known','prepared'].includes(String(r['list']))) as unknown as CharacterDocument['instances']['spells'];
    const savedSources = retired.filter(r => r?.['manual'] === false && !r['snapshot'] && typeof r['useSpellbook'] === 'boolean') as unknown as CharacterDocument['instances']['sources'];
    const savedSpecies = [...retired].reverse().find(r => r?.['selectionId'] === base.creation.species?.id
      && r['contentKey'] === base.creation.species?.key && r['sourceIdentity'] === index.sourceIdentity && r['revisionId'] === index.revisionId
      && (r['snapshot'] as ContentRecord | undefined)?.kind === 'species') as unknown as CharacterDocument['instances']['species'];
    const merge = <T extends { id: string }>(archived: T[],active: T[]): T[] => [...new Map([...archived,...active].map(item => [item.id,item])).values()];
    const input = { ...base.creation,
      levels: { ...base.creation.levels,...(Object.hasOwn(base.overrides,'maxHp') ? { maxHpOverride: base.overrides.maxHp } : {}) },
      stats: { ...base.creation.stats,...(Object.hasOwn(base.overrides,'armorClass') ? { acOverride: base.overrides.armorClass } : {}),
        ...(Object.hasOwn(base.overrides,'initiative') ? { initiativeOverride: base.overrides.initiative } : {}) },
      session: base.session,previous: { features: merge(savedFeatures,base.instances.features),spells: merge(savedSpells,base.instances.spells),
      pools: base.instances.pools.filter(p => p.kind !== 'feature-uses').map(p => ({ ...p,kind: p.kind as 'hit-dice' | 'spell-slots',rank: p.rank ?? 1,
        regain: p.regain === 'SHORT_REST_ONE' ? 'MANUAL' as const : p.regain })),
      species: base.instances.species?.contentKey === base.creation.species?.key ? base.instances.species : savedSpecies ?? base.instances.species },
      classes: { ...base.creation.classes,featureSuppressions: base.overrides.suppressedFeatureGrants ?? base.creation.classes.featureSuppressions,
        spellSuppressions: base.overrides.suppressedSpellGrants ?? base.creation.classes.spellSuppressions,
        optionalPrerequisites: { totalLevel: 0,classes: [],
        spells: new Set(base.instances.spells.filter(s => s.manual).map(s => s.contentKey)),
        optionalFeatures: new Set(base.instances.features.filter(s => s.manual && s.snapshot.kind === 'optionalfeature').map(s => s.contentKey)),
        pacts: new Set(base.creation.pacts) } } };
    const rules = previewCharacterRules(input,available); diagnostics.push(...rules.diagnostics);
    if (!rules.proposed) return { canAccept: false,diagnostics,adjustments: [],removed };
    const candidate = rules.proposed;
    const resources = deriveResourcesAndActions({ pools: candidate.pools,spells: candidate.spells,manualPools: base.creation.manualResources,
      previousSources: merge(savedSources,base.instances.sources),manualSources: base.creation.manualSources,overrides: base.overrides,actions: base.creation.actions,
      instanceIds: [...candidate.features.map(f => f.id),...candidate.spells.map(s => s.id),...(candidate.species ? [candidate.species.id] : [])],
      proficiencyBonus: candidate.stats.proficiencyBonus,modifiers: candidate.stats.modifiers,resourceBindings: base.creation.resourceBindings },available);
    diagnostics.push(...resources.diagnostics);
    if (!resources.canAccept) return { canAccept: false,diagnostics,adjustments: [],removed };
    const proposed = structuredClone(base);
    proposed.instances = { ...base.instances,features: candidate.features,spells: candidate.spells,pools: resources.pools,sources: resources.sources,
      actions: resources.actions,species: candidate.species };
    proposed.derived = { ...base.derived,maxHp: candidate.maxHp,stats: { ...base.derived?.stats,...candidate.stats },
      speciesContributions: candidate.speciesContributions,effectiveAbilities: candidate.effectiveAbilities,
      abilityContributions: candidate.abilityContributions,casting: resources.casting,spellResourceCosts: resources.costs };
    proposed.session = candidate.session;
    for (const pool of resources.pools) if (!Object.hasOwn(proposed.session.resources,pool.id)) {
      Object.defineProperty(proposed.session.resources,pool.id,{ value: { used: 0 },enumerable: true,writable: true,configurable: true });
    }
    const adjustments: DocumentAdjustment[] = [];
    if (proposed.session.currentHp > candidate.maxHp) adjustments.push({ id: 'hp',kind: 'hp',maximum: candidate.maxHp });
    for (const pool of resources.pools) if (proposed.session.resources[pool.id].used > pool.total) adjustments.push({
      id: JSON.stringify(['usage',pool.id]),kind: 'usage',poolId: pool.id,maximum: pool.total });
    for (const pool of base.instances.pools) if (!resources.pools.some(p => p.id === pool.id)) adjustments.push({
      id: JSON.stringify(['removed-pool',pool.id]),kind: 'removed-pool',poolId: pool.id });
    removed.featureIds = base.instances.features.filter(old => !candidate.features.some(f => f.id === old.id)).map(f => f.id);
    removed.spellIds = base.instances.spells.filter(old => !candidate.spells.some(s => s.id === old.id)).map(s => s.id);
    removed.sourceIds = base.instances.sources.filter(old => !resources.sources.some(s => s.id === old.id)).map(s => s.id);
    removed.speciesIds = base.instances.species && base.instances.species.id !== candidate.species?.id ? [base.instances.species.id] : [];
    const roots = [...base.creation.classes.selections.flatMap(s => [s.classKey,...(s.subclassKey ? [s.subclassKey] : [])]),
      ...candidate.features.filter(f => f.sourceIdentity === index.sourceIdentity).map(f => f.contentKey),
      ...candidate.spells.filter(s => s.sourceIdentity === index.sourceIdentity).map(s => s.contentKey),...(base.creation.species ? [base.creation.species.key] : [])];
    const inline = new Set([...candidate.features.map(f => f.contentKey),...candidate.spells.map(s => s.contentKey),...(candidate.species ? [candidate.species.contentKey] : [])]);
    proposed.snapshots = selectedSnapshots(available,roots).filter(r => !inline.has(r.key));
    // Keep removed customization/snapshots available; acceptance never silently destroys their history.
    const history = proposed.compatibility['retiredInstances'];
    const combinedHistory = [...(Array.isArray(history) ? history : []),
      ...base.instances.features.filter(f => removed.featureIds.includes(f.id)),...base.instances.spells.filter(s => removed.spellIds.includes(s.id)),
      ...base.instances.sources.filter(s => removed.sourceIds.includes(s.id)),...(removed.speciesIds.length ? [base.instances.species] : [])];
    proposed.compatibility['retiredInstances'] = [...new Map(combinedHistory.map((entry,i) => [typeof entry?.id === 'string' ? entry.id : `unknown-${i}`,entry])).values()];
    const validated = validateCharacterDocument(proposed);
    const result: DocumentPreview = { canAccept: adjustments.length === 0,diagnostics,adjustments: structuredClone(adjustments),proposed: structuredClone(validated),removed };
    plans.set(result,{ base: canonicalDocument(base),proposed: validated,adjustments: structuredClone(adjustments) });
    return result;
  } catch(error) { diagnostics.push(String(error)); return { canAccept: false,diagnostics,adjustments: [],removed }; }
}
/** Review objects are not authority: use the stored plan and reject changes to the base document. */
export function acceptDocumentPreview(current: CharacterDocument,preview: DocumentPreview,
  decisions: Readonly<Record<string,'keep' | 'clamp' | 'retain' | 'discard'>> = {}): CharacterDocument {
  const plan = plans.get(preview); if (!plan) throw new Error('Unknown or invalid preview.');
  if (canonicalDocument(validateCharacterDocument(current)) !== plan.base) throw new Error('Stale preview: character changed. Recalculate before accepting.');
  const required = new Set(plan.adjustments.map(a => a.id));
  if (Object.keys(decisions).some(key => !required.has(key))) throw new Error('Unknown adjustment decision.');
  const next = structuredClone(plan.proposed);
  for (const adjustment of plan.adjustments) {
    const decision = Object.hasOwn(decisions,adjustment.id) ? decisions[adjustment.id] : undefined;
    if (adjustment.kind === 'removed-pool') {
      if (decision !== 'retain' && decision !== 'discard') throw new Error('Choose how to handle removed resource state.');
      if (decision === 'discard') delete next.session.resources[adjustment.poolId];
    } else {
      if (decision !== 'keep' && decision !== 'clamp') throw new Error('Explicit HP/resource adjustment decision required.');
      if (decision === 'clamp') {
        if (adjustment.kind === 'hp') next.session.currentHp = adjustment.maximum;
        else next.session.resources[adjustment.poolId].used = adjustment.maximum;
      }
    }
  }
  return validateCharacterDocument(next);
}
export function performDocumentAction(document: CharacterDocument,action: SessionAction): CharacterDocument {
  const next = validateCharacterDocument(document);
  if (!next.derived) throw new Error('Apply character rules before play actions.');
  if (action.type === 'rest' && action.policy !== next.restPolicy) throw new Error('Rest policy changes require explicit document editing.');
  next.session = applySessionAction(next.session,next.derived.maxHp,next.instances.pools,action);
  return validateCharacterDocument(next);
}
/** Spend the reviewed cost definition rather than resolving a resource by an editable display label. */
export function performSpellResourceUse(document: CharacterDocument,costId: string): CharacterDocument {
  const validated = validateCharacterDocument(document);
  const cost = validated.derived?.spellResourceCosts?.find(c => c.id === costId);
  if (!cost) throw new Error('Unknown spell resource cost. Recalculate supported casting definitions first.');
  return performDocumentAction(validated,{ type: 'spend',poolId: cost.poolId,amount: cost.amount });
}

export interface ContentUpdatePreview extends DocumentPreview {
  from: CharacterDocument['contentBindings'][number];
  to: CharacterDocument['contentBindings'][number];
  changes: { key: string; kind: 'changed' | 'missing'; fields: string[] }[];
}
/** Explicit same-source rebind. Missing/renamed identities require editing selections, never guesses. */
export function previewContentUpdate(document: CharacterDocument,index: ContentRulesIndex,
  target: CharacterDocument['contentBindings'][number]): ContentUpdatePreview {
  const base = validateCharacterDocument(document); const from = base.contentBindings[0];
  const changes: ContentUpdatePreview['changes'] = []; const diagnostics: string[] = [];
  const failure = (): ContentUpdatePreview => ({ canAccept: false,diagnostics,adjustments: [],removed: { featureIds: [],spellIds: [],sourceIds: [],speciesIds: [] },
    from: structuredClone(from),to: structuredClone(target),changes });
  if (base.contentBindings.length !== 1 || from.sourceIdentity !== index.sourceIdentity || target.sourceIdentity !== index.sourceIdentity
    || target.revisionId !== index.revisionId) { diagnostics.push('Content updates require the same source identity and exact target revision.'); return failure(); }
  const selected = new Map<string,ContentRecord>();
  for (const record of [...base.snapshots,...base.instances.features.map(f => f.snapshot),...base.instances.spells.map(s => s.snapshot),
    ...(base.instances.species ? [base.instances.species.snapshot] : [])]) selected.set(record.key,record);
  // Drafts can contain unapplied class/species/choice roots too; report missing roots explicitly.
  const roots = [...base.creation.classes.selections.flatMap(s => [s.classKey,...(s.subclassKey ? [s.subclassKey] : [])]),
    ...(base.creation.species ? [base.creation.species.key] : []),
    ...Object.values(base.creation.classes.optionalAnswers ?? {}).flat(),...Object.values(base.creation.classes.spellAnswers ?? {}).flat()];
  const requiredRoots = new Set([...roots,...base.instances.features.map(f => f.contentKey),...base.instances.spells.map(s => s.contentKey),
    ...(base.instances.species ? [base.instances.species.contentKey] : [])]);
  for (const key of new Set([...selected.keys(),...roots])) {
    const next = index.records.get(key); const old = selected.get(key);
    if (!next) {
      changes.push({ key,kind: 'missing',fields: [] });
      if (requiredRoots.has(key)) diagnostics.push(`Missing or renamed content requires an explicit selection edit: ${key}`);
      continue;
    }
    if (!old) continue;
    if (old.kind !== next.kind) { diagnostics.push(`Content kind changed incompatibly: ${key}`); continue; }
    const oldData = old.kind === 'spell' ? spellSourceData(old) : old.kind === 'item' ? itemSourceData(old) : old.kind === 'monster' ? monsterSourceData(old) : old.data;
    const nextData = next.kind === 'spell' ? spellSourceData(next) : next.kind === 'item' ? itemSourceData(next) : next.kind === 'monster' ? monsterSourceData(next) : next.data;
    const fields = [...new Set([...Object.keys(oldData),...Object.keys(nextData)])]
      .filter(field => canonicalDocument(oldData[field] ?? null) !== canonicalDocument(nextData[field] ?? null));
    if (canonicalDocument(old.links) !== canonicalDocument(next.links)) fields.push('$links');
    if (old.name !== next.name) fields.push('$name');
    if (fields.length) changes.push({ key,kind: 'changed',fields });
  }
  if (diagnostics.length) return failure();
  try {
    const rebound = structuredClone(base);
    rebound.contentBindings = [structuredClone(target)];
    const refresh = <T extends { sourceIdentity: string; revisionId: string; contentKey: string; snapshot: ContentRecord }>(instance: T): T => {
      const next = index.records.get(instance.contentKey);
      if (!next || next.kind !== instance.snapshot.kind) throw new Error(`Missing target snapshot: ${instance.contentKey}`);
      return { ...structuredClone(instance),revisionId: target.revisionId,snapshot: structuredClone(next) };
    };
    rebound.instances.features = base.instances.features.map(refresh);
    rebound.instances.spells = base.instances.spells.map(refresh);
    if (base.instances.species) rebound.instances.species = refresh(base.instances.species);
    rebound.snapshots = base.snapshots.filter(snapshot => index.records.has(snapshot.key)).map(snapshot => structuredClone(index.records.get(snapshot.key)!));
    const retired = rebound.compatibility['retiredInstances'];
    if (Array.isArray(retired)) rebound.compatibility['retiredInstances'] = retired.map(raw => {
      const entry = object(raw); const snapshot = object(entry?.['snapshot']);
      if (!entry || !snapshot || entry['sourceIdentity'] !== from.sourceIdentity || entry['revisionId'] !== from.revisionId) return raw;
      const next = index.records.get(String(entry['contentKey']));
      return next && next.kind === snapshot['kind'] ? { ...entry,revisionId: target.revisionId,snapshot: structuredClone(next) } : raw;
    });
    const history = rebound.compatibility['contentUpdates'];
    rebound.compatibility['contentUpdates'] = [...(Array.isArray(history) ? history : []),{
      from: structuredClone(from),to: structuredClone(target),snapshots: [...selected.values()].map(r => structuredClone(r)),changes: structuredClone(changes),
    }];
    const derived = previewDocument(rebound,index);
    const result: ContentUpdatePreview = { ...derived,from: structuredClone(from),to: structuredClone(target),changes: structuredClone(changes) };
    const plan = plans.get(derived);
    if (plan) plans.set(result,{ ...plan,base: canonicalDocument(base),proposed: structuredClone(plan.proposed),adjustments: structuredClone(plan.adjustments) });
    return result;
  } catch(error) { diagnostics.push(String(error)); return failure(); }
}
