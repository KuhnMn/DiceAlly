import {
  recoverResources,
  resourceCosts,
  spendResource,
  validateResources,
  SourceResource,
} from './source-resources';
import { ExportedCharacter } from './character.model';
import { portableCharacter } from '../characters/portable-character';
import { featureUsesTotal, resolveUsesTotal, validateUsesTotal } from './uses-total';
const pool = (overrides: Partial<SourceResource> = {}): SourceResource => ({
  id: 'psi',
  sourceId: 'source',
  name: 'Psi',
  mode: 'both',
  note: '1d6',
  total: { kind: 'fixed', value: 8 },
  used: 3,
  recovery: 'SHORT_REST',
  features: true,
  spells: true,
  casting: true,
  defaultCost: 2,
  ...overrides,
});
describe('Source resources', () => {
  it('resolves explicit totals from current level and all six ability modifiers', () => {
    expect(featureUsesTotal(undefined)).toBe(1);
    expect(featureUsesTotal({ total: { kind: 'fixed', value: 7 }, used: 0 })).toBe(7);
    for (const [level, expected] of [[1, 2], [5, 3], [9, 4], [13, 5], [17, 6], [20, 6]]) {
      expect(resolveUsesTotal({ kind: 'proficiency-bonus', multiplier: 1 }, { level })).toBe(expected);
    }
    for (const ability of ['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma'] as const) {
      for (const [score, expected] of [[6, 0], [10, 0], [15, 2], [20, 5]]) {
        expect(resolveUsesTotal({ kind: 'ability-modifier', ability }, { abilityScores: { [ability]: score } })).toBe(expected);
      }
    }
    expect(resolveUsesTotal({ kind: 'ability-modifier', ability: 'wisdom' })).toBe(0);
  });
  it('spends against a calculated maximum and preserves definitions through portable export', () => {
    const sheet: ExportedCharacter = { character: { level: 5 }, resources: [pool({ total: { kind: 'proficiency-bonus', multiplier: 1 }, used: 2 })],
      features: [{ name: 'Trait', uses: [{ total: { kind: 'ability-modifier', ability: 'wisdom' }, used: 2 }] }] };
    expect(spendResource(sheet, { resourceId: 'psi', amount: 2 })).toBeNull();
    expect(spendResource(sheet, { resourceId: 'psi', amount: 1 })!.resources![0].used).toBe(3);
    expect(portableCharacter(sheet)).toEqual(sheet);
    for (const invalid of [null, [], 'PB', { kind: 'other' }, { kind: 'ability-modifier', ability: 'luck' }]) {
      expect(() => validateUsesTotal(invalid)).toThrow();
      const malformed = structuredClone(sheet);
      Object.assign(malformed.features![0].uses![0], { total: invalid });
      expect(() => portableCharacter(malformed)).toThrow();
    }
  });
  it('applies PB multipliers with rounding down and rejects unsupported factors', () => {
    for (const multiplier of [0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4] as const) {
      const calculation = { kind: 'proficiency-bonus' as const, multiplier };
      expect(() => validateUsesTotal(calculation)).not.toThrow();
      expect(resolveUsesTotal(calculation, { level: 5 })).toBe(Math.floor(3 * multiplier));
      const sheet: ExportedCharacter = { character: { level: 5 }, resources: [pool({ total: calculation, used: 0 })] };
      expect(portableCharacter(sheet).resources![0].total).toEqual(calculation);
      const total = Math.floor(3 * multiplier);
      expect(spendResource(sheet, { resourceId: 'psi', amount: total })!.resources![0].used).toBe(total);
      expect(spendResource(sheet, { resourceId: 'psi', amount: total + 1 })).toBeNull();
    }
    for (const multiplier of [0, -1, 0.25, 1.25, 4.5, NaN, Infinity, '2', null]) {
      expect(() => validateUsesTotal({ kind: 'proficiency-bonus', multiplier })).toThrow();
    }
  });
  it('spends an exact cost atomically and refuses exhausted, missing, reminder and invalid costs', () => {
    const sheet: ExportedCharacter = { resources: [pool()] };
    const next = spendResource(sheet, { resourceId: 'psi', amount: 4 })!;
    expect(next.resources![0].used).toBe(7);
    expect(sheet.resources![0].used).toBe(3);
    for (const amount of [0, -1, NaN, 1.5, 9])
      expect(spendResource(sheet, { resourceId: 'psi', amount })).toBeNull();
    expect(spendResource(sheet, { resourceId: 'missing', amount: 1 })).toBeNull();
    expect(
      spendResource({ resources: [pool({ mode: 'note' })] }, { resourceId: 'psi', amount: 1 }),
    ).toBeNull();
  });
  it('offers only explicitly linked pools and ignores legacy source casting defaults', () => {
    const sheet: ExportedCharacter = {
      character: { featureSources: [{ editorId: 'source', name: 'Wizard' }] },
      resources: [pool(), pool({ id: 'hint', mode: 'note' })],
    };
    expect(resourceCosts(sheet)).toEqual([]);
    expect(resourceCosts(sheet, [{ resourceId: 'psi', amount: 3 }])).toEqual([
      { resourceId: 'psi', amount: 3 },
    ]);
    expect(resourceCosts(sheet, [{ resourceId: 'hint', amount: 1 }, { resourceId: 'missing', amount: 1 }])).toEqual([]);
  });
  it('respects explicit rest conditions and leaves reminders and manual pools untouched', () => {
    const sheet: ExportedCharacter = {
      resources: [
        pool(),
        pool({ id: 'long', recovery: 'LONG_REST' }),
        pool({ id: 'one', recovery: 'SHORT_REST_ONE' }),
        pool({ id: 'manual', recovery: 'NONE' }),
        pool({ id: 'note', mode: 'note' }),
      ],
    };
    recoverResources(sheet, 'short');
    expect(sheet.resources!.map((p) => p.used)).toEqual([0, 3, 2, 3, 3]);
    recoverResources(sheet, 'long');
    expect(sheet.resources!.map((p) => p.used)).toEqual([0, 0, 1, 3, 3]);
  });
  it('preserves pools and links through portable serialization and rejects corrupt counters and links', () => {
    const sheet: ExportedCharacter = {
      character: {},
      resources: [pool()],
      features: [{ name: 'Psi Strike', resourceLinks: [{ resourceId: 'psi', amount: 2 }] }],
    };
    const saved = portableCharacter(JSON.parse(JSON.stringify(sheet)));
    expect(saved.resources).toEqual(sheet.resources);
    expect(saved.features).toEqual(sheet.features);
    expect(() => validateResources({ ...sheet, resources: [pool({ used: -1 })] })).toThrow();
    expect(() => validateResources({ ...sheet, resources: [pool(), pool()] })).toThrow();
    expect(() =>
      validateResources({
        ...sheet,
        features: [{ name: 'Broken', resourceLinks: [{ resourceId: 'psi', amount: 0 }] }],
      }),
    ).toThrow();
  });
});
