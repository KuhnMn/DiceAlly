import { InventoryItem, ItemEntity } from '../models/character.model';
import { isItemEffectActive, numericItemBonus } from '../models/item-stat-bonuses';

export type ItemReminderScope = 'combat' | 'spells';

export interface ItemEffectReminder {
  key: string;
  name: string;
  source?: string;
  item: InventoryItem;
  bonuses: { label: string; value: string }[];
}

const SPELL_BONUSES = {
  bonusSpellAttack: 'Spell Attack',
  bonusSpellSaveDc: 'Spell Save DC',
  bonusSpellDamage: 'Spell Damage',
} as const satisfies Partial<Record<keyof ItemEntity, string>>;

const COMBAT_BONUSES = {
  bonusAc: 'AC',
  bonusWeapon: 'Weapon Attack/Damage',
  bonusWeaponAttack: 'Weapon Attack',
  bonusWeaponDamage: 'Weapon Damage',
  bonusSavingThrow: 'Saving Throws',
  ...SPELL_BONUSES,
} as const satisfies Partial<Record<keyof ItemEntity, string>>;

export function itemReminderKey(item: InventoryItem, index: number): string {
  return item.editorId ?? `${item.name}:${item.source ?? ''}:${index}`;
}

export function itemEffectReminders(
  inventory: readonly InventoryItem[],
  scope: ItemReminderScope,
): ItemEffectReminder[] {
  return inventory.flatMap((item, index) => {
    const entity = item.entity?.item;
    if (!entity || !isItemEffectActive(item)) return [];

    const labels = scope === 'spells' ? SPELL_BONUSES : COMBAT_BONUSES;
    const bonuses = Object.entries(labels).flatMap(([field, label]) => {
      const numeric = numericItemBonus(entity[field as keyof typeof COMBAT_BONUSES]);
      if (numeric === null) return [];
      return [{ label, value: numeric > 0 ? `+${numeric}` : `${numeric}` }];
    });
    if (!bonuses.length) return [];

    return [{
      key: itemReminderKey(item, index),
      name: item.name,
      source: item.source,
      item,
      bonuses,
    }];
  });
}
