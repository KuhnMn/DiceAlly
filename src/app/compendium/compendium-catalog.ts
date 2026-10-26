import { ContentRecord, JsonObject, object } from '../content/content.model';
import { SPELL_SCHOOLS } from '../editor/spell-selection';
import { featureCategoryLabel, featureFilterValues } from '../editor/feature-selection';
import { facilityOrderLabel } from '../models/bastion';

export const CONTENT_TYPES = [
  { id: 'class', label: 'Classes', icon: 'book', kinds: ['class', 'subclass'] },
  { id: 'spell', label: 'Spells', icon: 'wand', kinds: ['spell'] },
  { id: 'feat', label: 'Feats', icon: 'bookmark', kinds: ['feat'] },
  { id: 'optionalfeature', label: 'Optional Features', icon: 'list-plus', kinds: ['optionalfeature'] },
  // Race/subrace raw records are provenance; their materialized species own the complete playable data.
  { id: 'species', label: 'Species', icon: 'head', kinds: ['species'] },
  { id: 'background', label: 'Backgrounds', icon: 'file', kinds: ['background'] },
  { id: 'item', label: 'Items & Equipment', icon: 'backpack', kinds: ['item', 'itemGroup', 'magicvariant'] },
  { id: 'monster', label: 'Monsters', icon: 'swords', kinds: ['monster', 'monsterTemplate'] },
  { id: 'rules', label: 'Rules & Conditions', icon: 'info', kinds: ['condition', 'disease', 'status', 'variantrule', 'action', 'sense', 'skill'] },
  { id: 'table', label: 'Tables', icon: 'layout-list', kinds: ['table'] },
  { id: 'facility', label: 'Bastion Facilities', icon: 'layout-columns', kinds: ['facility'] },
  { id: 'reward', label: 'Charms & Rewards', icon: 'sparkles', kinds: ['reward'] },
  { id: 'world', label: 'Objects & Vehicles', icon: 'stack', kinds: ['object', 'vehicle'] },
  { id: 'reference', label: 'Equipment References', icon: 'list', kinds: ['baseitem', 'itemType', 'itemProperty', 'itemMastery', 'itemEntry'] },
  { id: 'feature', label: 'Class Features', icon: 'sparkles', kinds: ['classFeature', 'subclassFeature'] },
] as const;
export type ContentType = typeof CONTENT_TYPES[number];

export const FACET_LABELS = {
  source: 'Source Book', kind: 'Content Kind', origin: 'Origin', level: 'Level', class: 'Class', subclass: 'Subclass',
  school: 'School', casting: 'Casting Time', ritual: 'Ritual', concentration: 'Concentration',
  category: 'Category', featureType: 'Feature Type', prerequisite: 'Prerequisites', rarity: 'Rarity',
  itemType: 'Equipment Type', attunement: 'Attunement', cr: 'Challenge Rating', creature: 'Creature Type', size: 'Size',
  facilityType: 'Facility Type', facilityLevel: 'Level', facilityOrder: 'Order',
} as const;
export type Facet = keyof typeof FACET_LABELS;
export type Filters = Partial<Record<Facet, string[]>>;
export const KIND_LABELS: Record<string, string> = {
  classFeature: 'Class Feature', subclassFeature: 'Subclass Feature', optionalfeature: 'Optional Feature',
  feat: 'Feat', spell: 'Spell', class: 'Class', subclass: 'Subclass', species: 'Species', race: 'Species', subrace: 'Subspecies',
  background: 'Background', item: 'Item', baseitem: 'Base Item', itemGroup: 'Item Group', magicvariant: 'Magic Variant',
  monster: 'Monster', monsterTemplate: 'Monster Template', variantrule: 'Variant Rule', table: 'Table',
  itemType: 'Item Type', itemProperty: 'Item Property', itemMastery: 'Weapon Mastery', itemEntry: 'Item Reference',
};
export function kindLabel(kind: string): string { return KIND_LABELS[kind] ?? kind.charAt(0).toUpperCase() + kind.slice(1); }
export function schoolLabel(value: string): string { return SPELL_SCHOOLS.find(school => school.value === value)?.label ?? value; }
const SIZE_LABELS: Record<string, string> = { T: 'Tiny', S: 'Small', M: 'Medium', L: 'Large', H: 'Huge', G: 'Gargantuan', V: 'Varies' };

