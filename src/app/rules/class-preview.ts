import { hasAdditionalSpellPayload } from '../content/additional-spells';
import { castingMetadata } from '../content/class-adapter';
import { ContentClassSelection, ContentRulesIndex, deriveClassFeatures, FeatureInstance } from './feature-rules';
import { deriveLevelRules, LevelInputs, PlayState, ResourcePool } from './level-rules';
import { deriveSpellGrants, SpellGrantOwner, SpellInstance } from './spell-rules';
import { deriveOptionalSlots } from './optional-progression';
import { deriveOptionalFeatures } from './optional-feature-rules';
import { PrerequisiteContext } from './prerequisites';

export function spellOwnerIdentity(selectionId: string, ownerKey: string): string { return JSON.stringify([selectionId,ownerKey]); }
export interface ClassRulesInput {
  selections: ContentClassSelection[];
  levels: Omit<LevelInputs,'classes'>;
  session: PlayState;
  previousFeatures?: FeatureInstance[];
  previousSpells?: SpellInstance[];
  previousPools?: ResourcePool[];
  featureSuppressions?: string[];
  spellSuppressions?: string[];
  spellAnswers?: Readonly<Record<string,readonly string[]>>;
  ownerOptions?: Readonly<Record<string,Pick<SpellGrantOwner,'blocks' | 'ability' | 'maxSpellLevel'>>>;
  optionalAnswers?: Readonly<Record<string,readonly string[]>>;
  optionalPrerequisites?: PrerequisiteContext;
  additionalSpellOwners?: SpellGrantOwner[];
}

/** Only currently granted spells establish automatic prerequisites; retained manual history does not. */
function activeSpellKeys(instances: SpellInstance[],sourceIdentity: string): string[] {
  return instances.filter(spell => spell.sourceIdentity === sourceIdentity && spell.grants.length > 0)
    .map(spell => spell.contentKey);
}

