import { mapContent } from '../content/content-adapter';
import { deriveOptionalSlots } from './optional-progression';
import { checkPrerequisites, PrerequisiteContext } from './prerequisites';
import { deriveStats, ProficiencyContribution } from './derived-stats';
import { deriveProficiencyGrants } from './proficiency-rules';
import { deriveOptionalFeatures } from './optional-feature-rules';
const context: PrerequisiteContext = { totalLevel: 5,classes: [{ name: 'Mage',publication: 'TEST',level: 3 }],
  spells: new Set(['["spell","light","phb"]']),optionalFeatures: new Set(),pacts: new Set(['Tome']) };
function fixture() {
  const records = mapContent({ class: [{ name: 'Mage',source: 'TEST',proficiency: ['int','wis'],startingProficiencies: { weapons: ['simple'],skills: [{ choose: { from: ['arcana','history'],count: 1 } }] },
    optionalfeatureProgression: [{ name: 'Options',featureType: ['TEST'],progression: { '1': 1,'3': 2,'5': 3 } }] },
    { name: 'Other',source: 'TEST',proficiency: ['str'],startingProficiencies: { armor: ['heavy'] },multiclassing: { proficienciesGained: { armor: ['light'] } } }],
    optionalfeature: [{ name: 'Choice',source: 'TEST',featureType: ['TEST'],prerequisite: [{ level: { level: 3,class: { name: 'Mage',source: 'TEST' } },spell: ['light#c'] }] }],
  },'synthetic.json').records;
  return { records,index: { sourceIdentity: 'source',revisionId: 'revision',records: new Map(records.map(r => [r.key,r])) },
    selections: [{ selectionId: 'mage',classKey: records.find(r => r.name === 'Mage')!.key,level: 4 }] };
}
describe('Optional progression and prerequisites', () => {
  it('checks ability alternatives and combined thresholds without assuming missing scores', () => {
    const scores = { ...context,abilities: { str: 12,dex: 14,int: 16 } };
    expect(checkPrerequisites([{ ability: [{ str: 13 },{ dex: 13 }] }],scores).satisfied).toBe(true);
    expect(checkPrerequisites([{ ability: [{ dex: 13,int: 17 }] }],scores).satisfied).toBe(false);
    expect(checkPrerequisites([{ ability: [{ dex: 13,int: 16 }],level: 6 }],scores).satisfied).toBe(false);
    expect(checkPrerequisites([{ ability: [{ wis: 1 }] }],scores).satisfied).toBe(false);
    expect(checkPrerequisites([{ ability: [{ dex: 13 }] }],context).satisfied).toBe(false);
  });
  it('rejects unsupported ability shapes rather than partially satisfying them', () => {
    const scores = { ...context,abilities: { dex: 14 } };
    for (const ability of [[],[{}],[{ dex: 13.5 }],[{ dex: 0 }],[{ dex: 31 }],[{ dex: 13,luck: 1 }],{ dex: 13 }]) {
      expect(checkPrerequisites([{ ability }],scores).satisfied).toBe(false);
    }
    expect(checkPrerequisites([{ ability: [{ dex: 13 }] }],{ ...context,abilities: { dex: NaN } }).satisfied).toBe(false);
  });
  it('uses cumulative breakpoint and level-array counts with stable slot IDs', () => {
    const f = fixture(); const slots = deriveOptionalSlots(f.selections,f.index);
    expect(slots.canAccept).toBe(true); expect(slots.slots[0].count).toBe(2);
    const higher = deriveOptionalSlots([{ ...f.selections[0],level: 5 }],f.index);
    expect(higher.slots[0].id).toBe(slots.slots[0].id); expect(higher.slots[0].count).toBe(3);
    const parent = structuredClone(f.records.find(r => r.kind === 'class')!);
    parent.data['optionalfeatureProgression'] = [{ name: 'Options',featureType: ['TEST'],progression: [0,1,2,2,3] }];
    const records = new Map(f.index.records); records.set(parent.key,parent);
    expect(deriveOptionalSlots(f.selections,{ ...f.index,records }).slots[0].count).toBe(2);
  });
  it('requires all conditions in an alternative and exact class/publication identity', () => {
    expect(checkPrerequisites([{ level: 5,spell: ['light#c'],pact: 'Tome' }],context).satisfied).toBe(true);
    expect(checkPrerequisites([{ level: { level: 3,class: { name: 'Mage',source: 'OTHER' } } }],context).satisfied).toBe(false);
    expect(checkPrerequisites([{ item: ['descriptive equipment'] }],context).satisfied).toBe(false);
    expect(checkPrerequisites([{ item: ['unknown'] },{ level: 1 }],context).satisfied).toBe(true);
    expect(checkPrerequisites([{ spell: [{ choose: 'level=0' }] }],context).satisfied).toBe(false);
  });
  it('evaluates prerequisites for selected options rather than assuming them', () => {
    const f = fixture(); const slot = deriveOptionalSlots([{ ...f.selections[0],level: 1 }],f.index).slots[0];
    slot.selectedKeys = [f.records.find(r => r.kind === 'optionalfeature')!.key];
    expect(deriveOptionalFeatures([slot],f.index,[],[],context).canAccept).toBe(true);
    expect(deriveOptionalFeatures([slot],f.index,[],[],{ ...context,spells: new Set() }).canAccept).toBe(false);
  });
});
describe('Proficiency contribution extraction', () => {
  it('uses starting saves and explicit choices, then multiclass gains while preserving manual values', () => {
    const f = fixture(); const selections = [...f.selections,{ selectionId: 'other',classKey: f.records.find(r => r.name === 'Other')!.key,level: 1 }];
    const manual: ProficiencyContribution[] = [{ kind: 'skill',target: 'arcana',rank: 2,origin: 'manual' }];
    const pending = deriveProficiencyGrants(selections,f.index,{},undefined,manual); expect(pending.canAccept).toBe(false);
    const result = deriveProficiencyGrants(selections,f.index,{ [pending.choices[0].id]: ['history'] },undefined,manual);
    expect(result.canAccept).toBe(true); expect(result.manual).toEqual(manual);
    expect(result.generated.filter(c => c.kind === 'save').map(c => c.target)).toEqual(['int','wis']);
    expect(result.generated.filter(c => c.kind === 'armor').map(c => c.target)).toEqual(['light']);
  });
});
describe('Derived Android stats policy', () => {
  const input = () => ({ abilities: { str: 10,dex: 14,con: 16,int: 12,wis: 10,cha: 8 },totalLevel: 5,manual: [] as ProficiencyContribution[],generated: [] as ProficiencyContribution[],
    armor: [] as Parameters<typeof deriveStats>[0]['armor'],calculateAc: true,manualAc: 11 });
  it('B14/B15: calculates unarmored defense, medium armor and shield', () => {
    const base = input(); expect(deriveStats(base).ac).toBe(12); expect(deriveStats({ ...base,unarmoredAbility: 'con' }).ac).toBe(15);
    base.armor = [{ id: 'armor',type: 'medium',ac: 14,bonus: 0,equipped: true,requiresAttunement: false,attuned: false },
      { id: 'shield',type: 'shield',ac: 2,bonus: 0,equipped: true,requiresAttunement: false,attuned: false }];
    expect(deriveStats(base).ac).toBe(18);
    base.armor[0].equipped = false; expect(deriveStats(base).ac).toBe(14);
    base.armor[1].requiresAttunement = true; expect(deriveStats(base).ac).toBe(12);
  });
  it('preserves manual expertise, explicit half proficiency, bonuses and zero overrides', () => {
    const base = input(); base.manual = [{ kind: 'skill',target: 'arcana',rank: 2,origin: 'manual' },{ kind: 'skill',target: 'stealth',rank: 0.5,origin: 'manual' }];
    base.generated = [{ kind: 'skill',target: 'arcana',rank: 1,origin: 'class' },{ kind: 'save',target: 'wis',rank: 1,origin: 'class' }];
    const result = deriveStats({ ...base,skillBonuses: { arcana: 2 },saveBonuses: { wis: 1 },initiativeProficient: true });
    expect(result.skills.arcana).toBe(9); expect(result.skills.stealth).toBe(3); expect(result.saves.wis).toBe(4); expect(result.initiative).toBe(5);
    expect(deriveStats({ ...base,acOverride: 0,initiativeOverride: 0 }).ac).toBe(0);
    expect(deriveStats({ ...base,acOverride: 0,initiativeOverride: 0 }).initiative).toBe(0);
    result.manual[0].rank = 0; expect(base.manual[0].rank).toBe(2);
  });
  it('does not add dexterity to heavy armor or ignore a negative medium-armor modifier', () => {
    const base = input(); base.abilities.dex = 6;
    base.armor = [{ id: 'armor',type: 'medium',ac: 14,bonus: 0,equipped: true,requiresAttunement: false,attuned: false }];
    expect(deriveStats(base).ac).toBe(12); base.armor[0].type = 'heavy'; expect(deriveStats(base).ac).toBe(14);
  });
});
