/** Preserve symbolic counts in grants so changing ability scores can recalculate uses. */
export function spellUsageCount(count: string): { value: string; each: boolean } | undefined {
  const match = /^(\d+|str|dex|con|int|wis|cha)(e)?$/.exec(count);
  return match ? { value: match[1], each: !!match[2] } : undefined;
}

export function resolveSpellUsageCount(count: string, modifiers: Readonly<Record<string, number>>): number {
  const parsed = spellUsageCount(count);
  if (!parsed) throw new Error(`Invalid spell usage count: ${count}`);
  const numeric = /^\d+$/.test(parsed.value);
  const value = numeric ? Number(parsed.value) : modifiers[parsed.value];
  if (!Number.isSafeInteger(value) || (numeric && value < 0)) {
    throw new Error(`Invalid or missing spell usage count: ${count}`);
  }
  return numeric ? value : Math.max(1, value);
}
