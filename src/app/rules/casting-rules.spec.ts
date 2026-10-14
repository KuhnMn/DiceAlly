import { mapContent } from '../content/content-adapter';
import { CharacterDocument } from './character-document';
import { acceptDocumentPreview, previewDocument } from './document-operations';
import { castDocumentSpell } from './casting-rules';
function fixture() {
  const records = mapContent({ class: [{ name: 'Mage',source: 'TEST',hd: { number: 1,faces: 6 },casterProgression: 'full',spellcastingAbility: 'int',ritualCasting: true,
    additionalSpells: [{ ability: 'int',prepared: { '1': ['Ward','Spark','Ritual'] } }] }],
    spell: [{ name: 'Ward',source: 'PHB',level: 1 },{ name: 'Spark',source: 'PHB',level: 0 },{ name: 'Ritual',source: 'PHB',level: 1,meta: { ritual: true } }] },'test.json').records;
  const index = { sourceIdentity: 'source',revisionId: 'revision',records: new Map(records.map(r => [r.key,r])) };
  const input: CharacterDocument = { format: 'ally-character',schemaVersion: 1,id: '11111111-1111-4111-8111-111111111111',rulesVersion: 'android-v1',restPolicy: 'android-v1',
    identity: { name: 'Test',description: '' },creation: { classes: { selections: [{ selectionId: 'mage',classKey: records.find(r => r.kind === 'class')!.key,level: 3 }] },
      abilities: { str: 10,dex: 14,con: 14,int: 16,wis: 10,cha: 10 },levels: { manualMaxHp: 1,applyHp: true,applyHitDice: true,manualPools: [] },stats: { armor: [],manualAc: 10,calculateAc: true },
      manualProficiencies: [],manualSpeciesContributions: [],manualSources: [],manualResources: [],actions: [],pacts: [] },
    contentBindings: [{ sourceIdentity: 'source',revisionId: 'revision',commit: 'a'.repeat(40),adapterVersion: 6,enabledPublications: [] }],overrides: { pools: [],sources: [] },
    instances: { features: [],spells: [],pools: [],sources: [],actions: [] },derived: null,session: { currentHp: 7,tempHp: 0,deathSaves: { successes: 0,failures: 0 },resources: {},annotations: { note: ['Keep'] } },
    snapshots: [],compatibility: {},extensions: {},presentation: {} };
  return { index,document: acceptDocumentPreview(input,previewDocument(input,index)) };
}
describe('Explicit spell casting', () => {
  it('uses the explicitly selected pool, supports upcasting and rejects exhausted/incorrect pools', () => {
    const f = fixture(); const spell = f.document.instances.spells.find(s => s.snapshot.name === 'Ward')!;
    const pool = f.document.instances.pools.find(p => p.kind === 'spell-slots' && p.rank === 2)!;
    const first = castDocumentSpell(f.document,{ spellId: spell.id,mode: 'slot',poolId: pool.id });
    expect(first.castLevel).toBe(2); expect(first.document.session.resources[pool.id].used).toBe(1);
    const second = castDocumentSpell(first.document,{ spellId: spell.id,mode: 'slot',poolId: pool.id });
    expect(() => castDocumentSpell(second.document,{ spellId: spell.id,mode: 'slot',poolId: pool.id })).toThrow('Insufficient');
    expect(f.document.session.resources[pool.id].used).toBe(0);
    const dice = f.document.instances.pools.find(p => p.kind === 'hit-dice')!;
    expect(() => castDocumentSpell(f.document,{ spellId: spell.id,mode: 'slot',poolId: dice.id })).toThrow('spell-slot');
    expect(first.document.session.annotations).toEqual(f.document.session.annotations);
  });
  it('casts eligible cantrips/rituals without slot use and does not infer capabilities from labels', () => {
    const f = fixture(); const cantrip = f.document.instances.spells.find(s => s.snapshot.name === 'Spark')!;
    expect(castDocumentSpell(f.document,{ spellId: cantrip.id,mode: 'cantrip' }).document.session).toEqual(f.document.session);
    const ritual = f.document.instances.spells.find(s => s.snapshot.name === 'Ritual')!;
    expect(castDocumentSpell(f.document,{ spellId: ritual.id,mode: 'ritual' }).document.session).toEqual(f.document.session);
    f.document.instances.sources[0].ritualCasting = false; f.document.instances.sources[0].label = 'Ritual expert';
    expect(() => castDocumentSpell(f.document,{ spellId: ritual.id,mode: 'ritual' })).toThrow('ritual');
    expect(() => castDocumentSpell(f.document,{ spellId: ritual.id,mode: 'at-will' })).toThrow('at-will');
  });
  it('requires known-caster configuration and rejects under-level slots/cantrip slot spending', () => {
    const f = fixture(); const spell = f.document.instances.spells.find(s => s.snapshot.name === 'Ward')!; spell.list = 'known';
    const pool = f.document.instances.pools.find(p => p.kind === 'spell-slots')!;
    expect(() => castDocumentSpell(f.document,{ spellId: spell.id,mode: 'slot',poolId: pool.id })).toThrow('configured');
    f.document.instances.sources[0].preparation = 'known';
    expect(castDocumentSpell(f.document,{ spellId: spell.id,mode: 'slot',poolId: pool.id }).castLevel).toBe(1);
    spell.snapshot.data['level'] = 2; expect(() => castDocumentSpell(f.document,{ spellId: spell.id,mode: 'slot',poolId: pool.id })).toThrow('at or above');
    spell.snapshot.data['level'] = 0; expect(() => castDocumentSpell(f.document,{ spellId: spell.id,mode: 'slot',poolId: pool.id })).toThrow('Cantrips');
  });
});
