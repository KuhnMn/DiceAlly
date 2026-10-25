import { coreSchemaName, validateCoreDocument, validateHomebrewDocument } from './content-schema';
import { coreDocumentFixture, homebrewDocumentFixture } from './content-fixtures.testing';

describe('Pinned source schema boundary', () => {
  beforeAll(async () => {
    await validateCoreDocument(coreDocumentFixture('feats.json'), 'feats.json');
    await validateHomebrewDocument(homebrewDocumentFixture({}), 'brew.json');
  }, 30000);

  it('routes files explicitly and refuses unregistered directories', () => {
    expect(coreSchemaName('class/class-phb.json')).toBe('class_class');
    expect(coreSchemaName('spells/sources.json')).toBe('spells_sources');
    expect(coreSchemaName('bestiary/template.json')).toBe('bestiary_template');
    expect(coreSchemaName('generated/gendata-tables.json')).toBe('generated_tables');
    expect(() => coreSchemaName('other/spells.json')).toThrow('No pinned content schema');
  });

  it('accepts current spell targeting tags ALT and WLT while rejecting unknown tags', async () => {
    const value = coreDocumentFixture('spells/spells-aag.json', { spell: [{ name: 'Air Bubble', source: 'AAG', miscTags: ['SGT', 'WLT', 'ALT'] }] });
    const before = structuredClone(value);
    await validateCoreDocument(value, 'spells/spells-aag.json');
    await validateHomebrewDocument(homebrewDocumentFixture({ spell: value['spell'] }), 'targeting-brew.json');
    expect(value).toEqual(before);
    const invalid = coreDocumentFixture('spells/spells-aag.json', { spell: [{ name: 'Air Bubble', source: 'AAG', miscTags: ['UNKNOWN_TARGETING_TAG'] }] });
    await expect(validateCoreDocument(invalid, 'spells/spells-aag.json')).rejects.toMatchObject({ diagnostics: expect.arrayContaining([
      expect.objectContaining({ path: '/spell/0/miscTags/0', code: 'schema-invalid' }),
    ]) });
  });

  it('accepts documented weighted abilities and conditional movement without mutating them', async () => {
    const value = coreDocumentFixture('races.json', { race: [{ name: 'Synthetic', source: 'TEST',
      ability: [{ choose: { weighted: { from: ['str', 'dex', 'con'], weights: [2, 1] } }, max: 22, hidden: true }],
      speed: { walk: 30, fly: true, canHover: true, choose: { from: ['climb', 'swim'], amount: 30 },
        alternate: { walk: [{ number: 20, condition: 'while burdened' }] } },
    }] });
    const original = structuredClone(value);
    await validateCoreDocument(value, 'races.json');
    expect(value).toEqual(original);
  });

  it('rejects unsupported aliases instead of silently normalizing them', async () => {
    const invalid = { feat: [{ name: 'Copy', source: 'TEST', _copy: { name: 'Base', source: 'TEST', mod: {} } }] };
    await expect(validateCoreDocument(invalid, 'feats.json')).rejects.toThrow('Content validation failed');
  });

  it('keeps source validation separate from Android input and diagnoses invalid enums', async () => {
    const value = coreDocumentFixture('spells/test.json', { spell: [{ name: 'Synthetic', source: 'TEST', level: '1' }] });
    await expect(validateCoreDocument(value, 'spells/test.json')).rejects.toHaveProperty('diagnostics', expect.arrayContaining([
      expect.objectContaining({ path: '/spell/0/level', code: 'schema-invalid' }),
    ]));
    const malformed = homebrewDocumentFixture({ action: [{ name: 'Synthetic', source: 'TESTBREW', entries: [], time: [{ number: 1, unit: 'invented' }] }] });
    await expect(validateHomebrewDocument(malformed, 'brew.json')).rejects.toThrow('Content validation failed');
  });
});
