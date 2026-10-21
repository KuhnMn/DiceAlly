import { mapContent } from '../content/content-adapter';
import { CharacterRulesInput, previewCharacterRules } from './character-preview';
describe('Whole-character rule previews', () => {
  function fixture() {
    const records = mapContent({ class: [{ name: 'Mage',source: 'TEST',hd: { number: 1,faces: 6 },proficiency: ['int'],casterProgression: 'full' }],
      spell: [{ name: 'Light',source: 'PHB',level: 0 }] },'synthetic.json').records;
    records.push({ key: 'sky',kind: 'species',name: 'Sky',publication: 'TEST',file: 'synthetic',links: [],
      data: { speed: { walk: { number: 30 } },languageProficiencies: [{ common: true }],additionalSpells: [{ innate: { '1': ['Light'] } }] } });
    const input: CharacterRulesInput = {
      classes: { selections: [{ selectionId: 'mage',classKey: records.find(r => r.kind === 'class')!.key,level: 3 }] },
      levels: { manualMaxHp: 12,applyHp: true,applyHitDice: true,manualPools: [] },
      abilities: { str: 10,dex: 14,con: 14,int: 16,wis: 10,cha: 10 },
      stats: { armor: [],calculateAc: true,manualAc: 10 },
      session: { currentHp: 7,tempHp: 4,deathSaves: { successes: 1,failures: 0 },resources: {},annotations: { note: ['Keep'] } },
      manualProficiencies: [{ kind: 'skill',target: 'arcana',rank: 2,origin: 'manual' }],
      species: { id: 'species',key: 'sky' },manualSpeciesContributions: [{ field: 'resist',value: 'acid',origin: 'manual' }],
      previous: { features: [],spells: [],pools: [] },
    };
    return { input,index: { sourceIdentity: 'source',revisionId: 'revision',records: new Map(records.map(r => [r.key,r])) } };
  }
  it('composes species spells/proficiencies, class totals, stats and detached session without play actions', () => {
    const f = fixture(); const first = previewCharacterRules(f.input,f.index);
    expect(first.canAccept).toBe(true); expect(first.proposed?.maxHp).toBe(20); expect(first.proposed?.stats.ac).toBe(12);
    expect(first.proposed?.spells).toHaveLength(1); expect(first.proposed?.proficiencies.some(c => c.target === 'common')).toBe(true);
    expect(first.proposed?.session.tempHp).toBe(4); expect(first.proposed?.session.deathSaves.successes).toBe(1);
    const proposed = first.proposed!;
    const repeated = previewCharacterRules({ ...f.input,previous: { features: proposed.features,spells: proposed.spells,pools: proposed.pools,species: proposed.species },session: proposed.session },f.index);
    expect(repeated.proposed).toEqual(proposed);
    proposed.session.annotations['note'].push('Changed'); expect(f.input.session.annotations['note']).toEqual(['Keep']);
  });
  it('blocks incomplete components and requests explicit HP/counter adjustments on shrinking totals', () => {
    const f = fixture(); const first = previewCharacterRules(f.input,f.index).proposed!;
    expect(previewCharacterRules({ ...f.input,species: { id: 'species',key: 'missing' } },f.index).proposed).toBeUndefined();
    const slot = first.pools.find(p => p.kind === 'spell-slots')!;
    const session = structuredClone(first.session); session.currentHp = 20; session.resources[slot.id].used = 4;
    const lower = previewCharacterRules({ ...f.input,classes: { selections: [{ ...f.input.classes.selections[0],level: 1 }] },
      session,previous: { features: first.features,spells: first.spells,pools: first.pools,species: first.species } },f.index);
    expect(lower.canAccept).toBe(false); expect(lower.requiresAdjustments).toBe(true);
    expect(lower.proposed?.session.currentHp).toBe(20); expect(lower.proposed?.session.resources[slot.id].used).toBe(4);
    expect(lower.adjustments.some(a => a.kind === 'hp-above-maximum')).toBe(true);
  });
  it('keeps manual scores authoritative even when a saved species automation flag is enabled', () => {
    const f = fixture(); f.index.records.get('sky')!.data['ability'] = [{ con: 2 }];
    const first = previewCharacterRules({ ...f.input,applySpeciesAbilities: true },f.index);
    expect(first.proposed?.maxHp).toBe(20); expect(first.proposed?.effectiveAbilities.con).toBe(14);
    expect(first.proposed?.abilityContributions).toEqual([]); expect(f.input.abilities.con).toBe(14);
    const repeated = previewCharacterRules({ ...f.input,applySpeciesAbilities: true,previous: { features: first.proposed!.features,spells: first.proposed!.spells,pools: first.proposed!.pools,species: first.proposed!.species } },f.index);
    expect(repeated.proposed?.maxHp).toBe(20);
    const sea = structuredClone(f.index.records.get('sky')!); sea.key = 'sea'; sea.name = 'Sea'; sea.data['ability'] = [{ wis: 2 }]; f.index.records.set('sea',sea);
    const changed = previewCharacterRules({ ...f.input,applySpeciesAbilities: true,species: { id: 'species',key: 'sea' } },f.index);
    expect(changed.proposed?.maxHp).toBe(20); expect(changed.proposed?.effectiveAbilities.con).toBe(14); expect(changed.proposed?.effectiveAbilities.wis).toBe(10);
  });
  it('supports explicitly disabled proficiency automation while retaining manual expertise', () => {
    const f = fixture(); f.index.records.get('sky')!.data['languageProficiencies'] = [{ anyStandard: 1 }];
    expect(previewCharacterRules(f.input,f.index).canAccept).toBe(false);
    const manual = previewCharacterRules({ ...f.input,applyProficiencies: false },f.index);
    expect(manual.canAccept).toBe(true); expect(manual.proposed?.proficiencies).toEqual(f.input.manualProficiencies);
    expect(manual.proposed?.stats.skills.arcana).toBe(7);
  });
  it('uses manual ability scores for prerequisites regardless of imported bonuses or supplemental scores', () => {
    const f = fixture();
    const owner = f.index.records.get(f.input.classes.selections[0].classKey)!;
    owner.data['optionalfeatureProgression'] = [{ name: 'Options',featureType: ['TEST'],progression: { '1': 1 } }];
    const option = mapContent({ optionalfeature: [{ name: 'Strong',source: 'TEST',featureType: ['TEST'],prerequisite: [{ ability: [{ str: 12 }] }] }] },'test.json').records[0];
    f.index.records.set(option.key,option);
    const pending = previewCharacterRules(f.input,f.index);
    const slot = pending.classes.slots!.slots[0];
    f.input.classes.optionalAnswers = { [slot.id]: [option.key] };
    f.input.classes.optionalPrerequisites = { totalLevel: 20,classes: [],spells: new Set(),optionalFeatures: new Set(),pacts: new Set(),abilities: { str: 30 } };
    expect(previewCharacterRules(f.input,f.index).proposed).toBeUndefined();
    f.index.records.get('sky')!.data['ability'] = [{ str: 2 }];
    const enabled = previewCharacterRules({ ...f.input,applySpeciesAbilities: true },f.index);
    expect(enabled.canAccept).toBe(false); expect(enabled.proposed).toBeUndefined();
    expect(f.input.abilities.str).toBe(10);
    expect(previewCharacterRules({ ...f.input,applySpeciesAbilities: false },f.index).proposed).toBeUndefined();
    f.input.abilities.str = 12;
    const manual = previewCharacterRules(f.input,f.index);
    expect(manual.canAccept).toBe(true); expect(manual.proposed?.effectiveAbilities.str).toBe(12);
  });
  it('blocks the whole proposal until a proficiency package is selected and regenerates on switching', () => {
    const f = fixture(); f.index.records.get('sky')!.data['languageProficiencies'] = [{ common: true },{ elvish: true }];
    const pending = previewCharacterRules(f.input,f.index);
    expect(pending.proposed).toBeUndefined(); const pkg = pending.proficiencies.packages[0];
    const first = previewCharacterRules({ ...f.input,proficiencyAnswers: { [pkg.id]: ['0'] } },f.index);
    expect(first.canAccept).toBe(true);
    const second = previewCharacterRules({ ...f.input,proficiencyAnswers: { [pkg.id]: ['1'] } },f.index);
    expect(second.canAccept).toBe(true);
    expect(second.proposed?.proficiencies.some(c => c.target === 'common')).toBe(false);
    expect(second.proposed?.proficiencies.some(c => c.target === 'elvish')).toBe(true);
    expect(second.proposed?.stats.skills.arcana).toBe(first.proposed?.stats.skills.arcana);
    expect(second.proposed?.session).toEqual(first.proposed?.session);
  });
});
