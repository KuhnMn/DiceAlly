import { ContentRecord, entityKey, JsonObject, object } from './content.model';
import { ClassAbility, ClassCasting, ClassDefinition, ClassKind, CLASS_KINDS } from './class.model';
import { featureReference } from './class-reference';
import { validateClass } from './generated/class-validators.mjs';

const CASTING_FIELDS = {
  casterProgression: 'progression', spellcastingAbility: 'ability', cantripProgression: 'cantripProgression',
  preparedSpells: 'preparedSpells', preparedSpellsProgression: 'preparedSpellsProgression', preparedSpellsChange: 'preparedSpellsChange',
  spellsKnownProgression: 'spellsKnownProgression', spellsKnownProgressionFixed: 'spellsKnownProgressionFixed',
  spellsKnownProgressionFixedAllowLowerLevel: 'spellsKnownProgressionFixedAllowLowerLevel', spellsKnownProgressionFixedByLevel: 'spellsKnownProgressionFixedByLevel',
} as const;
const OWNER_FIELDS = ['className', 'classSource', 'subclassShortName', 'subclassSource', 'shortName', 'level'];
const FIELDS = ['hd', 'classFeatures', 'subclassFeatures', 'proficiency', 'primaryAbility',
  'startingProficiencies', 'optionalfeatureProgression', ...OWNER_FIELDS, ...Object.keys(CASTING_FIELDS)];