/** Facets use the canonical payloads; historical imported records retain their source-shaped fallback. */
export function recordFacets(record: ContentRecord): Filters {
  const data: JsonObject = { ...record.data, ...record.referenceDefinition };
  const kind = record.kind === 'species' && record.derivation?.operation === 'subrace' ? 'subrace' : record.kind;
  const facets: Filters = { source: [record.publication || 'Unknown'], kind: [kind],
    origin: [record.file.startsWith('homebrew/') ? 'Homebrew' : 'Core Library'] };
  const set = (facet: Facet, value: unknown) => {
    const values = (Array.isArray(value) ? value : [value]).filter((v): v is string | number =>
      (typeof v === 'string' && !!v.trim()) || typeof v === 'number').map(String);
    if (values.length) facets[facet] = [...new Set(values)];
  };
  if (record.kind === 'reward') set('category', data['type']);
  const definition = record.classDefinition;
  const option = record.characterOption;
  const acquisition = featureFilterValues({ ...data, prerequisite: option?.prerequisites ?? data['prerequisite'],
    className: definition?.parent?.name ?? data['className'], level: definition?.level ?? data['level'] });
  set('class', acquisition.classes);
  if (record.kind !== 'facility') set('level', acquisition.levels);
  if (record.kind === 'facility') {
    const type = typeof data['facilityType'] === 'string' ? data['facilityType'].trim().toLowerCase() : '';
    if (type) set('facilityType', type === 'basic' ? 'basic' : 'special');
    set('facilityLevel', typeof data['level'] === 'number' ? data['level'] : 'unspecified');
    set('facilityOrder', data['orders']);
  }
  if (record.kind === 'class') set('class', record.name);
  set('subclass', definition?.subclass?.shortName ?? data['subclassShortName']);
  if (['feat', 'optionalfeature', 'background'].includes(record.kind)) {
    set('category', option?.category ?? data['category']); set('featureType', option?.featureTypes ?? data['featureType']);
    const prerequisites = option?.prerequisites ?? data['prerequisite'];
    set('prerequisite', Array.isArray(prerequisites) && prerequisites.length ? 'Has Prerequisites' : 'None');
  }
  if (record.kind === 'spell') {
    const spell = record.spellDefinition;
    set('level', spell?.level ?? data['level']); set('school', spell?.school ?? data['school']);
    const memberships = spell?.memberships ?? object(data['classes']);
    const classes = Array.isArray(data['classes']) ? data['classes'] : [
      ...(Array.isArray(memberships?.fromClassList) ? memberships.fromClassList : []),
      ...(Array.isArray(memberships?.fromClassListVariant) ? memberships.fromClassListVariant : []),
    ];
    set('class', classes.map(value => object(value)?.['name']));
    const times = spell?.time ?? data['time'];
    set('casting', Array.isArray(times) ? times.map(time => object(time)?.['unit']) : []);
    set('ritual', object(spell?.meta ?? data['meta'])?.['ritual'] ? 'Yes' : 'No');
    const durations = spell?.duration ?? data['duration'];
    set('concentration', Array.isArray(durations) && durations.some(value => object(value)?.['concentration']) ? 'Yes' : 'No');
  }
  if (['item', 'baseitem', 'magicvariant'].includes(record.kind)) {
    const item = record.itemDefinition;
    set('rarity', item?.rarity ?? data['rarity']); set('itemType', item?.type ?? data['type']);
    set('attunement', (item?.reqAttune ?? data['reqAttune']) ? 'Required' : 'Not Required');
  }
  if (record.kind === 'monster') {
    const monster = record.monsterDefinition;
    const cr = monster?.cr ?? data['cr'], type = monster?.type ?? data['type'];
    set('cr', object(cr)?.['cr'] ?? cr); set('creature', object(type)?.['type'] ?? type);
    set('size', monster?.size ?? data['size']);
  } else set('size', record.species?.sizes ?? data['size']);
  return facets;
}
export function facetLabel(facet: Facet, value: string): string {
  if (facet === 'facilityOrder') return facilityOrderLabel(value);
  if (facet === 'facilityType') return value === 'basic' ? 'Basic' : 'Special';
  if (facet === 'facilityLevel') return value === 'unspecified' ? 'No Level Listed' : `Level ${value}`;
  if (facet === 'kind') return kindLabel(value);
  if (facet === 'school') return schoolLabel(value);
  if (facet === 'category' || facet === 'featureType') return featureCategoryLabel(value);
  if (facet === 'size') return SIZE_LABELS[value] ?? value;
  if (facet === 'level') return value === '0' ? 'Cantrip' : `Level ${value}`;
  if (facet === 'casting') return value.charAt(0).toUpperCase() + value.slice(1);
  return value;
}
export function matchesFilters(record: ContentRecord, filters: Filters): boolean {
  const values = recordFacets(record);
  return (Object.entries(filters) as [Facet, string[]][]).every(([facet, selected]) =>
    !selected.length || selected.some(value => values[facet]?.includes(value)));
}
export function summary(record: ContentRecord): string {
  const values = recordFacets(record);
  return (['facilityType', 'facilityLevel', 'level', 'class', 'school', 'category', 'rarity', 'cr', 'creature'] as Facet[])
    .flatMap(facet => (values[facet] ?? []).map(value => facet === 'cr' ? `CR ${value}` : facetLabel(facet, value))).join(' · ');
}
