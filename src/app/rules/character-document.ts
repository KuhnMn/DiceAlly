import { canonicalItemRecord } from '../content/item-adapter';
import { canonicalMonsterRecord } from '../content/monster-adapter';
import { canonicalContentSnapshot } from '../content/content-snapshot';
import { canonicalDocument } from './canonical-document';
export { canonicalDocument } from './canonical-document';
import { canonicalSpellRecord } from '../content/spell-adapter';
import { canonicalCharacterOption, isCharacterOptionKind } from '../content/character-option-adapter';
import { canonicalClassRecord, isClassKind } from '../content/class-adapter';
import { ContentRecord, JsonObject, object } from '../content/content.model';
import { CharacterRulesInput } from './character-preview';
import { CastingSource, CharacterAction, PoolDefinition, ResourceOverrides, ResourceBinding, SpellResourceCost } from './resource-action-rules';
import { HealthPlayState } from './session-rules';
import { FeatureInstance } from './feature-rules';
import { SpellInstance } from './spell-rules';
import { SpeciesInstance } from './species-rules';
import { SpeciesContribution } from './species-rules';
import { deriveStats } from './derived-stats';
import { SKILL_ABILITIES } from './derived-stats';
import { Ability } from './derived-stats';
import { AbilityContribution } from './ability-rules';
import { canonicalSpeciesRecord } from '../content/species-adapter';

