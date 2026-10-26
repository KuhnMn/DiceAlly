import { CharacterData } from '../models/character.model';

export type HealthAction = 'damage' | 'heal' | 'temp';

export function validHealthAmount(value: string): boolean {
  return !!value.trim() && Number.isFinite(Number(value)) && Number(value) >= 0;
}

/** Shared by character and companion health controls. */
export function applyHealthAdjustment(character: Pick<CharacterData, 'currentHp' | 'tempHp' | 'maxHp' | 'maxHpOverride'>, action: HealthAction, amount: number): void {
  if (!Number.isFinite(amount) || amount < 0) return;
  amount = Math.floor(amount);
  if (amount === 0 && action !== 'temp') return;
  const current = Math.max(0, character.currentHp ?? 0);
  const temp = Math.max(0, character.tempHp ?? 0);
  if (action === 'damage') {
    character.tempHp = Math.max(0, temp - amount);
    character.currentHp = Math.max(0, current - Math.max(0, amount - temp));
  } else if (action === 'heal') {
    character.currentHp = Math.min(character.maxHpOverride ?? character.maxHp ?? 0, current + amount);
  } else {
    character.tempHp = amount;
  }
}
