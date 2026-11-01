import { proficiencyLabel, weaponProficiencyFilterLabel } from './proficiency-labels';

describe('Filtered weapon proficiency descriptions', () => {
  it('preserves the category and property alternatives independent of field order', () => {
    expect(weaponProficiencyFilterLabel('type=martial weapon|property=light;finesse'))
      .toBe('Martial Weapons with the Light or Finesse Property');
    expect(weaponProficiencyFilterLabel('property=finesse;light|type=martial weapon'))
      .toBe('Martial Weapons with the Finesse or Light Property');
    expect(weaponProficiencyFilterLabel('type=simple weapon')).toBe('Simple Weapons');
    expect(weaponProficiencyFilterLabel('property=thrown')).toBe('Weapons with the Thrown Property');
  });

  it('keeps unsupported filters intact instead of dropping or broadening conditions', () => {
    for (const filter of ['type=martial weapon|source=XPHB', 'type=unknown', 'type=constructor',
      'type=martial weapon|property=!heavy', 'property=light;', 'property=light|property=finesse', '']) {
      expect(weaponProficiencyFilterLabel(filter)).toBeUndefined();
      const stored = `All weapons matching ${filter}`;
      expect(proficiencyLabel(stored)).toBe(stored);
    }
  });

  it('formats old wizard descriptions while preserving manual text and entry tags', () => {
    expect(proficiencyLabel('All weapons matching type=martial weapon|property=light;finesse'))
      .toBe('Martial Weapons with the Light or Finesse Property');
    for (const text of ['Light armor', 'Custom training', '{@filter Finesse or Light|items|property=finesse;light}']) {
      expect(proficiencyLabel(text)).toBe(text);
    }
  });
});
