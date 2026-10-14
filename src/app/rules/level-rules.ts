/** Pure level arithmetic. Content selection/choices and persistence are separate boundaries. */
export type CasterProgression = 'none' | 'full' | 'half' | 'artificer' | 'third' | 'pact';
export interface ClassLevelInput {
  selectionId: string;
  level: number;
  hitDie: 4 | 6 | 8 | 10 | 12;
  caster: CasterProgression;
}
export interface ResourcePool {
  id: string;
  kind: 'hit-dice' | 'spell-slots';
  rank: number;
  total: number;
  regain: 'LONG_REST' | 'SHORT_REST' | 'MANUAL';
  origins: string[];
}
export interface LevelInputs {
  classes: ClassLevelInput[];
  constitution: number;
  manualMaxHp: number;
  maxHpOverride?: number | null;
  applyHp: boolean;
  applyHitDice: boolean;
  manualPools: ResourcePool[];
}
export interface PlayState {
  currentHp: number;
  resources: Record<string, { used: number }>;
  annotations: Record<string, string[]>;
}
export interface LevelPreview {
  policy: 'android-v1';
  totalLevel: number;
  proficiencyBonus: number;
  casterLevel: number;
  maxHp: number;
  hpContributions: { selectionId: string; amount: number }[];
  pools: ResourcePool[];
  session: PlayState;
  adjustments: ({ kind: 'hp-above-maximum'; current: number; maximum: number }
    | { kind: 'resource-above-total'; poolId: string; used: number; total: number }
    | { kind: 'removed-resource'; poolId: string; used: number })[];
  warnings: string[];
}
// Index by combined caster level; each row lists slot totals from spell level 1 upward.
const SLOTS = [[], [2], [3], [4,2], [4,3], [4,3,2], [4,3,3], [4,3,3,1], [4,3,3,2],
  [4,3,3,3,1], [4,3,3,3,2], [4,3,3,3,2,1], [4,3,3,3,2,1], [4,3,3,3,2,1,1],
  [4,3,3,3,2,1,1], [4,3,3,3,2,1,1,1], [4,3,3,3,2,1,1,1], [4,3,3,3,2,1,1,1,1],
  [4,3,3,3,3,1,1,1,1], [4,3,3,3,3,2,1,1,1], [4,3,3,3,3,2,2,1,1]];
