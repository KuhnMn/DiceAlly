import type { ExportedCharacter, FeatureEntryFull } from './character.model';
import { abilityBonusSources, applyAbilityBonuses, calculateAbilityBonuses, featureBonusSourceId, backgroundBonusSourceId,
  setAbilityBonusesEnabled, asiBonusOptions } from './ability-score-bonuses';
import { portableCharacter } from '../characters/portable-character';

function feat(id: string, ability: unknown[]): FeatureEntryFull {
  return { editorId: id, name: id, source: 'TEST', featureType: 'FEAT',
    featEntity: { name: id, source: 'TEST', entries: [], ability: ability as NonNullable<FeatureEntryFull['featEntity']>['ability'] } };
}
function sheet(): ExportedCharacter {
  return { character: { abilityScores: { strength: 10, dexterity: 10, constitution: 10, intelligence: 10, wisdom: 10, charisma: 10 } },
    features: [feat('Feat A', [{ str: 2 }])], background: { name: 'Background', entity: { ability: [{ int: 1 }] } } };
}

describe('Opt-in ability score bonuses', () => {
  it('defaults to manual, recalculates from base without compounding, and restores editable bases when toggled off', () => {
    const value = sheet(), before = structuredClone(value);
    applyAbilityBonuses(value); expect(value).toEqual(before);
    setAbilityBonusesEnabled(value, true);
    expect(value.character!.abilityScores).toMatchObject({ strength: 12, intelligence: 11 });
    for (let i = 0; i < 3; i++) applyAbilityBonuses(value);
    expect(value.character!.abilityScores!.strength).toBe(12);
    expect(value.abilityBonuses!.base.strength).toBe(10);
    setAbilityBonusesEnabled(value, false);
    expect(value.character!.abilityScores).toEqual(before.character!.abilityScores);
    value.character!.abilityScores!.strength = 14;
    setAbilityBonusesEnabled(value, true); expect(value.character!.abilityScores!.strength).toBe(16);
    setAbilityBonusesEnabled(value, true); expect(value.character!.abilityScores!.strength).toBe(16);
  });

  it('requires explicit alternatives, applies fixed and selected increases atomically, and rejects stale/duplicate choices', () => {
    const value = sheet(), feature = value.features![0];
    feature.featEntity!.ability = [{ str: 1, choose: { from: ['dex', 'con'], count: 2, amount: 1 } }, { cha: 2 }];
    setAbilityBonusesEnabled(value, true); const id = featureBonusSourceId(feature);
    expect(value.character!.abilityScores!.strength).toBe(10);
    value.abilityBonuses!.choices[id] = { optionIndex: 0, chosen: ['dex'] };
    applyAbilityBonuses(value); expect(value.character!.abilityScores!.strength).toBe(10);
    value.abilityBonuses!.choices[id].chosen = ['dex', 'dex'];
    expect(calculateAbilityBonuses(value).sources.find(row => row.source.id === id)!.ready).toBe(false);
    value.abilityBonuses!.choices[id].chosen = ['dex', 'con'];
    applyAbilityBonuses(value); expect(value.character!.abilityScores).toMatchObject({ strength: 11, dexterity: 11, constitution: 11 });
    value.abilityBonuses!.choices[id] = { optionIndex: 1 }; applyAbilityBonuses(value);
    expect(value.character!.abilityScores).toMatchObject({ strength: 10, dexterity: 10, constitution: 10, charisma: 12 });
    feature.featEntity!.ability = [{ str: 1 }]; applyAbilityBonuses(value);
    expect(value.character!.abilityScores!.strength).toBe(10);
    expect(calculateAbilityBonuses(value).sources.find(row => row.source.id === id)!.status).toContain('valid bonus alternative');
  });

  it('supports weighted background choices while keeping species bonuses prepared but inactive', () => {
    const value = sheet(); value.features = [];
    value.background!.entity!['ability'] = [{ choose: { weighted: { from: ['int', 'wis', 'cha'], weights: [2, 1] } } }];
    value.species = { name: 'Legacy species', entity: { name: 'Legacy species', source: 'PHB', definition: { version: 1, movement: { kind: 'unspecified' },
      abilities: [{ fixed: { str: 2 }, maximum: 20, hidden: false }], defenses: { resist: [], immune: [], vulnerable: [], conditionImmune: [] },
      senses: {}, sizes: ['M'], creatureTypes: [] } } };
    setAbilityBonusesEnabled(value, true);
    value.abilityBonuses!.choices[backgroundBonusSourceId(value.background!)] = { chosen: ['wis', 'int'] };
    applyAbilityBonuses(value);
    expect(value.character!.abilityScores).toMatchObject({ wisdom: 12, intelligence: 11, strength: 10 });
    expect(abilityBonusSources(value).some(source => source.kind === 'Species')).toBe(false);
    expect(calculateAbilityBonuses(value, true).effective.strength).toBe(12);
    expect(value.character!.abilityScores!.strength).toBe(10);
  });

  it('respects per-source caps, higher-cap bonuses and penalties independent of list order', () => {
    const value = sheet(); value.background = undefined; value.character!.abilityScores!.strength = 19;
    value.features = [feat('Boon', [{ str: 2, max: 30 }]), feat('Normal', [{ str: 2 }])];
    setAbilityBonusesEnabled(value, true); expect(value.character!.abilityScores!.strength).toBe(22);
    value.features.reverse(); applyAbilityBonuses(value); expect(value.character!.abilityScores!.strength).toBe(22);
    expect(calculateAbilityBonuses(value).contributions.find(entry => entry.name === 'Normal')!.applied).toBe(1);
    value.abilityBonuses!.base.strength = 25; applyAbilityBonuses(value); expect(value.character!.abilityScores!.strength).toBe(27);
    value.features.push(feat('Penalty', [{ str: -2 }])); applyAbilityBonuses(value); expect(value.character!.abilityScores!.strength).toBe(25);
  });

  it('adds, removes and updates sources without losing their selections or compounding totals', () => {
    const value = sheet(), feature = value.features![0], id = featureBonusSourceId(feature);
    feature.featEntity!.ability = [{ choose: { from: ['str', 'dex'], amount: 1 } }];
    setAbilityBonusesEnabled(value, true); value.abilityBonuses!.choices[id] = { chosen: ['str'] };
    applyAbilityBonuses(value); expect(value.character!.abilityScores!.strength).toBe(11);
    value.features = []; applyAbilityBonuses(value); expect(value.character!.abilityScores!.strength).toBe(10);
    value.features.push(feature); applyAbilityBonuses(value); expect(value.character!.abilityScores!.strength).toBe(11);
    feature.featEntity!.ability = [{ choose: { from: ['str', 'dex'], amount: 2 } }];
    applyAbilityBonuses(value); expect(value.character!.abilityScores!.strength).toBe(12);
    expect(value.abilityBonuses!.choices[id].chosen).toEqual(['str']);
    value.abilityBonuses!.choices[id].disabled = true; applyAbilityBonuses(value); expect(value.character!.abilityScores!.strength).toBe(10);
  });

  it('supports ASI presets and explicit custom feature definitions without parsing description prose', () => {
    const value = sheet(); value.features = [{ name: 'Ability Score Improvement', editorId: 'asi' }, { name: 'Custom effect', editorId: 'custom' }];
    setAbilityBonusesEnabled(value, true);
    const asi = abilityBonusSources(value).find(source => source.id === 'feature:asi')!;
    expect(asi.options).toEqual(asiBonusOptions());
    value.abilityBonuses!.choices[asi.id] = { optionIndex: 1, chosen: ['str', 'dex'] };
    value.abilityBonuses!.custom['feature:custom'] = [{ fixed: { str: 1 }, maximum: 20, hidden: false }];
    applyAbilityBonuses(value); expect(value.character!.abilityScores).toMatchObject({ strength: 12, dexterity: 11 });
    const before = structuredClone(value), result = calculateAbilityBonuses(value);
    expect(result.sources.every(source => source.ready)).toBe(true); expect(value).toEqual(before);
  });

  it('preserves configuration and totals across portable export/import, and validates malformed saved state', () => {
    const value = sheet(); setAbilityBonusesEnabled(value, true);
    const saved = portableCharacter(JSON.parse(JSON.stringify(value)));
    expect(saved).toEqual(value); expect(portableCharacter(saved)).toEqual(saved);
    const malformed = structuredClone(value); (malformed.abilityBonuses as unknown as Record<string, unknown>)['choices'] = [];
    expect(() => portableCharacter(malformed)).toThrow('ability bonus configuration');
    expect(value.character!.abilityScores!.strength).toBe(12);
  });

  it('gives legacy feature instances independent stable identities when automatic mode is first enabled', () => {
    const value = sheet(); value.features = [{ name: 'Repeatable feat' }, { name: 'Repeatable feat' }];
    setAbilityBonusesEnabled(value, true);
    const ids = value.features.map(featureBonusSourceId);
    expect(new Set(ids).size).toBe(2);
    setAbilityBonusesEnabled(value, false); setAbilityBonusesEnabled(value, true);
    expect(value.features.map(featureBonusSourceId)).toEqual(ids);
  });
});
