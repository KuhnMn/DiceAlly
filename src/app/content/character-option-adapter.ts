import { PROFICIENCY_FIELDS } from './proficiency-grants';
import { ContentRecord, JsonObject } from './content.model';
import { CharacterOptionDefinition, CharacterOptionKind, CHARACTER_OPTION_KINDS } from './character-option.model';
import { validateCharacterOption } from './generated/class-validators.mjs';

const FIELDS = ['prerequisite', 'category', 'featureType', ...Object.keys(PROFICIENCY_FIELDS)];
export function isCharacterOptionKind(kind: string): kind is CharacterOptionKind {
  return CHARACTER_OPTION_KINDS.includes(kind as CharacterOptionKind);
}
export function assertCharacterOption(value: unknown): asserts value is CharacterOptionDefinition {
  if (!validateCharacterOption(value)) {
    const issue = validateCharacterOption.errors?.[0];
    throw new Error(`Invalid character option at ${issue?.instancePath || '/'}: ${issue?.message ?? 'invalid structure'}.`);
  }
}
/** Source mapping and historical native snapshot compatibility share these documented fields. */
export function characterOption(record: ContentRecord): CharacterOptionDefinition {
  if (!isCharacterOptionKind(record.kind)) throw new Error('Expected a feat, optional feature, or background.');
  if (record.characterOption) {
    if (FIELDS.some(field => Object.hasOwn(record.data, field))) throw new Error('Character option contains duplicate legacy fields.');
    assertCharacterOption(record.characterOption);
    if (record.characterOption.kind !== record.kind) throw new Error('Character option kind does not match its record.');
    return record.characterOption;
  }
  const data = record.data;
  const definition: CharacterOptionDefinition = {
    version: 1, kind: record.kind,
    prerequisites: structuredClone(data['prerequisite'] === undefined ? [] : data['prerequisite']) as CharacterOptionDefinition['prerequisites'],
    featureTypes: structuredClone(data['featureType'] === undefined ? [] : data['featureType']) as CharacterOptionDefinition['featureTypes'],
    proficiencies: {}, ...(data['category'] === undefined ? {} : { category: data['category'] as CharacterOptionDefinition['category'] })
  };
  for (const [field, target] of Object.entries(PROFICIENCY_FIELDS)) if (data[field] !== undefined) {
    (definition.proficiencies as Record<string, unknown>)[target] = structuredClone(data[field]);
  }
  assertCharacterOption(definition);
  return definition;
}
export function canonicalCharacterOption(record: ContentRecord): ContentRecord & { characterOption: CharacterOptionDefinition } {
  const definition = characterOption(record);
  const data = structuredClone(record.data);
  for (const field of FIELDS) delete data[field];
  return { ...record, data, characterOption: structuredClone(definition) };
}
/** Conventional source fields are reconstructed only for copy inheritance and portable exports. */
export function characterOptionSourceData(record: ContentRecord): JsonObject {
  const definition = characterOption(record);
  const data: JsonObject = { ...structuredClone(record.data), name: record.data['name'] ?? record.name, source: record.publication };
  if (definition.prerequisites.length) data['prerequisite'] = structuredClone(definition.prerequisites);
  if (definition.category !== undefined) data['category'] = definition.category;
  if (definition.kind === 'optionalfeature') data['featureType'] = [...definition.featureTypes];
  for (const [field, target] of Object.entries(PROFICIENCY_FIELDS)) if (definition.proficiencies[target] !== undefined) {
    data[field] = structuredClone(definition.proficiencies[target]);
  }
  return data;
}
