import { PlayState } from './level-rules';
export interface HealthPlayState extends PlayState {
  tempHp: number;
  deathSaves: { successes: number; failures: number };
}
export interface RestPool {
  id: string;
  kind: 'hit-dice' | 'spell-slots' | 'feature-uses';
  total: number;
  regain: 'LONG_REST' | 'SHORT_REST' | 'SHORT_REST_ONE' | 'MANUAL';
}
export type SessionAction = { type: 'damage' | 'heal' | 'temp-hp'; amount: number }
  | { type: 'death-saves'; successes: number; failures: number }
  | { type: 'set-used'; poolId: string; used: number }
  | { type: 'spend' | 'recover'; poolId: string; amount: number }
  | { type: 'rest'; rest: 'short' | 'long'; policy: 'android-v1' | 'web-viewer-v1' };
function integer(n: number,label: string): void { if (!Number.isSafeInteger(n)) throw new Error(`Invalid ${label}.`); }
/** Explicit play actions, distinct from derivation; operate on detached state only. */
export function applySessionAction(state: HealthPlayState,maxHp: number,pools: readonly RestPool[],action: SessionAction): HealthPlayState {
  integer(maxHp,'maximum HP'); if (maxHp < 0) throw new Error('Invalid maximum HP.');
  integer(state.currentHp,'current HP'); integer(state.tempHp,'temporary HP');
  if (state.currentHp < 0 || state.tempHp < 0) throw new Error('Invalid health state.');
  for (const n of [state.deathSaves.successes,state.deathSaves.failures]) { integer(n,'death saves'); if (n < 0 || n > 3) throw new Error('Invalid death saves.'); }
  const ids = new Set<string>();
  for (const pool of pools) {
    integer(pool.total,'pool total');
    if (!pool.id || ids.has(pool.id) || pool.total < 0 || !['hit-dice','spell-slots','feature-uses'].includes(pool.kind)
      || !['LONG_REST','SHORT_REST','SHORT_REST_ONE','MANUAL'].includes(pool.regain)) throw new Error('Invalid rest resource.');
    ids.add(pool.id);
  }
  for (const usage of Object.values(state.resources)) { integer(usage.used,'resource usage'); if (usage.used < 0) throw new Error('Invalid resource usage.'); }
  const result = structuredClone(state);
  const clampHp = (hp: number) => Math.max(0,Math.min(maxHp,hp));
  switch (action.type) {
    case 'damage': {
      integer(action.amount,'damage'); const amount = Math.max(0,action.amount);
      result.currentHp = clampHp(result.currentHp - Math.max(0,amount-result.tempHp));
      result.tempHp = Math.max(0,result.tempHp-amount); break;
    }
    case 'heal': integer(action.amount,'healing'); result.currentHp = clampHp(result.currentHp + Math.max(0,action.amount)); break;
    case 'temp-hp': integer(action.amount,'temporary HP'); result.tempHp = Math.max(0,action.amount); break;
    case 'death-saves':
      integer(action.successes,'death saves'); integer(action.failures,'death saves');
      result.deathSaves = { successes: Math.max(0,Math.min(3,action.successes)),failures: Math.max(0,Math.min(3,action.failures)) }; break;
    case 'set-used': {
      integer(action.used,'used count'); const pool = pools.find(p => p.id === action.poolId);
      if (!pool) throw new Error('Unknown resource pool.');
      Object.defineProperty(result.resources,pool.id,{ value: { ...(Object.hasOwn(result.resources,pool.id) ? result.resources[pool.id] : {}),used: Math.max(0,Math.min(pool.total,action.used)) },enumerable: true,writable: true,configurable: true }); break;
    }
    case 'spend': case 'recover': {
      integer(action.amount,'resource amount'); if (action.amount < 1) throw new Error('Resource amount must be positive.');
      const pool = pools.find(p => p.id === action.poolId); if (!pool) throw new Error('Unknown resource pool.');
      const used = Object.hasOwn(result.resources,pool.id) ? result.resources[pool.id].used : 0;
      if (action.type === 'spend' && (used > pool.total || action.amount > pool.total-used)) throw new Error('Insufficient resource capacity.');
      const next = action.type === 'spend' ? used+action.amount : Math.max(0,used-action.amount);
      Object.defineProperty(result.resources,pool.id,{ value: { ...(Object.hasOwn(result.resources,pool.id) ? result.resources[pool.id] : {}),used: next },enumerable: true,writable: true,configurable: true });
      break;
    }
    case 'rest': {
      if (!['android-v1','web-viewer-v1'].includes(action.policy) || !['short','long'].includes(action.rest)) throw new Error('Unsupported rest policy/type.');
      const long = action.rest === 'long';
      if (long) { result.currentHp = maxHp; if (action.policy === 'web-viewer-v1') result.tempHp = 0; }
      for (const pool of pools) {
        const oldUsed = Object.hasOwn(result.resources,pool.id) ? result.resources[pool.id].used : 0;
        let used = oldUsed;
        if (pool.kind === 'hit-dice') {
          if (long) used = action.policy === 'web-viewer-v1' ? 0 : Math.max(0,oldUsed-Math.max(1,Math.floor(pool.total/2)));
        } else if (long && pool.kind === 'spell-slots' && action.policy === 'android-v1') used = 0;
        else if (pool.regain === 'SHORT_REST' || (long && pool.regain === 'LONG_REST')) used = 0;
        else if (pool.regain === 'SHORT_REST_ONE') used = long && action.policy === 'android-v1' ? 0 : Math.max(0,oldUsed-1);
        // Unknown/orphan resources stay intact. Only supplied definitions participate in rest.
        Object.defineProperty(result.resources,pool.id,{ value: { ...(Object.hasOwn(result.resources,pool.id) ? result.resources[pool.id] : {}),used },enumerable: true,writable: true,configurable: true });
      }
      break;
    }
    default: throw new Error('Unsupported session action.');
  }
  return result;
}
/** Deliberate override-edit action; zero remains valid, unlike Android's minimum-one editor. */
export function setHealthOverride(state: HealthPlayState,baseMaxHp: number,override: number | null) {
  integer(baseMaxHp,'base maximum HP'); if (baseMaxHp < 0) throw new Error('Invalid base maximum HP.');
  if (override !== null) { integer(override,'HP override'); if (override < 0) throw new Error('Invalid HP override.'); }
  const session = applySessionAction(state,override ?? baseMaxHp,[],{ type: 'death-saves',...state.deathSaves });
  session.currentHp = Math.min(session.currentHp,override ?? baseMaxHp);
  return { override,session };
}
