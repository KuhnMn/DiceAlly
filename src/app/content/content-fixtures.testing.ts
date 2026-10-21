import { JsonObject } from './content.model';

/** Complete synthetic source documents for pipeline tests (never production defaults). */
export function sourceRecordFixture(kind: string, value: JsonObject): JsonObject {
  if (value['_copy']) return value;
  const fields: Record<string, JsonObject> = {
    class: { classFeatures: [] }, subclass: { shortName: value['name'], subclassFeatures: [] },
    spell: { level: 0, school: 'A', time: [{ number: 1, unit: 'action' }],
      range: { type: 'point', distance: { type: 'self' } }, duration: [{ type: 'instant' }], entries: [] },
    feat: { entries: [] }, background: { skillProficiencies: [{ arcana: true }], entries: [] },
    monster: { size: ['M'], type: 'humanoid' }, baseitem: { type: 'OTH|XPHB', rarity: 'none' },
  };
  return { ...fields[kind], ...value };
}

export function sourceDocumentFixture(value: JsonObject): JsonObject {
  return Object.fromEntries(Object.entries(value).map(([kind, entries]) => [kind,
    Array.isArray(entries) ? entries.map(entry => sourceRecordFixture(kind, entry)) : entries]));
}

export function coreDocumentFixture(file: string, override?: JsonObject): JsonObject {
  const named = { name: file, source: 'TEST', entries: [] };
  const roots: Record<string, JsonObject> = {
    'feats.json': { feat: [named] },
    'conditionsdiseases.json': { condition: [named], disease: [{ ...named, name: 'Fixture Disease' }], status: [{ ...named, name: 'Fixture Status' }] },
    'items-base.json': {
      baseitem: [{ name: 'Fixture Base', source: 'TEST', type: 'OTH|XPHB', rarity: 'none' }],
      itemType: [{ abbreviation: 'OTH', source: 'XPHB', page: 1, name: 'Other' }],
      itemProperty: [{ abbreviation: 'F', source: 'TEST', page: 1, name: 'Fixture Property', entries: [{ type: 'entries', name: 'Fixture Property', entries: [] }] }],
      itemEntry: [{ name: 'Fixture Item Entry', source: 'TEST', entriesTemplate: [] }],
      itemTypeAdditionalEntries: [{ appliesTo: 'OTH|XPHB', entries: [] }],
    },
    'optionalfeatures.json': { optionalfeature: [{ ...named, featureType: ['EI'] }] },
    'races.json': { race: [{ name: 'Fixture Race', source: 'TEST', speed: 30 }], subrace: [{ name: 'Fixture Subrace', source: 'TEST', raceName: 'Fixture Race', raceSource: 'TEST' }] },
    'backgrounds.json': { background: [{ ...named, skillProficiencies: [{ arcana: true }] }] },
    'variantrules.json': { variantrule: [{ ...named, ruleType: 'O' }] },
    'generated/gendata-variantrules.json': { variantrule: [{ ...named, ruleType: 'O' }] },
    'tables.json': { table: [{ name: file, source: 'TEST', type: 'table', colLabels: ['Result'], rows: [['Example']] }] },
    'generated/gendata-tables.json': { table: [{ name: file, source: 'TEST', type: 'table', colLabels: ['Result'], rows: [['Example']] }], tableGroup: [] },
    'items.json': { item: [{ ...named, rarity: 'none' }] },
    'magicvariants.json': { magicvariant: [{ name: 'Fixture Variant', requires: [{ weapon: true }], inherits: { source: 'TEST', rarity: 'common' } }] },
    'actions.json': { action: [{ ...named, page: 1 }] },
    'bastions.json': { facility: [{ ...named, facilityType: 'basic' }] },
    'objects.json': { object: [{ ...named, size: ['M'], objectType: 'GEN', ac: 10, hp: 10 }] },
    'senses.json': { sense: [named] }, 'skills.json': { skill: [{ ...named, ability: 'wis' }] },
    'vehicles.json': { vehicle: [{ ...named, vehicleType: 'OBJECT', size: ['L'], terrain: ['land'] }], vehicleUpgrade: [{ ...named, upgradeType: ['SHP:H'] }] },
    'bestiary/template.json': { monsterTemplate: [{ name: 'Fixture Template', source: 'TEST', apply: {} }] },
    'spells/sources.json': { TEST: { 'Fixture Spell': { class: [{ name: 'Mage', source: 'TEST' }] } } },
  };
  const fallback = file.startsWith('class/') ? { class: [{ name: 'Mage', source: 'TEST', classFeatures: ['Ability|Mage|TEST|1'] }],
    classFeature: [{ name: 'Ability', source: 'TEST', className: 'Mage', classSource: 'TEST', level: 1, entries: [] }] }
    : file.startsWith('spells/') ? { spell: [{ name: 'Fixture Spell', source: 'TEST' }] }
    : { monster: [{ name: 'Fixture Monster', source: 'TEST' }] };
  return sourceDocumentFixture({ ...(roots[file] ?? fallback), ...override });
}

export function homebrewDocumentFixture(value: JsonObject): JsonObject {
  const metadata = value['_meta'] as JsonObject | undefined;
  const sources = (metadata?.['sources'] ?? [{ json: 'TESTBREW' }]) as JsonObject[];
  return sourceDocumentFixture({ ...value, _meta: {
    dateAdded: 1, dateLastModified: 1, edition: 'classic', ...metadata,
    sources: sources.map(source => ({ abbreviation: source['json'], full: 'Synthetic source', version: '1.0.0', ...source })),
  } });
}
