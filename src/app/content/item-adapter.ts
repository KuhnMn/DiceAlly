import { ContentRecord, JsonObject } from './content.model';
import { ItemDefinition } from './item.model';
import validateItem from './generated/item-validators.mjs';

export const ITEM_FIELDS = [
  'page', 'type', 'typeAlt', 'rarity', 'reqAttune', 'weight',
  'value', 'dmg1', 'dmg2', 'dmgType', 'weaponCategory', 'range',
  'bonusWeapon', 'bonusAc', 'ac', 'bonusWeaponAttack', 'bonusSavingThrow', 'bonusSpellAttack',
  'bonusSpellSaveDc', 'bonusSpellDamage', 'bonusWeaponDamage', 'scfType', 'weapon', 'armor',
  'sword', 'axe', 'spear', 'crossbow', 'bow', 'polearm',
  'arrow', 'firearm', 'bolt', 'bulletFirearm', 'mace', 'needleBlowgun',
  'club', 'bulletSling', 'hammer', 'net', 'cellEnergy', 'lance',
  'dexterityMax', 'strength', 'stealth', 'property', 'mastery',
] as const;
export function assertItemDefinition(value: unknown): asserts value is ItemDefinition {
  if (!validateItem(value)) {
    const issue = validateItem.errors?.[0];
    throw new Error(`Invalid canonical item at ${issue?.instancePath || '/'}: ${issue?.message ?? 'invalid structure'}.`);
  }
}
export function itemDefinition(record: ContentRecord): ItemDefinition {
  if (record.kind !== 'item' && record.kind !== 'baseitem') throw new Error('Expected an item definition.');
  if (record.itemDefinition) {
    if (ITEM_FIELDS.some(field => Object.hasOwn(record.data, field))) throw new Error('Canonical item contains duplicate legacy fields.');
    assertItemDefinition(record.itemDefinition);
    return record.itemDefinition;
  }
  const definition: JsonObject = {
    version: 1, ...Object.fromEntries(ITEM_FIELDS.flatMap(field =>
      record.data[field] === undefined ? [] : [[field, structuredClone(record.data[field])]]))
  };
  // Materialization already applies this conversion; retain it for historical source snapshots.
  if (definition['reqAttune'] === true) definition['reqAttune'] = 'by anyone';
  else if (definition['reqAttune'] === false) definition['reqAttune'] = null;
  assertItemDefinition(definition);
  return definition;
}
export function canonicalItemRecord(record: ContentRecord): ContentRecord & { itemDefinition: ItemDefinition } {
  if (record.kind !== 'item') throw new Error('Only playable items are canonicalized.');
  const definition = itemDefinition(record);
  const data = structuredClone(record.data);
  for (const field of ITEM_FIELDS) delete data[field];
  return { ...record, data, itemDefinition: structuredClone(definition) };
}
/** Conventional fields are reconstructed only for inheritance and self-contained inventory exports. */
export function itemSourceData(record: ContentRecord): JsonObject {
  const definition = itemDefinition(record);
  return {
    ...structuredClone(record.data), name: record.data['name'] ?? record.name, source: record.publication,
    ...Object.fromEntries(ITEM_FIELDS.flatMap(field => definition[field] === undefined ? [] : [[field, structuredClone(definition[field])]]))
  };
}
