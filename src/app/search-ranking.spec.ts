import { compareSearchMatches, rankSearchResults } from './search-ranking';

describe('Search relevance', () => {
  it('prioritizes exact names, then shorter matches, ahead of metadata-only matches', () => {
    const names = ['Ascended Longsword', 'Dagger', 'Longsword +1', 'LONGSWORD', 'Ancient Ascended Longsword'];
    expect(rankSearchResults(names, ' longsword ', name => name)).toEqual([
      'LONGSWORD', 'Longsword +1', 'Ascended Longsword', 'Ancient Ascended Longsword', 'Dagger',
    ]);
    expect(compareSearchMatches('Longsword Flame', 'Flame Longsword', 'flame longsword')).toBeGreaterThan(0);
  });

  it('preserves original order for empty searches and equal relevance without mutating entries', () => {
    const names = ['Z Sword', 'A Sword', 'Sword'];
    expect(rankSearchResults(names, ' ', name => name)).toEqual(names);
    expect(rankSearchResults(names, 'sword', name => name)).toEqual(['Sword', 'Z Sword', 'A Sword']);
    expect(names).toEqual(['Z Sword', 'A Sword', 'Sword']);
  });
});
