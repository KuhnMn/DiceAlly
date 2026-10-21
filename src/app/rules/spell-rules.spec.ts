import { mapContent } from '../content/content-adapter';
import { deriveSpellGrants, SpellGrantOwner } from './spell-rules';
function fixture(additionalSpells: unknown) {
  const records = mapContent({ feat: [{ name: 'Gift',source: 'TEST',additionalSpells }],
    spell: [{ name: 'Light',source: 'PHB',level: 0 },{ name: 'Shield',source: 'TEST',level: 1 }] },'test.json').records;
  const owner: SpellGrantOwner = { selectionId: 'selection',ownerKey: records.find(r => r.kind === 'feat')!.key,level: 3 };
  return { owner, index: { sourceIdentity: 'source',revisionId: 'revision',records: new Map(records.map(r => [r.key,r])) } };
}
describe('Spell grant previews', () => {
  it('gates grants by level and separates expanded catalogues from actual spells', () => {
    const f = fixture([{ ability: 'int',known: { '1': ['Light#c'],'5': ['Shield|TEST'] },prepared: { '3': ['Shield|TEST'] },expanded: { '1': ['Shield|TEST'] } }]);
    const result = deriveSpellGrants([f.owner],f.index);
    expect(result.canAccept).toBe(true); expect(result.instances.map(s => s.list)).toEqual(['known','prepared']);
    expect(result.expanded).toHaveLength(1); expect(result.instances[0].grants[0].ability).toBe('int');
  });
  it('requires explicit choices and validates count, candidates and uniqueness', () => {
    const f = fixture([{ known: { '1': [{ choose: { from: ['Light','Shield|TEST'],count: 1 } }] } }]);
    const unanswered = deriveSpellGrants([f.owner],f.index); expect(unanswered.canAccept).toBe(false);
    const choice = unanswered.choices[0];
    const selected = deriveSpellGrants([f.owner],f.index,[],{ [choice.id]: [choice.candidates[0]] });
    expect(selected.canAccept).toBe(true); expect(selected.instances).toHaveLength(1);
    expect(deriveSpellGrants([f.owner],f.index,[],{ [choice.id]: ['unlisted'] }).canAccept).toBe(false);
  });
  it('does not guess filters, block selections or casting abilities', () => {
    const filters = fixture([{ expanded: { '1': [{ all: 'unsupported=1' }] } }]);
    const result = deriveSpellGrants([filters.owner],filters.index);
    expect(result.canAccept).toBe(false); expect(result.choices[0].query).toBe('unsupported=1');
    const blocks = fixture([{ known: { '1': ['Light'] } },{ known: { '1': ['Shield|TEST'] } }]);
    expect(deriveSpellGrants([blocks.owner],blocks.index).canAccept).toBe(false);
    expect(deriveSpellGrants([{ ...blocks.owner,blocks: [1] }],blocks.index).instances).toHaveLength(1);
    const abilities = fixture([{ ability: { choose: ['int','wis'] },known: { '1': ['Light'] } }]);
    expect(deriveSpellGrants([abilities.owner],abilities.index).canAccept).toBe(false);
    expect(deriveSpellGrants([{ ...abilities.owner,ability: 'wis' }],abilities.index).canAccept).toBe(true);
  });
  it('preserves state on repeat, separates casting sources and reports removed grants', () => {
    const f = fixture([{ known: { '1': ['Light'],'3': ['Shield|TEST'] } }]);
    const first = deriveSpellGrants([f.owner],f.index); first.instances[0].id = 'assigned'; first.instances[0].customization = { notes: ['Keep'],used: 2 };
    expect(deriveSpellGrants([f.owner],f.index,first.instances).instances).toEqual(first.instances);
    const lower = deriveSpellGrants([{ ...f.owner,level: 1 }],f.index,first.instances);
    expect(lower.removed).toHaveLength(1); expect(lower.instances[0].customization['used']).toBe(2);
    const twoSources = deriveSpellGrants([f.owner,{ ...f.owner,selectionId: 'other' }],f.index);
    expect(twoSources.instances).toHaveLength(4);
    expect(new Set(twoSources.instances.map(s => s.castingSourceId)).size).toBe(2);
    expect(deriveSpellGrants([f.owner],{ ...f.index,revisionId: 'new' },first.instances).canAccept).toBe(false);
  });
  it('retains manual spells and suppression while preserving distinct innate usage definitions', () => {
    const f = fixture([{ innate: { '1': { daily: { '1e': ['Light'],'2': ['Light'] } } } }]);
    const first = deriveSpellGrants([f.owner],f.index); expect(first.instances).toHaveLength(2);
    expect(first.instances.some(s => s.grants[0].usage['count'] === '1e')).toBe(true);
    first.instances[0].manual = true;
    const suppressed = first.instances.flatMap(s => s.grants.map(g => g.id));
    const result = deriveSpellGrants([f.owner],f.index,first.instances,{},suppressed);
    expect(result.instances).toHaveLength(1); expect(result.instances[0].grants).toEqual([]);
  });
  it('requires spell-level inputs and refuses publication fallback', () => {
    const f = fixture([{ known: { s1: ['Shield|TEST'] } }]);
    expect(deriveSpellGrants([f.owner],f.index).canAccept).toBe(false);
    expect(deriveSpellGrants([{ ...f.owner,maxSpellLevel: 1 }],f.index).canAccept).toBe(true);
    const missing = fixture([{ known: { '1': ['Light|TEST'] } }]);
    expect(deriveSpellGrants([missing.owner],missing.index).canAccept).toBe(false);
  });
  it('retains a spell when one shared grant is suppressed and does not mutate prior customization', () => {
    const f = fixture([{ known: { '1': ['Light'],'3': ['Light'] } }]);
    const first = deriveSpellGrants([f.owner],f.index);
    expect(first.instances).toHaveLength(1); expect(first.instances[0].grants).toHaveLength(2);
    first.instances[0].customization = { used: 2,notes: ['Keep'] };
    const result = deriveSpellGrants([f.owner],f.index,first.instances,{},[first.instances[0].grants[0].id]);
    expect(result.instances).toHaveLength(1); expect(result.instances[0].grants).toHaveLength(1);
    result.instances[0].customization['used'] = 3;
    expect(first.instances[0].customization['used']).toBe(2);
  });
  it('evaluates all selectors and validates answers against filtered candidates', () => {
    const all = fixture([{ expanded: { '1': [{ all: 'level=1' }] } }]);
    const available = deriveSpellGrants([all.owner],all.index);
    expect(available.canAccept).toBe(true); expect(available.expanded).toHaveLength(1); expect(available.instances).toEqual([]);
    const choose = fixture([{ known: { '1': [{ choose: 'level=0' }] } }]);
    const pending = deriveSpellGrants([choose.owner],choose.index); const choice = pending.choices[0];
    expect(pending.canAccept).toBe(false); expect(choice.candidates).toHaveLength(1);
    expect(deriveSpellGrants([choose.owner],choose.index,[],{ [choice.id]: choice.candidates }).canAccept).toBe(true);
  });
  it('keeps exact grant IDs, recharge usage and prior state through schema traversal', () => {
    const f = fixture([{ resourceName: 'Focus', innate: { '1': {
      _: ['Light'], will: ['Light'], ritual: ['Light'], daily: { '2e': ['Light'] },
      rest: { int: ['Light'] }, resource: { '1': ['Light'] },
    } } }]);
    const first = deriveSpellGrants([f.owner], f.index);
    expect(first.canAccept).toBe(true);
    const sourceId = JSON.stringify(['casting-source', 'source', 'selection', f.owner.ownerKey, 0]);
    const paths = ['_', 'will', 'ritual', 'daily.2e', 'rest.int', 'resource.1'];
    expect(first.instances.map(instance => instance.grants[0].id)).toEqual(paths.map(path =>
      JSON.stringify(['spell-grant', sourceId, 'innate', `additionalSpells[0].innate.1.${path}[0]`, first.instances[0].contentKey])));
    expect(first.instances[3].grants[0].usage).toEqual({ frequency: 'daily', count: '2e', resourceName: 'Focus' });
    first.instances.forEach((instance, position) => {
      instance.id = `saved-${position}`; instance.customization = { notes: ['Keep'], used: position };
    });
    expect(deriveSpellGrants([f.owner], f.index, first.instances).instances).toEqual(first.instances);
    for (const limited of [{ '1': ['Light'] }, {}]) {
      const unsupported = fixture([{ innate: { '1': { limited } } }]);
      const blocked = deriveSpellGrants([unsupported.owner], unsupported.index, first.instances);
      expect(blocked.canAccept).toBe(false);
      expect(blocked.diagnostics.some(issue => issue.includes('Unsupported spell grant structure'))).toBe(true);
      expect(blocked.instances).toEqual(first.instances);
    }
  });

});
