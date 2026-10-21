import type { ItemChargeDefinition } from './item.model';
import type { FeatureUses } from '../models/character.model';

const RECOVERY_TIMING = {
  round: 'Each Round', restShort: 'After a Short Rest', restLong: 'After a Long Rest',
  dawn: 'At Dawn', dusk: 'At Dusk', midnight: 'At Midnight', week: 'Every Week',
  month: 'Every Month', year: 'Every Year', decade: 'Every Decade', century: 'Every Century', special: 'Special',
} satisfies Record<NonNullable<ItemChargeDefinition['recharge']>, string>;

export interface ItemChargeDetails {
  maximumCharges: number | string;
  recoveryTimingText?: string;
  recoveryAmount?: number | string;
  trackerRecoveryCondition: 'MANUAL' | 'SHORT_REST' | 'LONG_REST';
}

/** Daily timing and rolled/partial recovery require a player decision, not a rest reset. */
export function prepareItemCharges(item: ItemChargeDefinition): ItemChargeDetails | undefined {
  if (item.charges == null) return undefined;
  let trackerRecoveryCondition: ItemChargeDetails['trackerRecoveryCondition'] = 'MANUAL';
  const fullyRestored = typeof item.charges === 'number' && Number.isSafeInteger(item.charges) && item.charges >= 0
    && typeof item.rechargeAmount === 'number' && Number.isSafeInteger(item.rechargeAmount) && item.rechargeAmount >= item.charges;
  if (fullyRestored && item.recharge === 'restShort') trackerRecoveryCondition = 'SHORT_REST';
  if (fullyRestored && item.recharge === 'restLong') trackerRecoveryCondition = 'LONG_REST';
  return { maximumCharges: item.charges, recoveryTimingText: item.recharge ? RECOVERY_TIMING[item.recharge] : undefined,
    recoveryAmount: item.rechargeAmount, trackerRecoveryCondition };
}

/** Fresh acquisition only; description refresh must never replace a player's charge state. */
export function createItemChargeTrackers(item: ItemChargeDefinition): FeatureUses[] {
  const details = prepareItemCharges(item);
  if (!details || typeof details.maximumCharges !== 'number' || !Number.isSafeInteger(details.maximumCharges) || details.maximumCharges < 0) return [];
  return [{ tag: 'Charges', totalFreeUses: details.maximumCharges, usedFreeUses: 0,
    freeUsesRegainCondition: details.trackerRecoveryCondition, userAdded: false }];
}
