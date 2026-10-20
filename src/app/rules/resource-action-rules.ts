import { JsonObject, object, string } from '../content/content.model';
import { ContentRulesIndex } from './feature-rules';
import { ResourcePool } from './level-rules';
import { RestPool } from './session-rules';
import { SpellInstance } from './spell-rules';
import { resolveSpellUsageCount, spellUsageCount } from './spell-usage';
export interface CastingSource {
  id: string;
  label: string;
  ability?: string;
  customDc?: number | null;
  customToHit?: number | null;
  useSpellbook: boolean;
  preparation?: 'known' | 'prepared';
  ritualCasting?: boolean;
  manual: boolean;
  customization: JsonObject;
}
export interface CharacterAction {
  id: string;
  label: string;
  text: string;
  instanceId?: string;
  poolId?: string;
  sourceId?: string;
  customization: JsonObject;
}
export interface PoolDefinition extends RestPool {
  origins: string[];
  manual: boolean;
  rank?: number;
}
export interface ResourceOverrides {
  pools: { poolId: string; total: number; regain?: RestPool['regain'] }[];
  sources: { sourceId: string; ability?: string; customDc?: number | null; customToHit?: number | null; useSpellbook?: boolean; preparation?: 'known' | 'prepared'; ritualCasting?: boolean }[];
}
export interface ResourceBinding { sourceId: string; resourceName: string; poolId: string }
export interface SpellResourceCost { id: string; spellId: string; grantId: string; poolId: string; amount: number }
/** Materialize supported innate uses and preserve source customization; unknown use structures block. */
export function deriveResourcesAndActions(input: {
  pools: ResourcePool[];
  spells: SpellInstance[];
  manualPools: PoolDefinition[];
  previousSources: CastingSource[];
  manualSources: CastingSource[];
  overrides: ResourceOverrides;
  actions: CharacterAction[];
  instanceIds: string[];
  proficiencyBonus: number;
  modifiers: Record<string,number>;
  resourceBindings?: ResourceBinding[];
},index: ContentRulesIndex) {
  const diagnostics: string[] = [];
  const pools: PoolDefinition[] = [...input.pools.map(p => ({ ...structuredClone(p),manual: p.origins.length === 0 })),...structuredClone(input.manualPools)];
  const sources = structuredClone(input.manualSources);
  const costs: SpellResourceCost[] = [];
  const integer = (n: unknown) => typeof n === 'number' && Number.isSafeInteger(n);
  const abilities = ['str','dex','con','int','wis','cha'];
  if (new Set(input.previousSources.map(s => s.id)).size !== input.previousSources.length) diagnostics.push('Duplicate previous casting sources.');
  for (const spell of input.spells) {
    let source = sources.find(s => s.id === spell.castingSourceId);
    if (!source) {
      const old = input.previousSources.find(s => s.id === spell.castingSourceId);
      const grant = spell.grants[0]; const owner = grant ? index.records.get(grant.ownerKey) : undefined;
      source = old ? structuredClone(old) : { id: spell.castingSourceId,label: owner?.name ?? spell.snapshot.name,
        ability: grant?.ability,useSpellbook: false,manual: false,customization: {},
        preparation: owner?.data['preparedSpells'] !== undefined ? 'prepared' : Array.isArray(owner?.data['spellsKnownProgression']) ? 'known' : undefined,
        ritualCasting: owner?.data['ritualCasting'] === true };
      if (!old?.manual) source.ability = grant?.ability ?? old?.ability;
      sources.push(source);
    }
    if (spell.list !== 'innate') continue;
    for (const grant of spell.grants) {
      if (grant.usage['casts'] !== undefined) { diagnostics.push(`Innate casts handler required: ${grant.path}`); continue; }
      const frequency = string(grant.usage['frequency']);
      if (!frequency || ['will','ritual','constant'].includes(frequency)) continue;
      if (frequency === 'resource') {
        const name = string(grant.usage['resourceName']); const amount = Number(grant.usage['count']);
        const bindings = (input.resourceBindings ?? []).filter(b => b.sourceId === spell.castingSourceId && b.resourceName === name);
        const pool = bindings.length === 1 ? pools.find(p => p.id === bindings[0].poolId) : undefined;
        if (!name || !pool || pool.kind !== 'feature-uses' || !/^[1-9]\d*$/.test(string(grant.usage['count'])) || !Number.isSafeInteger(amount)) {
          diagnostics.push(`Explicit named-resource binding required: ${grant.path}`); continue;
        }
        costs.push({ id: JSON.stringify(['spell-cost',spell.id,grant.id,pool.id]),spellId: spell.id,grantId: grant.id,poolId: pool.id,amount });
        continue;
      }
      if (!['daily','rest'].includes(frequency) || typeof grant.usage['casts'] !== 'undefined') {
        diagnostics.push(`Innate resource handler required: ${grant.path}`); continue;
      }
      const count = string(grant.usage['count']); const parsed = spellUsageCount(count);
      let total: number;
      try { total = resolveSpellUsageCount(count, input.modifiers); }
      catch (error) { diagnostics.push(String(error)); continue; }
      if (!parsed || total < 1) { diagnostics.push(`Invalid innate use count: ${count}`); continue; }
      // 'e' means each spell; otherwise the list shares its usage pool.
      const group = parsed.each ? spell.id : grant.path.replace(/\[\d+\]$/, '');
      const id = JSON.stringify(['innate-uses',spell.castingSourceId,frequency,count,group]);
      let pool = pools.find(p => p.id === id);
      if (!pool) {
        pool = { id,kind: 'feature-uses',total,regain: frequency === 'daily' ? 'LONG_REST' : 'SHORT_REST',origins: [],manual: false };
        pools.push(pool);
      }
      if (!pool.origins.includes(spell.id)) pool.origins.push(spell.id);
      costs.push({ id: JSON.stringify(['spell-cost',spell.id,grant.id,pool.id]),spellId: spell.id,grantId: grant.id,poolId: pool.id,amount: 1 });
    }
  }
  const seenOverrides = new Set<string>();
  for (const override of input.overrides.pools) {
    const pool = pools.find(p => p.id === override.poolId);
    if (!pool || seenOverrides.has(override.poolId) || !integer(override.total) || override.total < 0
      || (override.regain !== undefined && !['LONG_REST','SHORT_REST','SHORT_REST_ONE','MANUAL'].includes(override.regain))) {
      diagnostics.push(`Invalid resource override: ${override.poolId}`); continue;
    }
    seenOverrides.add(override.poolId); pool.total = override.total; if (override.regain) pool.regain = override.regain;
  }
  seenOverrides.clear();
  for (const override of input.overrides.sources) {
    const source = sources.find(s => s.id === override.sourceId);
    if (!source || seenOverrides.has(override.sourceId) || (override.ability !== undefined && !abilities.includes(override.ability))
      || (override.customDc != null && !integer(override.customDc)) || (override.customToHit != null && !integer(override.customToHit))
      || (override.useSpellbook !== undefined && typeof override.useSpellbook !== 'boolean')
      || (override.preparation !== undefined && !['known','prepared'].includes(override.preparation))
      || (override.ritualCasting !== undefined && typeof override.ritualCasting !== 'boolean')) {
      diagnostics.push(`Invalid casting-source override: ${override.sourceId}`); continue;
    }
    seenOverrides.add(override.sourceId);
    for (const key of ['ability','customDc','customToHit','useSpellbook','preparation','ritualCasting'] as const) if (Object.hasOwn(override,key)) Object.assign(source,{ [key]: override[key] });
  }
  for (const source of sources) if (!source.id || !source.label || typeof source.useSpellbook !== 'boolean'
    || !object(source.customization) || typeof source.manual !== 'boolean'
    || (source.ability !== undefined && !abilities.includes(source.ability))
    || (source.customDc != null && !integer(source.customDc)) || (source.customToHit != null && !integer(source.customToHit))) diagnostics.push('Invalid casting source.');
  for (const source of sources) if ((source.preparation !== undefined && !['known','prepared'].includes(source.preparation))
    || (source.ritualCasting !== undefined && typeof source.ritualCasting !== 'boolean')) diagnostics.push('Invalid casting capability.');
  for (const pool of pools) if (!pool.id || !integer(pool.total) || pool.total < 0
    || !['hit-dice','spell-slots','feature-uses'].includes(pool.kind) || !['LONG_REST','SHORT_REST','SHORT_REST_ONE','MANUAL'].includes(pool.regain)) diagnostics.push('Invalid resource definition.');
  if (new Set(pools.map(p => p.id)).size !== pools.length || new Set(sources.map(s => s.id)).size !== sources.length) diagnostics.push('Resource/source identity collision.');
  const bindingIds = new Set<string>();
  for (const binding of input.resourceBindings ?? []) {
    const id = JSON.stringify([binding.sourceId,binding.resourceName]);
    if (!binding.resourceName || bindingIds.has(id) || !sources.some(s => s.id === binding.sourceId)
      || !pools.some(p => p.id === binding.poolId && p.kind === 'feature-uses')) diagnostics.push('Invalid named-resource binding.');
    bindingIds.add(id);
  }
  const actions = structuredClone(input.actions); const instanceIds = new Set(input.instanceIds);
  if (new Set(actions.map(a => a.id)).size !== actions.length) diagnostics.push('Action IDs must be unique.');
  for (const action of actions) {
    if (!action.id || typeof action.label !== 'string' || typeof action.text !== 'string' || !object(action.customization)
      || (action.instanceId !== undefined && !instanceIds.has(action.instanceId))
      || (action.poolId !== undefined && !pools.some(p => p.id === action.poolId))
      || (action.sourceId !== undefined && !sources.some(s => s.id === action.sourceId))) diagnostics.push(`Unresolved or invalid action link: ${action.id}`);
  }
  const casting = sources.map(source => {
    const modifier = source.ability ? input.modifiers[source.ability] : undefined;
    return { sourceId: source.id,dc: source.customDc ?? (modifier === undefined ? undefined : 8+input.proficiencyBonus+modifier),
      toHit: source.customToHit ?? (modifier === undefined ? undefined : input.proficiencyBonus+modifier) };
  });
  return { canAccept: diagnostics.length === 0,diagnostics,pools,sources,actions,casting,costs };
}
