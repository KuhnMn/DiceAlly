import { mapContent } from '../content/content-adapter';
import { previewClassRules } from './class-preview';
import { deriveOptionalSlots } from './optional-progression';
describe('Composed class previews', () => {
  function dependencies(cyclic = false) {
    const f = fixture(); const owner = f.index.records.get(f.input.selections[0].classKey)!;
    owner.data['optionalfeatureProgression'] = [{ name: 'Options',featureType: ['TEST'],progression: { '1': 3 } }];
    const options = mapContent({ optionalfeature: [
      { name: 'Root',source: 'TEST',featureType: ['TEST'],...(cyclic ? { prerequisite: [{ optionalfeature: ['End|TEST'] }] } : {}),
        additionalSpells: [{ known: { '1': ['Light'] } }] },
      { name: 'Middle',source: 'TEST',featureType: ['TEST'],prerequisite: [{ optionalfeature: ['Root|TEST'] }] },
      { name: 'End',source: 'TEST',featureType: ['TEST'],prerequisite: [{ optionalfeature: ['Middle|TEST'],spell: ['Light'] }] },
    ] },'test.json').records;
    for (const record of options) f.index.records.set(record.key,record);
    owner.data['additionalSpells'] = []; owner.data['classFeatures'] = []; owner.links = [];
    const slot = deriveOptionalSlots(f.input.selections,f.index).slots[0];
    return { ...f,options,slot,input: { ...f.input,optionalAnswers: { [slot.id]: options.map(o => o.key).reverse() } } };
  }
  it('resolves optional-feature and spell dependencies independent of selection order', () => {
    const f = dependencies(); const first = previewClassRules(f.input,f.index);
    expect(first.canAccept).toBe(true); expect(first.proposed.features).toHaveLength(3); expect(first.proposed.spells).toHaveLength(1);
    const reordered = previewClassRules({ ...f.input,optionalAnswers: { [f.slot.id]: f.options.map(o => o.key) } },f.index);
    expect(reordered.canAccept).toBe(true);
    expect(reordered.proposed.features.map(f => f.contentKey).sort()).toEqual(first.proposed.features.map(f => f.contentKey).sort());
    expect(previewClassRules({ ...f.input,previousFeatures: first.proposed.features,previousSpells: first.proposed.spells },f.index).proposed).toEqual(first.proposed);
  });
  it('rejects cycles even when previous generated instances exist', () => {
    const valid = dependencies(); const first = previewClassRules(valid.input,valid.index);
    const cyclic = dependencies(true);
    const blocked = previewClassRules({ ...cyclic.input,previousFeatures: first.proposed.features,previousSpells: first.proposed.spells },cyclic.index);
    expect(blocked.canAccept).toBe(false); expect(blocked.proposed.features).toEqual(first.proposed.features);
    expect(blocked.diagnostics.some(d => d.includes('optionalfeature prerequisite'))).toBe(true);
  });
  it('does not use suppressed optional grants to satisfy dependent selections', () => {
    const f = dependencies(); const first = previewClassRules(f.input,f.index);
    const root = first.proposed.features.find(feature => feature.snapshot.name === 'Root')!;
    const blocked = previewClassRules({ ...f.input,previousFeatures: first.proposed.features,previousSpells: first.proposed.spells,
      featureSuppressions: root.grants.map(g => g.id) },f.index);
    expect(blocked.canAccept).toBe(false); expect(blocked.proposed.spells).toEqual(first.proposed.spells);
  });
  function withSpellPrerequisite(required: string,grantOwnSpell = false) {
    const f = fixture(); const parent = f.index.records.get(f.input.selections[0].classKey)!;
    parent.data['optionalfeatureProgression'] = [{ name: 'Options',featureType: ['TEST'],progression: { '1': 1 } }];
    const option = mapContent({ optionalfeature: [{ name: 'Option',source: 'TEST',featureType: ['TEST'],prerequisite: [{ spell: [required] }],
      ...(grantOwnSpell ? { additionalSpells: [{ known: { '1': ['Shield|TEST'] } }] } : {}) }] },'test.json').records[0];
    f.index.records.set(option.key,option);
    const slot = deriveOptionalSlots(f.input.selections,f.index).slots[0];
    return { ...f,input: { ...f.input,optionalAnswers: { [slot.id]: [option.key] } } };
  }
  function fixture() {
    const records = mapContent({ class: [{ name: 'Mage',source: 'TEST',hd: { number: 1,faces: 6 },casterProgression: 'full',
      classFeatures: ['Gift|Mage|TEST|3'],additionalSpells: [{ known: { '1': ['Light'] } }] }],
      classFeature: [{ name: 'Gift',source: 'TEST',className: 'Mage',classSource: 'TEST',level: 3,additionalSpells: [{ prepared: { '1': [{ all: 'level=1' }] } }] }],
      spell: [{ name: 'Light',source: 'PHB',level: 0 },{ name: 'Shield',source: 'TEST',level: 1 }],
    },'synthetic.json').records;
    return { index: { sourceIdentity: 'source',revisionId: 'revision',records: new Map(records.map(r => [r.key,r])) },
      input: { selections: [{ selectionId: 'mage',classKey: records.find(r => r.kind === 'class')!.key,level: 3 }],
        levels: { constitution: 14,manualMaxHp: 1,applyHp: true,applyHitDice: true,manualPools: [] },
        session: { currentHp: 5,resources: {},annotations: { note: ['Keep'] } } } };
  }
  it('includes only eligible feature spell owners and preserves state on repeat/decrease', () => {
    const f = fixture(); const first = previewClassRules(f.input,f.index);
    expect(first.canAccept).toBe(true); expect(first.proposed.features).toHaveLength(1); expect(first.proposed.spells).toHaveLength(2);
    expect(first.levels?.maxHp).toBe(20);
    const repeated = previewClassRules({ ...f.input,previousFeatures: first.proposed.features,previousSpells: first.proposed.spells,previousPools: first.proposed.pools },f.index);
    expect(repeated.proposed).toEqual(first.proposed);
    const lower = previewClassRules({ ...f.input,selections: [{ ...f.input.selections[0],level: 1 }],previousFeatures: first.proposed.features,previousSpells: first.proposed.spells },f.index);
    expect(lower.proposed.features).toHaveLength(0); expect(lower.proposed.spells).toHaveLength(1);
    expect(lower.spells?.removed).toHaveLength(1);
  });
  it('uses current independent class/feature spell grants and reevaluates them after level loss or suppression', () => {
    const f = withSpellPrerequisite('Shield|TEST'); const first = previewClassRules(f.input,f.index);
    expect(first.canAccept).toBe(true);
    const suppressed = previewClassRules({ ...f.input,previousFeatures: first.proposed.features,previousSpells: first.proposed.spells,
      spellSuppressions: first.proposed.spells.find(s => s.snapshot.name === 'Shield')!.grants.map(g => g.id) },f.index);
    expect(suppressed.canAccept).toBe(false); expect(suppressed.proposed.spells).toEqual(first.proposed.spells);
    const lower = previewClassRules({ ...f.input,selections: [{ ...f.input.selections[0],level: 1 }],
      previousFeatures: first.proposed.features,previousSpells: first.proposed.spells },f.index);
    expect(lower.canAccept).toBe(false); expect(lower.diagnostics.some(d => d.includes('spell prerequisite'))).toBe(true);
    const classSpell = withSpellPrerequisite('Light#c'); expect(previewClassRules(classSpell.input,classSpell.index).canAccept).toBe(true);
  });
  it('excludes expanded availability and prevents an optional feature from granting its own prerequisite', () => {
    const f = withSpellPrerequisite('Shield|TEST',true);
    const owner = f.index.records.get(f.input.selections[0].classKey)!;
    owner.data['classFeatures'] = []; owner.links = owner.links.filter(link => link.role !== 'classFeature');
    owner.data['additionalSpells'] = [{ expanded: { '1': ['Shield|TEST'] } }];
    const blocked = previewClassRules(f.input,f.index);
    expect(blocked.canAccept).toBe(false); expect(blocked.diagnostics.some(d => d.includes('spell prerequisite'))).toBe(true);
  });
  it('blocks the entire composed replacement if a spell reference is missing', () => {
    const f = fixture(); const first = previewClassRules(f.input,f.index);
    const records = new Map(f.index.records); for (const r of records.values()) if (r.name === 'Shield') records.delete(r.key);
    const blocked = previewClassRules({ ...f.input,previousFeatures: first.proposed.features,previousSpells: first.proposed.spells,previousPools: first.proposed.pools },{ ...f.index,records });
    expect(blocked.canAccept).toBe(false); expect(blocked.proposed.features).toEqual(first.proposed.features);
    expect(blocked.proposed.spells).toEqual(first.proposed.spells); expect(blocked.proposed.session).toEqual(f.input.session);
  });
  it('suppresses dependent feature spells and blocks unresolved class-level eligibility atomically', () => {
    const f = fixture(); const first = previewClassRules(f.input,f.index);
    const suppressed = previewClassRules({ ...f.input,previousFeatures: first.proposed.features,previousSpells: first.proposed.spells,
      featureSuppressions: [first.proposed.features[0].grants[0].id] },f.index);
    expect(suppressed.canAccept).toBe(true); expect(suppressed.proposed.spells).toHaveLength(1);
    const parent = structuredClone([...f.index.records.values()].find(r => r.kind === 'class')!);
    parent.data['additionalSpells'] = [{ known: { s1: ['Light'] } }];
    const records = new Map(f.index.records); records.set(parent.key,parent);
    const pending = previewClassRules({ ...f.input,previousFeatures: first.proposed.features,previousSpells: first.proposed.spells },{ ...f.index,records });
    expect(pending.canAccept).toBe(false); expect(pending.proposed.spells).toEqual(first.proposed.spells);
  });
  it('composes optional progression choices, prerequisites and their spells into one atomic preview', () => {
    const f = fixture(); const parent = structuredClone([...f.index.records.values()].find(r => r.kind === 'class')!);
    parent.data['optionalfeatureProgression'] = [{ name: 'Options',featureType: ['TEST'],progression: { '3': 1 } }];
    const option = mapContent({ optionalfeature: [{ name: 'Option',source: 'TEST',featureType: ['TEST'],
      prerequisite: [{ level: { level: 3,class: { name: 'Mage',source: 'TEST' } } }],additionalSpells: [{ innate: { '1': ['Light'] } }] }] },'test.json').records[0];
    const records = new Map(f.index.records); records.set(parent.key,parent); records.set(option.key,option);
    const index = { ...f.index,records }; const slot = deriveOptionalSlots(f.input.selections,index).slots[0];
    expect(previewClassRules(f.input,index).canAccept).toBe(false);
    const selected = previewClassRules({ ...f.input,optionalAnswers: { [slot.id]: [option.key] } },index);
    expect(selected.canAccept).toBe(true); expect(selected.proposed.features).toHaveLength(2); expect(selected.proposed.spells).toHaveLength(3);
    const repeated = previewClassRules({ ...f.input,optionalAnswers: { [slot.id]: [option.key] },previousFeatures: selected.proposed.features,previousSpells: selected.proposed.spells },index);
    expect(repeated.proposed.features).toEqual(selected.proposed.features); expect(repeated.proposed.spells).toEqual(selected.proposed.spells);
    const lower = previewClassRules({ ...f.input,selections: [{ ...f.input.selections[0],level: 1 }],previousFeatures: selected.proposed.features,previousSpells: selected.proposed.spells },index);
    expect(lower.canAccept).toBe(true); expect(lower.proposed.features).toHaveLength(0); expect(lower.proposed.spells).toHaveLength(1);
  });
});
