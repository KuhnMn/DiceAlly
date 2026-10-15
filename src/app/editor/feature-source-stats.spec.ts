import { TestBed } from '@angular/core/testing';
import { CharacterHelpersService } from '../sheet/character-helpers.service';
import { featureSourceStats } from './feature-source-stats';

describe('Feature source stats shared by viewer and creator', () => {
  it('shows ability modifiers separately from attacks, including custom overrides', () => {
    const helpers = TestBed.inject(CharacterHelpersService);
    expect(featureSourceStats({ usesIntelligence: true, customToHit: 7, customDc: 16 },
      { level: 1, abilityScores: { intelligence: 16 } }, helpers)).toEqual([
      { ability: 'INT', modifier: '+3', attack: '+7', save: 16 },
    ]);
    expect(featureSourceStats({ usesWisdom: true },
      { level: 5, abilityScores: { wisdom: 8 } }, helpers)).toEqual([
      { ability: 'WIS', modifier: '-1', attack: '+2', save: 10 },
    ]);
  });

  it('keeps a custom source visible with only one configured stat', () => {
    expect(featureSourceStats({ customDc: 14 }, { level: 1 }, TestBed.inject(CharacterHelpersService)))
      .toEqual([{ ability: 'CUSTOM', modifier: '—', attack: '—', save: 14 }]);
  });
});
