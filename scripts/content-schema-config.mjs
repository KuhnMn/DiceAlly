/** The reviewed import surface. Paths refer to full, compiled upstream schemas. */
export const schemaFiles = [
  'class/class.json', 'class/index.json', 'spells/spells.json', 'spells/index.json',
  'spells/sources.json', 'bestiary/bestiary.json', 'bestiary/index.json',
  'bestiary/template.json', 'feats.json', 'optionalfeatures.json', 'races.json',
  'backgrounds.json', 'items-base.json', 'items.json', 'magicvariants.json',
  'conditionsdiseases.json', 'variantrules.json', 'tables.json', 'actions.json',
  'bastions.json', 'objects.json', 'senses.json', 'skills.json', 'vehicles.json', 'rewards.json',
];

export const kindSchemas = {
  class: 'class/class.json', subclass: 'class/class.json',
  classFeature: 'class/class.json', subclassFeature: 'class/class.json',
  spell: 'spells/spells.json', feat: 'feats.json', optionalfeature: 'optionalfeatures.json',
  race: 'races.json', subrace: 'races.json', background: 'backgrounds.json',
  baseitem: 'items-base.json', item: 'items.json', itemGroup: 'items.json',
  magicvariant: 'magicvariants.json', itemType: 'items-base.json',
  itemProperty: 'items-base.json', itemMastery: 'items-base.json', itemEntry: 'items-base.json',
  monster: 'bestiary/bestiary.json', monsterTemplate: 'bestiary/template.json',
  condition: 'conditionsdiseases.json', disease: 'conditionsdiseases.json', status: 'conditionsdiseases.json',
  variantrule: 'variantrules.json', table: 'tables.json', reward: 'rewards.json', action: 'actions.json',
  facility: 'bastions.json', object: 'objects.json', sense: 'senses.json',
  skill: 'skills.json', vehicle: 'vehicles.json',
};

/** Exact resolved-record schemas for the import-only application definitions. */
export const referenceSchemas = Object.fromEntries([
  'object', 'condition', 'status', 'sense', 'skill', 'action', 'facility', 'variantrule', 'disease', 'vehicle',
].map(kind => [kind, `${kindSchemas[kind]}#/$defs/${kind}`]));

export const snapshotDirectory = 'schemas/5etools';
export const generatedDirectory = 'src/app/content/generated';

// brew/entry.json references these via a moving URL. Resolve only this reviewed
// dependency to an exact revision during snapshot maintenance, never at runtime.
export const externalSchema = {
  prefix: 'https://raw.githubusercontent.com/TheGiddyLimit/plutonium-scenes/main/test/schema/',
  pinnedPrefix: 'https://raw.githubusercontent.com/TheGiddyLimit/plutonium-scenes/286b9101629cb3617b965416680415f745028da9/test/schema/',
  commit: '286b9101629cb3617b965416680415f745028da9',
};