export function isClassKind(kind: string): kind is ClassKind { return CLASS_KINDS.includes(kind as ClassKind); }
export function assertClassDefinition(value: unknown): asserts value is ClassDefinition {
  if (!validateClass(value)) {
    const issue = validateClass.errors?.[0];
    throw new Error(`Invalid canonical class at ${issue?.instancePath || '/'}: ${issue?.message ?? 'invalid structure'}.`);
  }
  const definition = value as ClassDefinition;
  if (definition.parent && definition.parent.key !== entityKey('class', { name: definition.parent.name, source: definition.parent.source })) throw new Error('Invalid canonical class parent identity.');
  const role = definition.kind === 'subclass' ? 'subclassFeature' : 'classFeature';
  for (const reference of definition.features) {
    if (reference.key !== featureReference(reference.uid, role, {}).target) throw new Error('Invalid canonical class feature identity.');
  }
}
function text(data: JsonObject, field: string): string {
  const value = data[field];
  if (typeof value !== 'string' || !value.trim()) throw new Error(`Missing class identity field: ${field}.`);
  return value;
}
/** Source and historical snapshots share the documented upstream outer shapes. */
export function adaptClass(record: ContentRecord): ClassDefinition {
  if (!isClassKind(record.kind)) throw new Error('Expected a class-family record.');
  const data = record.data;
  const result: ClassDefinition = {
    version: 1, kind: record.kind, features: [], casting: {}, savingThrows: [],
    primaryAbilities: [], proficiencies: {}, optionalFeatures: []
  };
  if (record.kind !== 'class') {
    const name = text(data, 'className'); const source = text(data, 'classSource');
    result.parent = { key: entityKey('class', { name, source }), name, source };
  }
  // Historical native snapshots may omit shortName; validated current source requires it.
  if (record.kind === 'subclass') result.shortName = data['shortName'] === undefined ? record.name : text(data, 'shortName');
  if (record.kind === 'subclassFeature') result.subclass = { shortName: text(data, 'subclassShortName'), source: text(data, 'subclassSource') };
  if (record.kind === 'classFeature' || record.kind === 'subclassFeature') result.level = data['level'] as number;
  if (data['hd'] !== undefined) result.hitDice = structuredClone(data['hd']) as ClassDefinition['hitDice'];
  const role = record.kind === 'subclass' ? 'subclassFeature' : 'classFeature';
  const rawFeatures = data[record.kind === 'subclass' ? 'subclassFeatures' : 'classFeatures'];
  if (rawFeatures !== undefined) {
    if (!Array.isArray(rawFeatures)) throw new Error('Class feature references must be an array.');
    result.features = rawFeatures.map(value => {
      const wrapper = typeof value === 'string' ? undefined : object(value);
      const uid = typeof value === 'string' ? value : wrapper?.[role];
      if (typeof uid !== 'string') throw new Error('Invalid class feature reference.');
      const result = { key: featureReference(value, role, data).target, uid };
      if (!wrapper) return result;
      const { [role]: _uid, gainSubclassFeature, gainSubclassFeatureHasContent, tableDisplayName, ...extensions } = wrapper;
      return {
        ...result, ...(gainSubclassFeature === undefined ? {} : { gainSubclassFeature: gainSubclassFeature as boolean }),
        ...(gainSubclassFeatureHasContent === undefined ? {} : { gainSubclassFeatureHasContent: gainSubclassFeatureHasContent as boolean }),
        ...(tableDisplayName === undefined ? {} : { tableDisplayName: tableDisplayName as string }),
        ...(Object.keys(extensions).length ? { extensions: structuredClone(extensions) } : {})
      };
    });
  }
  for (const [field, target] of Object.entries(CASTING_FIELDS)) if (data[field] !== undefined) {
    (result.casting as Record<string, unknown>)[target] = structuredClone(data[field]);
  }
  if (data['proficiency'] !== undefined) result.savingThrows = structuredClone(data['proficiency']) as ClassAbility[];
  if (data['primaryAbility'] !== undefined) {
    if (!Array.isArray(data['primaryAbility'])) throw new Error('Class primary abilities must be alternatives.');
    result.primaryAbilities = data['primaryAbility'].map(value => {
      const option = object(value);
      if (!option || Object.values(option).some(value => value !== true)) throw new Error('Invalid class primary ability alternative.');
      return Object.keys(option) as ClassAbility[];
    });
  }
  if (data['startingProficiencies'] !== undefined) result.proficiencies.starting = structuredClone(data['startingProficiencies']) as ClassDefinition['proficiencies']['starting'];
  if (data['multiclassing'] !== undefined) {
    const multiclass = object(data['multiclassing']);
    if (!multiclass) throw new Error('Invalid multiclass definition.');
    if (multiclass['proficienciesGained'] !== undefined) result.proficiencies.multiclass = structuredClone(multiclass['proficienciesGained']) as ClassDefinition['proficiencies']['multiclass'];
  }
  if (data['optionalfeatureProgression'] !== undefined) result.optionalFeatures = structuredClone(data['optionalfeatureProgression']) as ClassDefinition['optionalFeatures'];
  assertClassDefinition(result);
  return result;
}
export function canonicalClassRecord(record: ContentRecord): ContentRecord & { classDefinition: ClassDefinition } {
  if (!isClassKind(record.kind)) throw new Error('Expected a class-family record.');
  if (record.classDefinition && (FIELDS.some(field => Object.hasOwn(record.data, field)) || Object.hasOwn(object(record.data['multiclassing']) ?? {}, 'proficienciesGained'))) throw new Error('Canonical class contains duplicate legacy mechanical fields.');
  const definition = record.classDefinition ?? adaptClass(record);
  assertClassDefinition(definition);
  if (definition.kind !== record.kind) throw new Error('Class contract kind does not match its record.');
  const data = structuredClone(record.data);
  for (const field of FIELDS) delete data[field];
  const multiclass = object(data['multiclassing']);
  if (multiclass) {
    delete multiclass['proficienciesGained'];
    if (!Object.keys(multiclass).length) delete data['multiclassing'];
  }
  return { ...record, data, classDefinition: structuredClone(definition) };
}
/** Legacy support is confined to the snapshot boundary; current consumers use named fields. */
export function classDefinition(record: ContentRecord): ClassDefinition {
  if (!isClassKind(record.kind)) throw new Error('Expected a class-family record.');
  if (record.classDefinition) {
    assertClassDefinition(record.classDefinition);
    if (record.classDefinition.kind !== record.kind) throw new Error('Class contract kind does not match its record.');
    return record.classDefinition;
  }
  return adaptClass(record);
}
export function castingMetadata(record: ContentRecord | undefined): ClassCasting {
  if (!record) return {};
  // Nonclass fields are retained only for historical native snapshots/manual source declarations.
  // Validated upstream spell grants declare their casting ability inside additionalSpells instead.
  return isClassKind(record.kind) ? classDefinition(record).casting : {
    ability: record.data['spellcastingAbility'] as ClassAbility | undefined,
    preparedSpells: record.data['preparedSpells'] as ClassCasting['preparedSpells'],
    spellsKnownProgression: record.data['spellsKnownProgression'] as ClassCasting['spellsKnownProgression'],
  };
}
/** Reconstruct upstream fields for copy inheritance and portable feature projection only. */
export function classSourceData(record: ContentRecord): JsonObject {
  const definition = classDefinition(record);
  const result: JsonObject = { ...structuredClone(record.data), name: record.data['name'] ?? record.name, source: record.publication };
  for (const [field, target] of Object.entries(CASTING_FIELDS)) if (definition.casting[target] !== undefined) result[field] = structuredClone(definition.casting[target]);
  if (definition.parent) Object.assign(result, { className: definition.parent.name, classSource: definition.parent.source });
  if (definition.shortName !== undefined) result['shortName'] = definition.shortName;
  if (definition.level !== undefined) result['level'] = definition.level;
  if (definition.subclass) Object.assign(result, { subclassShortName: definition.subclass.shortName, subclassSource: definition.subclass.source });
  if (definition.hitDice) result['hd'] = structuredClone(definition.hitDice);
  if (definition.kind === 'class' || definition.kind === 'subclass') {
    const role = definition.kind === 'class' ? 'classFeature' : 'subclassFeature';
    result[definition.kind === 'class' ? 'classFeatures' : 'subclassFeatures'] = definition.features.map(reference => {
      const { key: _key, uid, extensions, ...metadata } = reference;
      return Object.keys(metadata).length || extensions ? { ...structuredClone(extensions ?? {}), [role]: uid, ...metadata } : uid;
    });
  }
  if (definition.savingThrows.length) result['proficiency'] = [...definition.savingThrows];
  if (definition.primaryAbilities.length) result['primaryAbility'] = definition.primaryAbilities.map(option => Object.fromEntries(option.map(ability => [ability, true])));
  if (definition.optionalFeatures.length) result['optionalfeatureProgression'] = structuredClone(definition.optionalFeatures);
  if (definition.proficiencies.starting) result['startingProficiencies'] = structuredClone(definition.proficiencies.starting);
  if (definition.proficiencies.multiclass) result['multiclassing'] = { ...object(result['multiclassing']), proficienciesGained: structuredClone(definition.proficiencies.multiclass) };
  return result;
}
export function projectClassFeatureData(record: ContentRecord): JsonObject {
  if (record.kind !== 'classFeature' && record.kind !== 'subclassFeature') throw new Error('Expected a class feature.');
  return classSourceData(record);
}
