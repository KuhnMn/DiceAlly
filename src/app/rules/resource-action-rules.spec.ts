import { mapContent } from '../content/content-adapter';
import { deriveSpellGrants } from './spell-rules';
import { deriveResourcesAndActions } from './resource-action-rules';
describe('Innate resource definitions', () => {
  it('resolves symbolic ability uses without changing spell or pool identity', () => {
    const records = mapContent({ feat: [{ name: 'Gift', source: 'TEST',
      additionalSpells: [{ innate: { '9': { daily: { int: ['A'] } } } }] }],
      spell: [{ name: 'A', source: 'PHB', level: 0 }] }, 'test.json').records;
    const index = { sourceIdentity: 'source', revisionId: 'revision', records: new Map(records.map(r => [r.key, r])) };
    const preview = deriveSpellGrants([{ selectionId: 'selection', ownerKey: records.find(r => r.kind === 'feat')!.key, level: 9 }], index);
    expect(preview.diagnostics).toEqual([]);
    const spells = preview.instances;
    const input = { pools: [], spells, manualPools: [], previousSources: [], manualSources: [],
      overrides: { pools: [], sources: [] }, actions: [], instanceIds: spells.map(s => s.id), proficiencyBonus: 4 };
    const high = deriveResourcesAndActions({ ...input, modifiers: { int: 4 } }, index);
    const low = deriveResourcesAndActions({ ...input, modifiers: { int: -1 } }, index);
    expect(high.diagnostics).toEqual([]);
    expect(low.diagnostics).toEqual([]);
    expect(high.pools[0].total).toBe(4);
    expect(low.pools[0].total).toBe(1);
    expect(low.pools[0].id).toBe(high.pools[0].id);
    expect(deriveResourcesAndActions({ ...input, modifiers: {} }, index).canAccept).toBe(false);
  });
  it('shares a daily list pool and separates each-spell pools without touching usage', () => {
    const records = mapContent({ feat: [{ name: 'Gift',source: 'TEST',additionalSpells: [{ ability: 'wis',innate: { '1': { daily: { '2': ['A','B'],'1e': ['A','B'] } } } }] }],
      spell: [{ name: 'A',source: 'PHB', level: 0 },{ name: 'B',source: 'PHB', level: 0 }] },'test.json').records;
    const index = { sourceIdentity: 'source',revisionId: 'revision',records: new Map(records.map(r => [r.key,r])) };
    const spells = deriveSpellGrants([{ selectionId: 'selection',ownerKey: records.find(r => r.kind === 'feat')!.key,level: 1 }],index).instances;
    const result = deriveResourcesAndActions({ pools: [],spells,manualPools: [],previousSources: [],manualSources: [],overrides: { pools: [],sources: [] },
      actions: [],instanceIds: spells.map(s => s.id),proficiencyBonus: 2,modifiers: { wis: 3 } },index);
    expect(result.diagnostics).toEqual([]); expect(result.pools).toHaveLength(3);
    expect(result.pools.find(p => p.total === 2)?.origins).toHaveLength(2);
    expect(result.casting[0]).toMatchObject({ dc: 13,toHit: 5 });
    expect(result.costs).toHaveLength(4);
  });
  it('binds resource-cost spells explicitly to a shared named pool and rejects missing/duplicate bindings', () => {
    const records = mapContent({ feat: [{ name: 'Gift',source: 'TEST',additionalSpells: [{ resourceName: 'Ki',innate: { '1': { resource: { '2': ['A'],'3': ['B'] } } } }] }],
      spell: [{ name: 'A',source: 'PHB', level: 0 },{ name: 'B',source: 'PHB', level: 0 }] },'test.json').records;
    const index = { sourceIdentity: 'source',revisionId: 'revision',records: new Map(records.map(r => [r.key,r])) };
    const spells = deriveSpellGrants([{ selectionId: 'selection',ownerKey: records.find(r => r.kind === 'feat')!.key,level: 3 }],index).instances;
    const input = { pools: [],spells,manualPools: [{ id: 'ki',kind: 'feature-uses' as const,total: 5,regain: 'SHORT_REST' as const,origins: [],manual: true }],
      previousSources: [],manualSources: [],overrides: { pools: [],sources: [] },actions: [],instanceIds: spells.map(s => s.id),proficiencyBonus: 2,modifiers: {} };
    expect(deriveResourcesAndActions(input,index).canAccept).toBe(false);
    const binding = { sourceId: spells[0].castingSourceId,resourceName: 'Ki',poolId: 'ki' };
    const result = deriveResourcesAndActions({ ...input,resourceBindings: [binding] },index);
    expect(result.canAccept).toBe(true); expect(result.costs.map(c => c.amount).sort()).toEqual([2,3]);
    expect(result.costs.every(c => c.poolId === 'ki')).toBe(true);
    expect(deriveResourcesAndActions({ ...input,resourceBindings: [binding,binding] },index).canAccept).toBe(false);
  });
});
