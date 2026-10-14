import { ClassLevelInput, deriveLevelRules, LevelInputs, PlayState } from './level-rules';
const cls = (selectionId: string, level: number, hitDie: ClassLevelInput['hitDie'], caster: ClassLevelInput['caster'] = 'none'): ClassLevelInput => ({ selectionId, level, hitDie, caster });
const inputs = (classes: ClassLevelInput[]): LevelInputs => ({ classes, constitution: 14, manualMaxHp: 17, applyHp: true, applyHitDice: true, manualPools: [] });
const state = (): PlayState => ({ currentHp: 7, resources: {}, annotations: { note: ['Keep this note'] } });
describe('Independent Android level policy', () => {
  it('B01-B03: applies full first die only to the first ordered class', () => {
    expect(deriveLevelRules(inputs([cls('fighter', 3, 10)]), state()).maxHp).toBe(28);
    const selections = [cls('fighter', 2, 10), cls('mage', 3, 6)];
    const result = deriveLevelRules(inputs(selections), state());
    expect(result.maxHp).toBe(38); expect(result.totalLevel).toBe(5); expect(result.proficiencyBonus).toBe(3);
    expect(result.pools.map(p => [p.rank, p.total])).toEqual([[10,2],[6,3]]);
    expect(deriveLevelRules(inputs([...selections].reverse()), state()).maxHp).toBe(36);
  });
  it('B06: combines full, half, artificer and third contributions', () => {
    const result = deriveLevelRules(inputs([cls('full',3,6,'full'), cls('half',3,10,'half'), cls('artificer',3,8,'artificer'), cls('third',3,10,'third')]), state());
    expect(result.casterLevel).toBe(7);
    expect(result.pools.filter(p => p.kind === 'spell-slots').map(p => p.total)).toEqual([4,3,3,1]);
  });
  it('B07-B08: keeps pact slots separate with an explicit legacy policy warning', () => {
    const result = deriveLevelRules(inputs([cls('pact',5,8,'pact'), cls('mage',3,6,'full')]), state());
    expect(result.pools.filter(p => p.kind === 'spell-slots').map(p => [p.rank,p.total,p.regain])).toEqual([[1,4,'LONG_REST'],[2,2,'LONG_REST'],[3,2,'SHORT_REST']]);
    const legacy = deriveLevelRules(inputs([cls('pact',2,8,'pact')]), state());
    expect(legacy.warnings).toHaveLength(1);
    expect(legacy.pools.find(p => p.kind === 'spell-slots')).toMatchObject({ rank: 1, total: 1 });
  });
  it('preserves usage/notes and stable identities on repeats, increases and decreases', () => {
    const original = inputs([cls('mage',3,6,'full')]); const play = state();
    const first = deriveLevelRules(original, play); const slot = first.pools.find(p => p.kind === 'spell-slots')!;
    first.session.resources[slot.id].used = 4;
    const repeated = deriveLevelRules(original, first.session);
    expect(repeated.session).toEqual(first.session); expect(repeated.pools).toEqual(first.pools);
    const decreased = deriveLevelRules(inputs([cls('mage',1,6,'full')]), first.session, 'android-v1', first.pools);
    expect(decreased.session.resources[slot.id].used).toBe(4);
    expect(decreased.adjustments.some(a => a.kind === 'resource-above-total')).toBe(true);
    expect(decreased.adjustments.some(a => a.kind === 'removed-resource')).toBe(true);
    expect(decreased.session.annotations).toEqual(play.annotations);
    const increased = deriveLevelRules(inputs([cls('mage',5,6,'full')]), first.session);
    expect(increased.session.resources[slot.id].used).toBe(4);
    expect(increased.pools).toHaveLength(4);
    expect(play.resources).toEqual({}); expect(original.classes[0].level).toBe(3);
  });
  it('preserves manual pools, disabled automation and zero overrides without clamping HP', () => {
    const selection = inputs([cls('fighter',3,10)]); selection.applyHp = false; selection.applyHitDice = false;
    selection.manualPools = [{ id: 'manual', kind: 'hit-dice', rank: 8, total: 2, regain: 'MANUAL', origins: [] }];
    expect(deriveLevelRules(selection,state()).maxHp).toBe(17);
    selection.maxHpOverride = 0;
    const result = deriveLevelRules(selection,state());
    expect(result.maxHp).toBe(0); expect(result.session.currentHp).toBe(7);
    expect(result.adjustments[0].kind).toBe('hp-above-maximum'); expect(result.pools).toEqual(selection.manualPools);
  });
  it('rejects invalid levels, duplicate IDs and unsupported progression', () => {
    expect(() => deriveLevelRules(inputs([cls('one',0,6)]),state())).toThrow();
    expect(() => deriveLevelRules(inputs([cls('one',11,6),cls('two',10,6)]),state())).toThrow();
    expect(() => deriveLevelRules(inputs([cls('one',1,6),cls('one',1,6)]),state())).toThrow();
    expect(() => deriveLevelRules(inputs([cls('one',1,6,'unknown' as ClassLevelInput['caster'])]),state())).toThrow();
  });
});
