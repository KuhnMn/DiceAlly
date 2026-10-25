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

  it('accepts current spell targeting tags and warns on future optional metadata', async () => {
    const value = coreDocumentFixture('spells/spells-aag.json', { spell: [{ name: 'Air Bubble', source: 'AAG', miscTags: ['SGT', 'WLT', 'ALT'] }] });
    const before = structuredClone(value);
    await validateCoreDocument(value, 'spells/spells-aag.json');
    await validateHomebrewDocument(homebrewDocumentFixture({ spell: value['spell'] }), 'targeting-brew.json');
    expect(value).toEqual(before);
    const future = coreDocumentFixture('spells/spells-aag.json', { spell: [{ name: 'Air Bubble', source: 'AAG', miscTags: ['UNKNOWN_TARGETING_TAG'] }] });
    const original = structuredClone(future);
    await expect(validateCoreDocument(future, 'spells/spells-aag.json')).resolves.toEqual([
      expect.objectContaining({ severity: 'warning', path: '/spell/0/miscTags', code: 'schema-metadata' }),
    ]);
    expect(future).toEqual(original);
  });

  it('collects warnings for several records and fields without changing known or unknown metadata', async () => {
    const value = coreDocumentFixture('spells/future.json', { spell: [
      { name: 'First', source: 'TEST', miscTags: ['HL', 'FUTURE'], areaTags: ['S', 'FUTURE_AREA'] },
      { name: 'Second', source: 'TEST', miscTags: ['FUTURE_2'] },
    ] });
    const before = structuredClone(value), warnings = await validateCoreDocument(value, 'spells/future.json');
    expect(warnings.map(issue => issue.path).sort()).toEqual(['/spell/0/areaTags', '/spell/0/miscTags', '/spell/1/miscTags']);
    expect(warnings.every(issue => issue.severity === 'warning')).toBe(true);
    expect(value).toEqual(before);
    const brew = homebrewDocumentFixture(value);
    expect((await validateHomebrewDocument(brew, 'future-brew.json')).length).toBe(3);
  });

  it('warns on descriptive monster indexes while keeping creature mechanics strict', async () => {
    const monster = { name: 'Future Monster', source: 'TEST', environment: ['forest', 'FUTURE_ENV'],
      traitTags: ['Amphibious', 'FUTURE_TRAIT'], actionTags: ['Multiattack', 'FUTURE_ACTION'], languageTags: ['C', 'FUTURE_LANGUAGE'],
      senseTags: ['D', 'FUTURE_SENSE'], spellcastingTags: ['I', 'FUTURE_CASTING'], damageTags: ['B', 'FUTURE_DAMAGE'] };
    const value = coreDocumentFixture('bestiary/test.json', {monster: [monster]}), before = structuredClone(value);
    const warnings = await validateCoreDocument(value, 'bestiary/test.json');
    expect(warnings).toHaveLength(7); expect(warnings.every(issue => issue.code === 'schema-metadata')).toBe(true);
    expect(value).toEqual(before);
    const invalid = coreDocumentFixture('bestiary/test.json', {monster: [{...monster, size: ['FUTURE_SIZE']}]});
    await expect(validateCoreDocument(invalid, 'bestiary/test.json')).rejects.toThrow('Content validation failed');
  });

  it('keeps malformed tag arrays, rendering errors and mechanical enums blocking even alongside unknown metadata', async () => {
    for (const tags of [['FUTURE', 'FUTURE'], ['FUTURE', 42], 'FUTURE', []]) {
      const value = coreDocumentFixture('spells/future.json', { spell: [{ name: 'Invalid', source: 'TEST', miscTags: tags }] });
      await expect(validateCoreDocument(value, 'spells/future.json')).rejects.toThrow('Content validation failed');
    }
    const malformed = coreDocumentFixture('spells/future.json', { spell: [{ name: 'Invalid', source: 'TEST', miscTags: ['FUTURE'], entries: [{ type: 'table', rows: 'broken' }] }] });
    await expect(validateCoreDocument(malformed, 'spells/future.json')).rejects.toMatchObject({ diagnostics: expect.arrayContaining([
      expect.objectContaining({ severity: 'error', code: 'schema-invalid' }),
    ]) });
    const school = coreDocumentFixture('spells/future.json', { spell: [{ name: 'Invalid School', source: 'TEST', school: 'FUTURE_SCHOOL', miscTags: ['FUTURE'] }] });
    await expect(validateCoreDocument(school, 'spells/future.json')).rejects.toThrow('Content validation failed');
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
