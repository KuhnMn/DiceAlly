import type { ContentReference, FeatureNotes, FeatureUses, Monster } from './character.model';
import type { ObjectDefinition } from '../content/object.model';

export interface CompanionHitPoints {
  enabled: boolean;
  maximum?: number;
  current?: number;
  temporary?: number;
  maximumOverride?: number;
}

/** Detached object definition plus player-authored companion state. */
export interface ObjectCompanion {
  kind: 'object';
  editorId?: string;
  contentReference?: ContentReference;
  name?: string;
  source?: string;
  userAdded?: boolean;
  entity?: ObjectDefinition;
  hitPoints: CompanionHitPoints;
  notes?: FeatureNotes[];
  uses?: FeatureUses[];
}

export type Companion = Monster | ObjectCompanion;
export const COMPANION_TYPES = [{ value: 'monster', label: 'Monsters' }, { value: 'object', label: 'Objects' }] as const;
export type CompanionType = typeof COMPANION_TYPES[number]['value'];
export const OBJECT_TYPE_NAMES = { GEN: 'Generic Object', SW: 'Siege Weapon', U: 'Unknown' } as const;
export const objectTypeName = (definition?: ObjectDefinition) => OBJECT_TYPE_NAMES[definition?.objectType ?? 'U'];
export function isObjectCompanion(value: Companion): value is ObjectCompanion { return 'kind' in value && value.kind === 'object'; }

const monsterHealth = new WeakMap<Monster, CompanionHitPoints>();
/** A shared editable view preserves the existing monster snapshot fields exactly. */
export function companionHitPoints(value: Companion): CompanionHitPoints {
  if (isObjectCompanion(value)) return value.hitPoints;
  let health = monsterHealth.get(value);
  if (!health) {
    health = {
      get enabled() { return !!value.hpEnabled; }, set enabled(enabled) { value.hpEnabled = enabled; },
      get maximum() { return value.monsterMaxHP; }, set maximum(maximum) { value.monsterMaxHP = maximum; },
      get current() { return value.monsterCurrentHP; }, set current(current) { value.monsterCurrentHP = current; },
      get temporary() { return value.monsterTempHP; }, set temporary(temporary) { value.monsterTempHP = temporary; },
      get maximumOverride() { return value.monsterMaxHpOverride; }, set maximumOverride(maximumOverride) { value.monsterMaxHpOverride = maximumOverride; },
    };
    monsterHealth.set(value, health);
  }
  return health;
}

export function companionBaseHitPoints(value: Companion): number | undefined {
  return isObjectCompanion(value) ? typeof value.entity?.hp === 'number' ? value.entity.hp : undefined : value.entity?.hp?.average;
}

export function setCompanionMaximumHitPoints(value: Companion, maximum: number | null | undefined): void {
  const health = companionHitPoints(value), previous = health.maximum;
  health.maximumOverride = undefined;
  health.enabled = maximum != null;
  health.maximum = maximum ?? undefined;
  if (maximum == null) { health.current = undefined; health.temporary = undefined; }
  else if (health.current == null || health.current === previous) health.current = maximum;
}

/** Validate new companion state at every portable import/save boundary. */
export function validateObjectCompanions(value: unknown): asserts value is ObjectCompanion[] | undefined {
  if (value === undefined) return;
  if (!Array.isArray(value)) throw new Error('Object companions must be a list.');
  for (const object of value) {
    if (!object || object.kind !== 'object' || !object.hitPoints || typeof object.hitPoints.enabled !== 'boolean') throw new Error('Invalid object companion.');
    for (const key of ['maximum', 'current', 'temporary', 'maximumOverride'] as const) {
      const amount = object.hitPoints[key];
      if (amount !== undefined && (!Number.isSafeInteger(amount) || amount < 0)) throw new Error(`Invalid object ${key} HP.`);
    }
    const definition = object.entity;
    if (definition && (definition.version !== 1 || typeof definition.name !== 'string' || typeof definition.source !== 'string'
      || !Array.isArray(definition.size) || !Object.hasOwn(OBJECT_TYPE_NAMES, definition.objectType)
      || !Array.isArray(definition.entries) || !Array.isArray(definition.actionEntries))) throw new Error('Invalid object definition.');
  }
}