const PROGRESSIONS: CasterProgression[] = ['none', 'full', 'half', 'artificer', 'third', 'pact'];
function integer(value: number, minimum: number, maximum: number, field: string): void {
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) throw new Error(`Invalid ${field}.`);
}
function contribution(selection: ClassLevelInput): number {
  // These rounding rules reproduce the Android policy; pact pools are calculated separately.
  switch (selection.caster) {
    case 'full': return selection.level;
    case 'half': return Math.floor(selection.level / 2);
    case 'artificer': return Math.ceil(selection.level / 2);
    case 'third': return Math.floor(selection.level / 3);
    default: return 0;
  }
}
export function abilityModifier(score: number): number {
  integer(score, 1, 30, 'ability score'); return Math.floor((score - 10) / 2);
}
/** Proposed totals only: never clamps health/counters, saves, fetches, or mutates inputs. */
export function deriveLevelRules(inputs: LevelInputs, state: PlayState, policy: 'android-v1' = 'android-v1', previousPools: ResourcePool[] = []): LevelPreview {
  if (policy !== 'android-v1') throw new Error('Unsupported level rules policy.');
  if (!Array.isArray(inputs.classes) || !inputs.classes.length) throw new Error('Select at least one class.');
  const ids = new Set<string>();
  for (const selection of inputs.classes) {
    if (!selection.selectionId || ids.has(selection.selectionId)) throw new Error('Class selection IDs must be unique.');
    ids.add(selection.selectionId);
    integer(selection.level, 1, 20, 'class level');
    if (![4,6,8,10,12].includes(selection.hitDie) || !PROGRESSIONS.includes(selection.caster)) throw new Error('Invalid class progression.');
  }
  const totalLevel = inputs.classes.reduce((sum, selection) => sum + selection.level, 0);
  integer(totalLevel, 1, 20, 'total level'); integer(inputs.manualMaxHp, 0, Number.MAX_SAFE_INTEGER, 'manual HP');
  if (inputs.maxHpOverride != null) integer(inputs.maxHpOverride, 0, Number.MAX_SAFE_INTEGER, 'HP override');
  integer(state.currentHp, 0, Number.MAX_SAFE_INTEGER, 'current HP');
  const con = abilityModifier(inputs.constitution);
  const hpContributions = inputs.classes.map((selection, index) => ({ selectionId: selection.selectionId,
    amount: (index === 0 ? selection.hitDie + con : 0)
      + (Math.ceil((selection.hitDie + 1) / 2) + con) * (selection.level - (index === 0 ? 1 : 0)),
  }));
  const computedHp = hpContributions.reduce((sum, entry) => sum + entry.amount, 0);
  if (inputs.applyHp && computedHp < 0) throw new Error('Android HP calculation produced a negative maximum; choose a manual value.');
  const maxHp = inputs.maxHpOverride ?? (inputs.applyHp ? computedHp : inputs.manualMaxHp);
  const pools = structuredClone(inputs.manualPools);
  for (const pool of pools) {
    if (!pool.id || ids.has(pool.id)) throw new Error('Manual resource IDs must be unique and separate from class selections.');
    ids.add(pool.id); integer(pool.total, 0, Number.MAX_SAFE_INTEGER, 'resource total');
    integer(pool.rank, 1, 12, 'resource rank');
    if (!['hit-dice', 'spell-slots'].includes(pool.kind) || !['LONG_REST', 'SHORT_REST', 'MANUAL'].includes(pool.regain)) throw new Error('Invalid resource definition.');
  }
  if (inputs.applyHitDice) {
    for (const die of [...new Set(inputs.classes.map(s => s.hitDie))]) {
      const classes = inputs.classes.filter(s => s.hitDie === die);
      pools.push({ id: JSON.stringify(['generated', 'hit-dice', die]), kind: 'hit-dice', rank: die,
        total: classes.reduce((sum, s) => sum + s.level, 0), regain: 'MANUAL', origins: classes.map(s => s.selectionId) });
    }
  }
  const regular = inputs.classes.filter(s => contribution(s) > 0);
  const casterLevel = regular.reduce((sum, s) => sum + contribution(s), 0);
  for (const [index, total] of SLOTS[casterLevel].entries()) pools.push({
    id: JSON.stringify(['generated', 'regular-slots', index + 1]), kind: 'spell-slots', rank: index + 1,
    total, regain: 'LONG_REST', origins: regular.map(s => s.selectionId),
  });
  const warnings: string[] = [];
  for (const selection of inputs.classes.filter(s => s.caster === 'pact')) {
    if (selection.level === 2) warnings.push('android-v1 preserves the Android level-2 pact table: one level-1 slot; not verified against an edition rulebook.');
    pools.push({ id: JSON.stringify(['generated', 'pact-slots', selection.selectionId]), kind: 'spell-slots',
      rank: Math.min(5, Math.ceil(selection.level / 2)), total: selection.level < 3 ? 1 : selection.level < 11 ? 2 : selection.level < 17 ? 3 : 4,
      regain: 'SHORT_REST', origins: [selection.selectionId] });
  }
  if (new Set(pools.map(p => p.id)).size !== pools.length) throw new Error('Resource ID collision.');
  const session = structuredClone(state);
  for (const [id, usage] of Object.entries(session.resources)) integer(usage.used, 0, Number.MAX_SAFE_INTEGER, `resource usage ${id}`);
  const adjustments: LevelPreview['adjustments'] = [];
  if (session.currentHp > maxHp) adjustments.push({ kind: 'hp-above-maximum', current: session.currentHp, maximum: maxHp });
  for (const pool of pools) {
    const usage = Object.hasOwn(session.resources, pool.id) ? session.resources[pool.id] : { used: 0 };
    Object.defineProperty(session.resources, pool.id, { value: usage, enumerable: true, configurable: true, writable: true });
    if (usage.used > pool.total) adjustments.push({ kind: 'resource-above-total', poolId: pool.id, used: usage.used, total: pool.total });
  }
  const currentIds = new Set(pools.map(p => p.id));
  for (const previous of previousPools) if (!currentIds.has(previous.id)) adjustments.push({
    kind: 'removed-resource', poolId: previous.id, used: session.resources[previous.id]?.used ?? 0,
  });
  return { policy, totalLevel, proficiencyBonus: 2 + Math.floor((totalLevel - 1) / 4), casterLevel, maxHp,
    hpContributions, pools, session, adjustments, warnings };
}
