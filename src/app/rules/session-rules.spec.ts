import { applySessionAction, HealthPlayState, RestPool, setHealthOverride } from './session-rules';
const state = (): HealthPlayState => ({ currentHp: 20,tempHp: 5,deathSaves: { successes: 0,failures: 0 },resources: {},annotations: { note: ['Keep'] } });
describe('Pure play-state operations', () => {
  it('B09-B11: absorbs damage, caps healing, edits overrides and clamps death saves', () => {
    const original = state(); const damaged = applySessionAction(original,30,[],{ type: 'damage',amount: 8 });
    expect([damaged.currentHp,damaged.tempHp]).toEqual([17,0]);
    expect(applySessionAction(damaged,30,[],{ type: 'heal',amount: 100 }).currentHp).toBe(30);
    original.currentHp = 25; const reduced = setHealthOverride(original,30,18);
    expect(reduced.session.currentHp).toBe(18); expect(setHealthOverride(reduced.session,30,null).session.currentHp).toBe(18);
    expect(setHealthOverride(original,30,0).session.currentHp).toBe(0);
    expect(applySessionAction(original,30,[],{ type: 'death-saves',successes: 9,failures: -1 }).deathSaves).toEqual({ successes: 3,failures: 0 });
    expect(original.tempHp).toBe(5); expect(damaged.annotations).toEqual(original.annotations);
  });
  it('B12: recovers rest resources by policy and leaves manual/orphan state intact', () => {
    const original = state(); const pools: RestPool[] = ['LONG_REST','SHORT_REST','SHORT_REST_ONE','MANUAL'].map((regain,i) => ({ id: String(i),kind: 'feature-uses',total: 5,regain: regain as RestPool['regain'] }));
    original.resources = { '0': { used: 3 },'1': { used: 3 },'2': { used: 3 },'3': { used: 3 },orphan: { used: 9 } };
    const short = applySessionAction(original,30,pools,{ type: 'rest',rest: 'short',policy: 'android-v1' });
    expect(pools.map(p => short.resources[p.id].used)).toEqual([3,0,2,3]);
    const long = applySessionAction(original,30,pools,{ type: 'rest',rest: 'long',policy: 'android-v1' });
    expect(pools.map(p => long.resources[p.id].used)).toEqual([0,0,0,3]); expect(long.resources['orphan'].used).toBe(9);
    expect(original.resources['1'].used).toBe(3);
  });
  it('B13: restores half of each die pool and retains temporary HP under Android policy', () => {
    const original = state(); original.currentHp = 4; original.tempHp = 7; original.resources = { a: { used: 3 },b: { used: 2 } };
    const pools: RestPool[] = [{ id: 'a',kind: 'hit-dice',total: 3,regain: 'MANUAL' },{ id: 'b',kind: 'hit-dice',total: 2,regain: 'MANUAL' }];
    const long = applySessionAction(original,40,pools,{ type: 'rest',rest: 'long',policy: 'android-v1' });
    expect(long.currentHp).toBe(40); expect(long.tempHp).toBe(7); expect([long.resources['a'].used,long.resources['b'].used]).toEqual([2,1]);
    const web = applySessionAction(original,40,pools,{ type: 'rest',rest: 'long',policy: 'web-viewer-v1' });
    expect(web.tempHp).toBe(0); expect([web.resources['a'].used,web.resources['b'].used]).toEqual([0,0]);
  });
  it('versions the manual-slot and SHORT_REST_ONE differences and validates actions', () => {
    const original = state(); original.resources = { slots: { used: 2 },one: { used: 3 } };
    const pools: RestPool[] = [{ id: 'slots',kind: 'spell-slots',total: 2,regain: 'MANUAL' },{ id: 'one',kind: 'feature-uses',total: 5,regain: 'SHORT_REST_ONE' }];
    expect(applySessionAction(original,30,pools,{ type: 'rest',rest: 'long',policy: 'android-v1' }).resources).toEqual({ slots: { used: 0 },one: { used: 0 } });
    expect(applySessionAction(original,30,pools,{ type: 'rest',rest: 'long',policy: 'web-viewer-v1' }).resources).toEqual({ slots: { used: 2 },one: { used: 2 } });
    expect(applySessionAction(original,30,pools,{ type: 'set-used',poolId: 'slots',used: 9 }).resources['slots'].used).toBe(2);
    expect(() => applySessionAction(original,30,pools,{ type: 'set-used',poolId: 'missing',used: 1 })).toThrow();
    expect(() => applySessionAction(original,30,pools,{ type: 'damage',amount: NaN })).toThrow();
  });
  it('spends/recover resources atomically and refuses overspending or invalid amounts', () => {
    const original = state(); original.resources = { ki: { used: 2 },orphan: { used: 9 } };
    const pools: RestPool[] = [{ id: 'ki',kind: 'feature-uses',total: 5,regain: 'SHORT_REST' }];
    const spent = applySessionAction(original,30,pools,{ type: 'spend',poolId: 'ki',amount: 3 });
    expect(spent.resources['ki'].used).toBe(5); expect(spent.resources['orphan'].used).toBe(9);
    expect(() => applySessionAction(spent,30,pools,{ type: 'spend',poolId: 'ki',amount: 1 })).toThrow('Insufficient');
    expect(original.resources['ki'].used).toBe(2);
    expect(applySessionAction(spent,30,pools,{ type: 'recover',poolId: 'ki',amount: 2 }).resources['ki'].used).toBe(3);
    expect(() => applySessionAction(original,30,pools,{ type: 'spend',poolId: 'ki',amount: 0 })).toThrow('positive');
  });
});