/** Build a detached proposal. Any failure returns the previous state, never a partial update. */
export function previewClassRules(input: ClassRulesInput, index: ContentRulesIndex) {
  // Class levels determine mandatory features and how many optional selections are available.
  const features = deriveClassFeatures(input.selections,index,input.previousFeatures,input.featureSuppressions);
  const diagnostics = features.diagnostics.map(d => d.message);
  const slots = features.canAccept ? deriveOptionalSlots(input.selections,index,input.optionalAnswers) : undefined;
  if (slots) diagnostics.push(...slots.diagnostics);
  const previousFeatureCandidates = [...features.instances,...(input.previousFeatures ?? []).filter(f => f.snapshot.kind === 'optionalfeature')];
  const spellOwners = new Map<string,SpellGrantOwner>();
  const addSpellOwner = (selection: ContentClassSelection, key: string) => {
    const record = index.records.get(key);
    if (!record || !hasAdditionalSpellPayload(record)) return;
    const identity = spellOwnerIdentity(selection.selectionId,key);
    const parentAbility = castingMetadata(index.records.get(selection.classKey)).ability;
    const ability = (castingMetadata(record).ability ?? parentAbility) || undefined;
    spellOwners.set(identity,{ selectionId: selection.selectionId,ownerKey: key,level: selection.level,ability,...input.ownerOptions?.[identity] });
  };
  const addFeatureSpellOwners = (instances: FeatureInstance[]) => {
    for (const feature of instances) for (const grant of feature.grants) {
      const selection = input.selections.find(s => s.selectionId === grant.selectionId);
      if (selection && feature.sourceIdentity === index.sourceIdentity) addSpellOwner(selection,feature.contentKey);
    }
  };
  if (features.canAccept) {
    for (const owner of input.additionalSpellOwners ?? []) spellOwners.set(spellOwnerIdentity(owner.selectionId,owner.ownerKey),structuredClone(owner));
    for (const selection of input.selections) {
      addSpellOwner(selection,selection.classKey); if (selection.subclassKey) addSpellOwner(selection,selection.subclassKey);
    }
    addFeatureSpellOwners(features.instances.filter(f => f.snapshot.kind !== 'optionalfeature'));
  }
  // Independent grants establish prerequisites before optional features can contribute spells.
  const prerequisiteSpells = features.canAccept ? deriveSpellGrants([...spellOwners.values()],index,input.previousSpells,input.spellAnswers,input.spellSuppressions) : undefined;
  if (prerequisiteSpells) diagnostics.push(...prerequisiteSpells.diagnostics);
  const prerequisiteContext: PrerequisiteContext = {
    abilities: input.optionalPrerequisites?.abilities,
    spells: new Set([...(input.optionalPrerequisites?.spells ?? []),
      ...(prerequisiteSpells?.canAccept ? activeSpellKeys(prerequisiteSpells.instances,index.sourceIdentity) : [])]),
    optionalFeatures: input.optionalPrerequisites?.optionalFeatures ?? new Set(),
    pacts: input.optionalPrerequisites?.pacts ?? new Set(),
    totalLevel: input.selections.reduce((sum,s) => sum + s.level,0),
    classes: input.selections.map(s => ({ name: index.records.get(s.classKey)?.name ?? '',publication: index.records.get(s.classKey)?.publication ?? '',level: s.level })),
  };
  const previousOptionalInstances = [...new Map(previousFeatureCandidates.map(f => [f.id,f])).values()];
  // Grow eligibility only from validated current grants. Previous generated selections cannot seed cycles.
  const pendingSelections = slots?.canAccept ? slots.slots.flatMap(slot => slot.selectedKeys.map(key => ({ slot,key }))) : [];
  if (pendingSelections.length > 512) diagnostics.push('Optional dependency resolution exceeds 512 selections.');
  else if (prerequisiteSpells?.canAccept) {
    while (pendingSelections.length) {
      let resolvedSelectionThisPass = false;
      for (let position = pendingSelections.length - 1; position >= 0; position--) {
        const { slot,key } = pendingSelections[position];
        const selectionPreview = deriveOptionalFeatures([{ ...slot,count: 1,selectedKeys: [key] }],index,previousOptionalInstances,input.featureSuppressions,prerequisiteContext);
        if (!selectionPreview.canAccept) continue;
        pendingSelections.splice(position,1);
        resolvedSelectionThisPass = true;
        const activeOptionalFeatures = selectionPreview.instances.filter(f => f.sourceIdentity === index.sourceIdentity && f.snapshot.kind === 'optionalfeature'
          && f.contentKey === key && f.grants.length > 0);
        if (!activeOptionalFeatures.length) continue;
        prerequisiteContext.optionalFeatures = new Set([...prerequisiteContext.optionalFeatures,key]);
        addFeatureSpellOwners(activeOptionalFeatures);
      }
      // No new eligible option means remaining selections have unmet or circular requirements.
      if (!resolvedSelectionThisPass) break;
      const eligibleSpells = deriveSpellGrants([...spellOwners.values()],index,input.previousSpells,input.spellAnswers,input.spellSuppressions);
      if (!eligibleSpells.canAccept) { diagnostics.push(...eligibleSpells.diagnostics); break; }
      prerequisiteContext.spells = new Set([...prerequisiteContext.spells,
        ...activeSpellKeys(eligibleSpells.instances,index.sourceIdentity)]);
    }
  }
  // Recheck complete slots: dependency discovery used individual options, not slot counts.
  const optional = slots?.canAccept ? deriveOptionalFeatures(slots.slots,index,previousOptionalInstances,input.featureSuppressions,prerequisiteContext) : undefined;
  if (optional) diagnostics.push(...optional.diagnostics);
  let levels: ReturnType<typeof deriveLevelRules> | undefined;
  if (features.canAccept && optional?.canAccept) {
    try { levels = deriveLevelRules({ ...input.levels,classes: features.classInputs },input.session,'android-v1',input.previousPools); }
    catch(error) { diagnostics.push(String(error)); }
  }
  if (features.canAccept && levels) {
    addFeatureSpellOwners(optional!.instances);
  }
  const spells = features.canAccept && levels ? deriveSpellGrants([...spellOwners.values()],index,input.previousSpells,input.spellAnswers,input.spellSuppressions) : undefined;
  if (spells) diagnostics.push(...spells.diagnostics);
  const canAccept = diagnostics.length === 0 && features.canAccept && !!prerequisiteSpells?.canAccept && !!optional?.canAccept && !!levels && !!spells?.canAccept;
  return { canAccept, features, optional, slots, spells, levels, diagnostics,
    proposed: canAccept ? { features: optional!.instances,spells: spells!.instances,pools: levels!.pools,session: levels!.session }
      : { features: structuredClone(input.previousFeatures ?? []),spells: structuredClone(input.previousSpells ?? []),
        pools: structuredClone(input.previousPools ?? []),session: structuredClone(input.session) } };
}