export interface CharacterDocument {
  // Inputs, generated instances and play state are separate so recalculation cannot erase user edits.
  format: 'ally-character'; schemaVersion: 1; id: string; rulesVersion: 'android-v1';
  restPolicy: 'android-v1' | 'web-viewer-v1';
  identity: { name: string; description: string; [key: string]: unknown };
  creation: Omit<CharacterRulesInput,'session' | 'previous' | 'classes'> & {
    classes: Omit<CharacterRulesInput['classes'],'optionalPrerequisites'>;
    manualResources: PoolDefinition[]; manualSources: CastingSource[]; actions: CharacterAction[]; pacts: string[];
    resourceBindings?: ResourceBinding[];
  };
  overrides: ResourceOverrides & {
    maxHp?: number | null; armorClass?: number | null; initiative?: number | null;
    speedOverrides?: Record<string, number>;
    suppressedFeatureGrants?: string[]; suppressedSpellGrants?: string[];
  };
  contentBindings: { sourceIdentity: string; revisionId: string; commit: string; adapterVersion: number; enabledPublications: string[] }[];
  instances: { features: FeatureInstance[]; spells: SpellInstance[]; pools: PoolDefinition[]; sources: CastingSource[]; actions: CharacterAction[]; species?: SpeciesInstance };
  derived: { maxHp: number; stats: ReturnType<typeof deriveStats>; speciesContributions: SpeciesContribution[];
    effectiveAbilities?: Record<Ability,number>; abilityContributions?: AbilityContribution[];
    spellResourceCosts?: SpellResourceCost[];
    casting: { sourceId: string; dc?: number; toHit?: number }[] } | null;
  session: HealthPlayState;
  presentation: JsonObject;
  snapshots: ContentRecord[];
  compatibility: JsonObject;
  extensions: JsonObject;
}
const requireObject = (value: unknown,label: string): JsonObject => { const data = object(value); if (!data) throw new Error(`Invalid ${label}.`); return data; };
const requireArray = (value: unknown,label: string): unknown[] => { if (!Array.isArray(value)) throw new Error(`Invalid ${label}.`); return value; };
/** Runtime validation for the current native document; legacy Android shapes use a separate adapter. */
export function validateCharacterDocument(value: unknown): CharacterDocument {
  const root = requireObject(JSON.parse(canonicalDocument(value)),'character document');
  if (root['format'] !== 'ally-character' || root['schemaVersion'] !== 1) throw new Error('Unsupported native character format/schema version.');
  if (root['rulesVersion'] !== 'android-v1' || !['android-v1','web-viewer-v1'].includes(String(root['restPolicy']))) throw new Error('Unsupported character rules/rest policy.');
  if (typeof root['id'] !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(root['id'])) throw new Error('Character ID must be a UUID.');
  const identity = requireObject(root['identity'],'identity');
  if (typeof identity['name'] !== 'string' || typeof identity['description'] !== 'string') throw new Error('Invalid identity text.');
  const creation = requireObject(root['creation'],'creation');
  if (creation['speciesAnswers'] !== undefined) {
    for (const answer of Object.values(requireObject(creation['speciesAnswers'],'species answers'))) {
      if (requireArray(answer,'species answer').some(value => typeof value !== 'string')) throw new Error('Invalid species answer.');
    }
  }
  if (creation['resourceBindings'] !== undefined) for (const raw of requireArray(creation['resourceBindings'],'resource bindings')) {
    const binding = requireObject(raw,'resource binding');
    if (['sourceId','resourceName','poolId'].some(field => typeof binding[field] !== 'string' || !binding[field])) throw new Error('Invalid resource binding.');
  }
  for (const key of ['classes','levels','abilities','stats']) requireObject(creation[key],`creation ${key}`);
  for (const key of ['manualProficiencies','manualSpeciesContributions','manualResources','manualSources','actions','pacts']) requireArray(creation[key],key);
  const classes = requireObject(creation['classes'],'class inputs');
  const selections = requireArray(classes['selections'],'class selections'); const selectionIds = new Set<string>(); let totalLevel = 0;
  for (const raw of selections) {
    const selection = requireObject(raw,'class selection');
    if (typeof selection['selectionId'] !== 'string' || !selection['selectionId'] || selectionIds.has(selection['selectionId'])
      || typeof selection['classKey'] !== 'string' || !selection['classKey'] || !Number.isSafeInteger(selection['level'])
      || Number(selection['level']) < 1 || Number(selection['level']) > 20) throw new Error('Invalid class selection.');
    selectionIds.add(selection['selectionId']); totalLevel += Number(selection['level']);
  }
  if (totalLevel < 1 || totalLevel > 20) throw new Error('Invalid total class level.');
  const levels = requireObject(creation['levels'],'level inputs'); const stats = requireObject(creation['stats'],'stat inputs');
  for (const field of ['applyHp','applyHitDice']) if (typeof levels[field] !== 'boolean') throw new Error('Invalid level automation preference.');
  if (typeof stats['calculateAc'] !== 'boolean' || !Number.isSafeInteger(levels['manualMaxHp']) || Number(levels['manualMaxHp']) < 0) throw new Error('Invalid HP/AC preference.');
  requireArray(levels['manualPools'],'manual level pools'); requireArray(stats['armor'],'armor inputs');
  const abilities = requireObject(creation['abilities'],'abilities');
  if (creation['applyProficiencies'] !== undefined && typeof creation['applyProficiencies'] !== 'boolean') throw new Error('Invalid proficiency automation preference.');
  if (creation['proficiencyCatalogs'] !== undefined) {
    const catalogs = requireObject(creation['proficiencyCatalogs'],'proficiency catalogs');
    for (const [kind,value] of Object.entries(catalogs)) {
      if (!['save','skill','tool','language','armor','weapon'].includes(kind)) throw new Error('Unknown proficiency catalog kind.');
      for (const pool of Object.values(requireObject(value,'proficiency pool catalog'))) if (requireArray(pool,'proficiency candidates').some(v => typeof v !== 'string' || !v)) throw new Error('Invalid proficiency catalog candidate.');
    }
  }
  if (creation['applySpeciesAbilities'] !== undefined && typeof creation['applySpeciesAbilities'] !== 'boolean') throw new Error('Invalid species ability preference.');
  if (creation['speciesAbilityChoice'] !== undefined) {
    const choice = requireObject(creation['speciesAbilityChoice'],'species ability choice');
    if (choice['optionIndex'] !== undefined && (!Number.isSafeInteger(choice['optionIndex']) || Number(choice['optionIndex']) < 0)) throw new Error('Invalid species ability alternative.');
    if (choice['chosen'] !== undefined && requireArray(choice['chosen'],'species ability allocations').some(v => !['str','dex','con','int','wis','cha'].includes(String(v)))) throw new Error('Invalid species ability allocation.');
  }
  for (const ability of ['str','dex','con','int','wis','cha']) if (!Number.isSafeInteger(abilities[ability]) || Number(abilities[ability]) < 1 || Number(abilities[ability]) > 30) throw new Error('Invalid ability score.');
  for (const field of ['spellAnswers','optionalAnswers','featureAnswers','ownerOptions']) if (classes[field] !== undefined) requireObject(classes[field],field);
  if (classes['featureAnswers'] !== undefined) for (const answer of Object.values(requireObject(classes['featureAnswers'], 'feature answers'))) {
    if (requireArray(answer, 'feature answer').some(value => typeof value !== 'string' || !value)) throw new Error('Invalid feature answer.');
  }
  if (classes['optionalPrerequisites'] !== undefined) throw new Error('Prerequisite context must be reconstructed from saved selections, not serialized runtime Sets.');
  const overrides = requireObject(root['overrides'],'overrides'); requireArray(overrides['pools'],'resource overrides'); requireArray(overrides['sources'],'source overrides');
  for (const field of ['maxHp','armorClass','initiative']) if (overrides[field] != null && !Number.isSafeInteger(overrides[field])) throw new Error('Invalid scalar override.');
  if (overrides['speedOverrides'] !== undefined) for (const value of Object.values(requireObject(overrides['speedOverrides'], 'speed overrides'))) {
    if (!Number.isSafeInteger(value) || Number(value) < 0) throw new Error('Invalid speed override.');
  }
  if (overrides['maxHp'] != null && Number(overrides['maxHp']) < 0) throw new Error('Invalid maximum HP override.');
  for (const field of ['suppressedFeatureGrants','suppressedSpellGrants']) if (overrides[field] !== undefined && requireArray(overrides[field],field).some(v => typeof v !== 'string')) throw new Error('Invalid grant suppression.');
  const bindings = requireArray(root['contentBindings'],'content bindings');
  if (!bindings.length) throw new Error('At least one pinned content binding is required.');
  const bindingIds = new Set<string>();
  for (const value of bindings) {
    const binding = requireObject(value,'content binding');
    if (typeof binding['sourceIdentity'] !== 'string' || !binding['sourceIdentity'] || bindingIds.has(binding['sourceIdentity'])
      || typeof binding['revisionId'] !== 'string' || !binding['revisionId'] || !/^[a-f0-9]{40}$/i.test(String(binding['commit']))
      || !Number.isSafeInteger(binding['adapterVersion']) || Number(binding['adapterVersion']) < 1
      || requireArray(binding['enabledPublications'],'enabled publications').some(v => typeof v !== 'string')) throw new Error('Invalid content binding.');
    bindingIds.add(binding['sourceIdentity']);
  }
  const instances = requireObject(root['instances'],'instances'); const ids = new Set<string>();
  const arrays = ['features','spells','pools','sources','actions'] as const;
  const list = arrays.flatMap(field => requireArray(instances[field],field).map(value => ({ field,value })));
  if (instances['species'] !== undefined) list.push({ field: 'features',value: instances['species'] });
  if (list.length > 2000) throw new Error('Too many character instances.');
  for (const {field,value} of list) {
    const instance = requireObject(value,field);
    if (typeof instance['id'] !== 'string' || !instance['id'] || ids.has(instance['id'])) throw new Error('Duplicate or invalid instance ID.');
    ids.add(instance['id']);
    const isSpecies = value === instances['species'];
    if (field === 'features' || field === 'spells') {
      requireObject(instance['customization'],'instance customization');
      if (!isSpecies) {
        if (typeof instance['manual'] !== 'boolean') throw new Error('Invalid manual instance flag.');
        for (const raw of requireArray(instance['grants'],'instance grants')) {
          const grant = requireObject(raw,'grant');
          if (typeof grant['id'] !== 'string' || !grant['id'] || typeof grant['selectionId'] !== 'string' || typeof grant['ownerKey'] !== 'string') throw new Error('Invalid grant identity.');
        }
      }
      if (field === 'spells' && (!['innate','known','prepared'].includes(String(instance['list']))
        || typeof instance['castingSourceId'] !== 'string' || typeof instance['usageKey'] !== 'string')) throw new Error('Invalid spell instance.');
    }
    if (field === 'pools') {
      if (!Number.isSafeInteger(instance['total']) || Number(instance['total']) < 0 || typeof instance['manual'] !== 'boolean'
        || !['hit-dice','spell-slots','feature-uses'].includes(String(instance['kind']))
        || !['LONG_REST','SHORT_REST','SHORT_REST_ONE','MANUAL'].includes(String(instance['regain']))
        || requireArray(instance['origins'],'pool origins').some(v => typeof v !== 'string')) throw new Error('Invalid resource definition.');
      if (instance['kind'] === 'spell-slots' && (!Number.isSafeInteger(instance['rank']) || Number(instance['rank']) < 1 || Number(instance['rank']) > 9)) throw new Error('Invalid spell slot level.');
    }
    if (field === 'sources') {
      if (typeof instance['label'] !== 'string' || typeof instance['manual'] !== 'boolean' || typeof instance['useSpellbook'] !== 'boolean'
        || (instance['ability'] !== undefined && !['str','dex','con','int','wis','cha'].includes(String(instance['ability'])))
        || (instance['customDc'] != null && !Number.isSafeInteger(instance['customDc']))
        || (instance['customToHit'] != null && !Number.isSafeInteger(instance['customToHit']))) throw new Error('Invalid casting source.');
      if ((instance['preparation'] !== undefined && !['known','prepared'].includes(String(instance['preparation'])))
        || (instance['ritualCasting'] !== undefined && typeof instance['ritualCasting'] !== 'boolean')) throw new Error('Invalid casting capability.');
      requireObject(instance['customization'],'source customization');
    }
    if ((field === 'features' || field === 'spells') && instance['snapshot'] === undefined) throw new Error('Selected instance snapshot is required.');
    if (instance['snapshot'] !== undefined) {
      const snapshot = requireObject(instance['snapshot'],'snapshot');
      if (snapshot['key'] !== instance['contentKey'] || typeof snapshot['kind'] !== 'string') throw new Error('Invalid selected snapshot identity.');
      requireObject(snapshot['data'],'snapshot data');
      if (isSpecies && snapshot['kind'] !== 'species') throw new Error('Invalid species snapshot kind.');
      if (snapshot['kind'] === 'species') instance['snapshot'] = canonicalSpeciesRecord(snapshot as unknown as ContentRecord, 'legacy');
      else if (isClassKind(String(snapshot['kind']))) instance['snapshot'] = canonicalClassRecord(snapshot as unknown as ContentRecord);
      else if (isCharacterOptionKind(String(snapshot['kind']))) instance['snapshot'] = canonicalCharacterOption(snapshot as unknown as ContentRecord);
      else if (snapshot['kind'] === 'spell') instance['snapshot'] = canonicalSpellRecord(snapshot as unknown as ContentRecord);
      else if (snapshot['kind'] === 'item') instance['snapshot'] = canonicalItemRecord(snapshot as unknown as ContentRecord);
      else if (snapshot['kind'] === 'monster') instance['snapshot'] = canonicalMonsterRecord(snapshot as unknown as ContentRecord);
      const binding = bindings.find(b => object(b)?.['sourceIdentity'] === instance['sourceIdentity']);
      if (!binding || object(binding)?.['revisionId'] !== instance['revisionId']) throw new Error('Snapshot lacks its exact content binding.');
    }
  }
  const sourceIds = new Set((instances['sources'] as JsonObject[]).map(s => s['id']));
  const poolIds = new Set((instances['pools'] as JsonObject[]).map(s => s['id']));
  const entityIds = new Set([...(instances['features'] as JsonObject[]),...(instances['spells'] as JsonObject[]),...(instances['species'] ? [instances['species'] as JsonObject] : [])].map(s => s['id']));
  for (const spell of instances['spells'] as JsonObject[]) if (!sourceIds.has(spell['castingSourceId'])) throw new Error('Spell references a missing casting source.');
  for (const action of instances['actions'] as JsonObject[]) {
    if (typeof action['label'] !== 'string' || typeof action['text'] !== 'string'
      || (action['instanceId'] !== undefined && !entityIds.has(action['instanceId']))
      || (action['poolId'] !== undefined && !poolIds.has(action['poolId']))
      || (action['sourceId'] !== undefined && !sourceIds.has(action['sourceId']))) throw new Error('Invalid linked action.');
    requireObject(action['customization'],'action customization');
  }
  const session = requireObject(root['session'],'session');
  for (const field of ['currentHp','tempHp']) if (!Number.isSafeInteger(session[field]) || Number(session[field]) < 0) throw new Error('Invalid health state.');
  const death = requireObject(session['deathSaves'],'death saves');
  for (const field of ['successes','failures']) if (!Number.isSafeInteger(death[field]) || Number(death[field]) < 0 || Number(death[field]) > 3) throw new Error('Invalid death saves.');
  const resources = requireObject(session['resources'],'session resources');
  for (const value of Object.values(resources)) { const usage = requireObject(value,'usage'); if (!Number.isSafeInteger(usage['used']) || Number(usage['used']) < 0) throw new Error('Invalid resource usage.'); }
  const annotations = requireObject(session['annotations'],'annotations');
  if (Object.values(annotations).some(v => !Array.isArray(v) || v.some(s => typeof s !== 'string'))) throw new Error('Invalid annotations.');
  for (const field of ['presentation','compatibility','extensions']) requireObject(root[field],field);
  const dependencies = requireArray(root['snapshots'],'dependency snapshots');
  if (dependencies.length > 1000) throw new Error('Too many dependency snapshots.');
  for (const raw of dependencies) { const record = requireObject(raw,'dependency snapshot'); if (typeof record['key'] !== 'string' || !record['key'] || typeof record['kind'] !== 'string') throw new Error('Invalid dependency identity.'); requireObject(record['data'],'dependency data'); }
  root['snapshots'] = dependencies.map(raw => {
    const record = raw as ContentRecord;
    return canonicalContentSnapshot(record);
  });
  if (root['derived'] !== null) {
    const derived = requireObject(root['derived'],'derived state');
    if (!Number.isSafeInteger(derived['maxHp']) || Number(derived['maxHp']) < 0) throw new Error('Invalid derived maximum HP.');
    const stats = requireObject(derived['stats'],'derived stats');
    if (derived['effectiveAbilities'] !== undefined) {
      const scores = requireObject(derived['effectiveAbilities'],'effective abilities');
      for (const ability of ['str','dex','con','int','wis','cha']) if (!Number.isSafeInteger(scores[ability]) || Number(scores[ability]) < 1 || Number(scores[ability]) > 30) throw new Error('Invalid effective ability.');
    }
    if (derived['abilityContributions'] !== undefined) requireArray(derived['abilityContributions'],'ability contributions');
    if (derived['spellResourceCosts'] !== undefined) {
      const costIds = new Set<string>();
      for (const raw of requireArray(derived['spellResourceCosts'],'spell resource costs')) {
        const cost = requireObject(raw,'spell cost');
        const spell = (instances['spells'] as JsonObject[]).find(s => s['id'] === cost['spellId']);
        if (typeof cost['id'] !== 'string' || !cost['id'] || costIds.has(cost['id']) || !spell || !poolIds.has(cost['poolId'])
          || !(spell['grants'] as JsonObject[]).some(g => g['id'] === cost['grantId'])
          || !Number.isSafeInteger(cost['amount']) || Number(cost['amount']) < 1) throw new Error('Invalid spell cost link/value.');
        costIds.add(cost['id']);
      }
    }
    requireArray(derived['speciesContributions'],'species contributions');
    for (const field of ['proficiencyBonus','initiative','baseInitiative','ac','calculatedAc']) if (!Number.isSafeInteger(stats[field])) throw new Error('Invalid derived numeric stat.');
    const modifiers = requireObject(stats['modifiers'],'ability modifiers'); const saves = requireObject(stats['saves'],'saves'); const skills = requireObject(stats['skills'],'skills');
    for (const ability of ['str','dex','con','int','wis','cha']) if (!Number.isSafeInteger(modifiers[ability]) || !Number.isSafeInteger(saves[ability])) throw new Error('Invalid derived ability/save.');
    for (const skill of Object.keys(SKILL_ABILITIES)) if (!Number.isSafeInteger(skills[skill])) throw new Error('Invalid derived skill.');
    for (const raw of requireArray(derived['casting'],'casting values')) {
      const casting = requireObject(raw,'casting values');
      if (!sourceIds.has(casting['sourceId']) || (casting['dc'] !== undefined && !Number.isSafeInteger(casting['dc']))
        || (casting['toHit'] !== undefined && !Number.isSafeInteger(casting['toHit']))) throw new Error('Invalid derived casting value.');
    }
  }
  return JSON.parse(canonicalDocument(root)) as CharacterDocument;
}
export function parseCharacterDocument(json: string): CharacterDocument {
  if (new TextEncoder().encode(json).byteLength > 10*1024*1024) throw new Error('Character import exceeds 10 MiB.');
  return validateCharacterDocument(JSON.parse(json));
}
