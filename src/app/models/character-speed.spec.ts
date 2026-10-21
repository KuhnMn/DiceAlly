import { adaptSpecies } from '../content/species-adapter';
import { speciesSpeedEntries } from '../content/species-speed-projection';
import { portableCharacter } from '../characters/portable-character';
import { CharacterSpeed, characterSpeedText, decodeCharacterSpeeds, effectiveSpeedFeet, validateCharacterSpeeds, walkingSpeedEntry } from './character-speed';

describe('Character speeds', () => {
  it('migrates historical maps and rejects malformed typed entries', () => {
    expect(decodeCharacterSpeeds({ walk: 25, fly: 0, swim: null })).toEqual([
      walkingSpeedEntry(25), { id: 'fly', type: 'fly', value: { kind: 'fixed', feet: 0 } },
    ]);
    for (const entry of [
      { id: 'walk', type: 'walk', value: { kind: 'walkingSpeed' } },
      { id: 'fly', type: 'fly', value: { kind: 'fixed', feet: -1 } },
      { id: 'swim', type: 'swim', value: { kind: 'fixed', feet: 20 }, canHover: true },
      { id: 'fly', type: 'fly', value: { kind: 'walkingSpeed' }, overrideFeet: 1.5 },
      { id: 'fly', type: 'fly', value: { kind: 'fixed', feet: 20 }, condition: 5 },
    ]) expect(() => validateCharacterSpeeds([entry])).toThrow();
    expect(() => validateCharacterSpeeds([walkingSpeedEntry(), walkingSpeedEntry()])).toThrow('unique IDs');
  });

  it('resolves walking references dynamically and restores them after clearing overrides', () => {
    const walk = walkingSpeedEntry();
    const fly: CharacterSpeed = { id: 'fly', type: 'fly', value: { kind: 'walkingSpeed' }, canHover: true, condition: 'without armor' };
    const speeds = [walk, fly];
    walk.overrideFeet = 45;
    expect(effectiveSpeedFeet(fly, speeds)).toBe(45);
    expect(characterSpeedText(fly, speeds)).toContain('45 ft. (equal to walking speed) (hover)');
    expect(characterSpeedText(fly, speeds)).toContain('without armor');
    fly.overrideFeet = 0;
    expect(effectiveSpeedFeet(fly, speeds)).toBe(0);
    expect(characterSpeedText(fly, speeds)).not.toContain('equal to walking speed');
    delete fly.overrideFeet; delete walk.overrideFeet;
    expect(effectiveSpeedFeet(fly, speeds)).toBe(30);
    expect(portableCharacter({ character: { speeds } }).character?.speeds).toEqual(speeds);
  });

  it('projects declared conditions, alternatives and hover without extracting descriptive movement', () => {
    const definition = adaptSpecies({ speed: { walk: 30, fly: true, canHover: true,
      swim: { number: 20, condition: 'while transformed' }, alternate: { walk: [{ number: 40, condition: 'on all fours' }] } } });
    const speeds = speciesSpeedEntries(definition);
    expect(speeds).toEqual(expect.arrayContaining([
      walkingSpeedEntry(), { id: 'fly', type: 'fly', value: { kind: 'walkingSpeed' }, canHover: true },
      expect.objectContaining({ type: 'swim', condition: 'while transformed', value: { kind: 'fixed', feet: 20 } }),
      expect.objectContaining({ type: 'walk', condition: 'on all fours', value: { kind: 'fixed', feet: 40 } }),
    ]));
    validateCharacterSpeeds(speeds);
    expect(speciesSpeedEntries(adaptSpecies({ entries: ['You can fly 60 feet without armor.'] }))).toEqual([]);
  });
});
