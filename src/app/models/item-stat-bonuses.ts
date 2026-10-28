import { InventoryItem } from './character.model';

export interface ItemStatBonus {
  name: string;
  source?: string;
  value: number;
}

export function isItemEffectActive(item: InventoryItem): boolean {
  const entity = item.entity?.item;
  if (!entity || !item.isEquipped) return false;
  const requiresAttunement = !!entity.reqAttune && entity.reqAttune !== 'false';
  return !requiresAttunement || !!item.isAttuned;
}

/** Formulas and descriptive values remain manual; only explicit whole-number bonuses apply. */
export function numericItemBonus(value: string | null | undefined): number | null {
  const text = value?.trim();
  if (!text || !/^[+-]?\d+$/.test(text)) return null;
  const numeric = Number(text);
  return Number.isSafeInteger(numeric) && numeric !== 0 ? numeric : null;
}

export function itemSavingThrowBonuses(inventory: readonly InventoryItem[]): ItemStatBonus[] {
  return inventory.flatMap(item => {
    if (!isItemEffectActive(item)) return [];
    const value = numericItemBonus(item.entity?.item.bonusSavingThrow);
    return value === null ? [] : [{ name: item.name, source: item.source, value }];
  });
}
