import { ContentRecord, JsonObject } from './content.model';
import { MonsterDefinition } from './monster.model';
import validateMonster from './generated/monster-validators.mjs';

export const MONSTER_FIELDS = [
  'size', 'type', 'alignment', 'ac', 'hp', 'speed', 'initiative',
  'str', 'dex', 'con', 'int', 'wis', 'cha', 'senses',
  'passive', 'languages', 'cr', 'vulnerable', 'resist', 'immune', 'conditionImmune',
] as const;
export function assertMonsterDefinition(value: unknown): asserts value is MonsterDefinition {
  if (!validateMonster(value)) {
    const issue = validateMonster.errors?.[0];
    throw new Error(`Invalid canonical monster at ${issue?.instancePath || '/'}: ${issue?.message ?? 'invalid structure'}.`);
  }
}
export function monsterDefinition(record: ContentRecord): MonsterDefinition {
  if (record.kind !== 'monster') throw new Error('Expected a monster record.');
  if (record.monsterDefinition) {
    if (MONSTER_FIELDS.some(field => Object.hasOwn(record.data, field))) throw new Error('Canonical monster contains duplicate legacy fields.');
    assertMonsterDefinition(record.monsterDefinition);
    return record.monsterDefinition;
  }
  const definition = {
    version: 1, ...Object.fromEntries(MONSTER_FIELDS.flatMap(field =>
      record.data[field] === undefined ? [] : [[field, structuredClone(record.data[field])]]))
  };
  assertMonsterDefinition(definition);
  return definition;
}
export function canonicalMonsterRecord(record: ContentRecord): ContentRecord & { monsterDefinition: MonsterDefinition } {
  const definition = monsterDefinition(record);
  const data = structuredClone(record.data);
  for (const field of MONSTER_FIELDS) delete data[field];
  return { ...record, data, monsterDefinition: structuredClone(definition) };
}
/** Restore source fields only for inheritance, reference walking and portable stat-block projection. */
export function monsterSourceData(record: ContentRecord): JsonObject {
  const definition = monsterDefinition(record);
  return {
    ...structuredClone(record.data), name: record.data['name'] ?? record.name, source: record.publication,
    ...Object.fromEntries(MONSTER_FIELDS.flatMap(field => definition[field] === undefined ? [] : [[field, structuredClone(definition[field])]]))
  };
}
/** Keep the existing Android-compatible type wrapper and numeric movement projection. */
export function projectMonsterData(record: ContentRecord): JsonObject {
  const definition = monsterDefinition(record); const data = monsterSourceData(record);
  if (typeof definition.type === 'string') data['type'] = { type: definition.type };
  const speed = definition.speed;
  if (speed && typeof speed === 'object') {
    data['speed'] = Object.fromEntries((['walk', 'fly', 'swim', 'climb', 'burrow'] as const).flatMap(mode => {
      const value = speed[mode];
      const number = typeof value === 'number' ? value : value && typeof value === 'object' ? value.number : undefined;
      return number === undefined ? [] : [[mode, number]];
    }));
  }
  return data;
}
