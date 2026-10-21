import type { BrewSourceByKind } from './generated/brew-source';
import type { ContentRecord } from './content.model';

type SourceFields = Pick<BrewSourceByKind['item'],
  'page' | 'type' | 'typeAlt' | 'rarity' | 'weight' | 'value' | 'dmg1' | 'dmg2' | 'dmgType'
  | 'weaponCategory' | 'range' | 'bonusWeapon' | 'bonusAc' | 'ac' | 'bonusWeaponAttack'
  | 'bonusSavingThrow' | 'bonusSpellAttack' | 'bonusSpellSaveDc' | 'bonusSpellDamage'
  | 'bonusWeaponDamage' | 'scfType' | 'firearm' | 'dexterityMax' | 'strength' | 'stealth' | 'property'
  | 'mastery'>
  & Pick<BrewSourceByKind['baseitem'], 'weapon' | 'armor' | 'sword' | 'axe' | 'spear' | 'crossbow'
    | 'bow' | 'polearm' | 'arrow' | 'bolt' | 'bulletFirearm' | 'mace' | 'needleBlowgun' | 'club'
    | 'bulletSling' | 'hammer' | 'net' | 'cellEnergy' | 'lance'>;
/** Materialized mechanical fields; source definitions and recipes remain upstream-shaped. */
export interface ItemDefinition extends Partial<SourceFields> {
  version: 1;
  reqAttune?: string | null;
}
/** Source base definitions and historical snapshots have the same documented type UID field. */
export function itemTypeCode(record: ContentRecord): string {
  const type = record.itemDefinition?.type ?? record.data['type'];
  return typeof type === 'string' ? type.split('|')[0] : '';
}

export function itemTypeUid(record: ContentRecord): string {
  const abbreviation = record.data['abbreviation'];
  if (record.kind !== 'itemType' || typeof abbreviation !== 'string') throw new Error('Missing item type abbreviation.');
  return `${abbreviation}|${record.publication}`;
}
