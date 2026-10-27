import { vi } from 'vitest';
import { CompendiumFilterService } from './compendium-filter.service';

describe('Compendium filter preferences', () => {
  beforeEach(() => localStorage.removeItem('ally-compendium-filters-v1'));
  afterEach(() => vi.restoreAllMocks());

  it('restores independent category preferences from browser storage, including an explicit empty selection', () => {
    const preferences = new CompendiumFilterService();
    preferences.save('spell', { filters: { source: ['XPHB'], school: ['A'] }, effects: { damageTypes: ['fire'] } });
    preferences.save('feat', { filters: {}, effects: {} });
    const restored = new CompendiumFilterService();
    expect(restored.load('spell')).toEqual({ filters: { source: ['XPHB'], school: ['A'] }, effects: { damageTypes: ['fire'] } });
    expect(restored.load('feat')).toEqual({ filters: {}, effects: {} });
    expect(restored.load('monster')).toBeUndefined();
    const selection = restored.load('spell')!;
    selection.filters.source!.push('PHB');
    expect(restored.load('spell')!.filters.source).toEqual(['XPHB']);
  });

  it('ignores corrupt saved categories without losing valid preferences', () => {
    localStorage.setItem('ally-compendium-filters-v1', JSON.stringify({
      spell: { filters: { source: 'XPHB' }, effects: {} },
      feat: { filters: { source: ['XPHB'] }, effects: {} },
      monster: { filters: {}, effects: { damageTypes: [123] } },
    }));
    const preferences = new CompendiumFilterService();
    expect(preferences.load('spell')).toBeUndefined();
    expect(preferences.load('monster')).toBeUndefined();
    expect(preferences.load('feat')!.filters.source).toEqual(['XPHB']);
    localStorage.setItem('ally-compendium-filters-v1', '{broken');
    expect(new CompendiumFilterService().load('spell')).toBeUndefined();
  });

  it('keeps preferences in memory when browser storage is unavailable', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('Blocked'); });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('Blocked'); });
    const preferences = new CompendiumFilterService();
    preferences.save('class', { filters: { source: [] }, effects: {} });
    expect(preferences.load('class')!.filters.source).toEqual([]);
  });
});
