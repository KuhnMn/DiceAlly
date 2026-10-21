import {
  adaptConditionDefinition,
  adaptObjectDefinition,
  adaptSenseDefinition,
  adaptSkillDefinition,
} from './reference-content-adapter';
import type { ObjectSource } from './object.model';
import type { ConditionSource } from './condition.model';
import type { SenseSource } from './sense.model';
import type { SkillSource } from './skill.model';
import { validateCoreDocument, validateHomebrewDocument } from './content-schema';
import { homebrewDocumentFixture } from './content-fixtures.testing';

describe('Detached reference definitions', () => {
  beforeAll(async () => {
    await validateCoreDocument({ sense: [{ name: 'Warmup', source: 'TEST', entries: [] }] }, 'senses.json');
    await validateHomebrewDocument(homebrewDocumentFixture({}), 'brew.json');
  }, 30000);
  it('preserves object stat alternatives, actions and metadata without sharing mutable data', async () => {
    const source: ObjectSource = {
      name: 'Synthetic Engine', source: 'TEST', size: ['L'], objectType: 'SW',
      hp: { special: 'Determined by its builder' }, ac: { special: 'Varies by material' },
      str: 0, speed: { walk: 10, fly: { number: 30, condition: 'while powered' } },
      immune: ['poison'], conditionImmune: ['charmed'],
      entries: ['Synthetic description'], actionEntries: [{ type: 'entries', entries: ['Synthetic action'] }],
      tokenCredit: 'Synthetic credit',
    };
    await validateCoreDocument({ object: [source] }, 'objects.json');
    const before = structuredClone(source);
    const definition = adaptObjectDefinition(source);
    expect(definition).toEqual({ ...source, version: 1 });
    definition.entries.push('Local text');
    definition.actionEntries.push('Local action');
    definition.size.push('H');
    expect(source).toEqual(before);
    expect(adaptObjectDefinition({ name: 'Plain', source: 'TEST', size: ['M'], objectType: 'GEN', hp: 10 }))
      .toEqual({ version: 1, name: 'Plain', source: 'TEST', size: ['M'], objectType: 'GEN', hp: 10, entries: [], actionEntries: [] });
  });

  it('retains condition aliases and homebrew metadata without creating active-condition state', async () => {
    const source: ConditionSource = {
      name: 'Synthetic Condition', source: 'TESTBREW', alias: ['Synthetic Alias'], color: 'ff00ff',
      entries: [{ type: 'entries', entries: ['Reference text'] }],
    };
    await validateHomebrewDocument(homebrewDocumentFixture({ condition: [source] }), 'brew.json');
    const definition = adaptConditionDefinition(source);
    expect(definition).toEqual({ ...source, version: 1 });
    definition.alias!.push('Local alias');
    expect(source.alias).toEqual(['Synthetic Alias']);
    expect(definition).not.toHaveProperty('active');
  });

  it('preserves sense descriptions and optional skill abilities without introducing mechanics', async () => {
    const sense: SenseSource = { name: 'Synthetic Sense', source: 'TEST', entries: ['Reference text'] };
    const skill: SkillSource = { name: 'Synthetic Skill', source: 'TEST', ability: 'int', entries: ['Reference text'] };
    await validateCoreDocument({ sense: [sense] }, 'senses.json');
    await validateCoreDocument({ skill: [skill] }, 'skills.json');
    const senseDefinition = adaptSenseDefinition(sense);
    const skillDefinition = adaptSkillDefinition(skill);
    expect(senseDefinition).toEqual({ ...sense, version: 1 });
    expect(skillDefinition).toEqual({ ...skill, version: 1 });
    senseDefinition.entries.push('Local text');
    skillDefinition.entries.push('Local text');
    expect(sense.entries).toHaveLength(1);
    expect(skill.entries).toHaveLength(1);
    const unspecified = adaptSkillDefinition({ name: 'Unspecified', source: 'TEST', entries: [] });
    expect(unspecified).not.toHaveProperty('ability');
    expect(senseDefinition).not.toHaveProperty('range');
    expect(skillDefinition).not.toHaveProperty('proficient');
  });

  it('rejects unresolved inheritance instead of adapting incomplete copy instructions', () => {
    const source: ObjectSource = { name: 'Copy', source: 'TEST', size: ['M'], objectType: 'GEN', hp: 10 };
    const unresolved = { ...source, _copy: { name: 'Base', source: 'TEST' } };
    expect(() => adaptObjectDefinition(unresolved))
      .toThrow('Resolve copy inheritance');
    const sense = { name: 'Copy', source: 'TEST', entries: [], _copy: { name: 'Base', source: 'TEST' } };
    expect(() => adaptSenseDefinition(sense)).toThrow('Resolve copy inheritance');
    expect(() => adaptSkillDefinition(sense)).toThrow('Resolve copy inheritance');
  });
});
