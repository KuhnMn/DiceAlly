import { resolveSpellUsageCount, spellUsageCount } from './spell-usage';

describe('Spell usage counts', () => {
  it('supports numeric and ability counts, including each-spell suffixes', () => {
    expect(resolveSpellUsageCount('2e', {})).toBe(2);
    for (const ability of ['str', 'dex', 'con', 'int', 'wis', 'cha']) {
      expect(resolveSpellUsageCount(ability, { [ability]: 3 })).toBe(3);
      expect(resolveSpellUsageCount(`${ability}e`, { [ability]: 0 })).toBe(1);
      expect(spellUsageCount(`${ability}e`)?.each).toBe(true);
    }
  });
  it('rejects unsupported counts and missing or invalid modifiers', () => {
    for (const count of ['unknown', '-1', '1.5', 'intelligence']) {
      expect(spellUsageCount(count)).toBeUndefined();
      expect(() => resolveSpellUsageCount(count, {})).toThrow();
    }
    const invalidModifiers: Record<string, number>[] = [{}, { int: NaN }, { int: 1.5 }];
    for (const modifiers of invalidModifiers) {
      expect(() => resolveSpellUsageCount('int', modifiers)).toThrow();
    }
  });
});
