import { ContentRecord, JsonObject, normalize } from './content.model';
import { SpellDefinition, SpellClassMembership } from './spell.model';
import { mergeSpellMemberships } from './spell-membership';
import validateSpell from './generated/spell-validators.mjs';

const SPELL_FIELDS = ['level', 'school', 'time', 'range', 'components', 'duration', 'meta', 'spellAttack'] as const;
export function assertSpellDefinition(value: unknown): asserts value is SpellDefinition {
  if (!validateSpell(value)) {
    const issue = validateSpell.errors?.[0];
    throw new Error(`Invalid canonical spell at ${issue?.instancePath || '/'}: ${issue?.message ?? 'invalid structure'}.`);
  }
}
/** Source shapes are mapped once; historical flat memberships are accepted only at this boundary. */
export function spellDefinition(record: ContentRecord): SpellDefinition {
  if (record.kind !== 'spell') throw new Error('Expected a spell record.');
  if (record.spellDefinition) {
    if ([...SPELL_FIELDS, 'classes'].some(field => Object.hasOwn(record.data, field))) throw new Error('Canonical spell contains duplicate legacy fields.');
    assertSpellDefinition(record.spellDefinition);
    return record.spellDefinition;
  }
  const definition = {
    version: 1, ...Object.fromEntries(SPELL_FIELDS.flatMap(field =>
      record.data[field] === undefined ? [] : [[field, structuredClone(record.data[field])]])),
    memberships: mergeSpellMemberships(record.data['classes'], undefined)
  };
  assertSpellDefinition(definition);
  return definition;
}
export function canonicalSpellRecord(record: ContentRecord, overlay?: JsonObject): ContentRecord & { spellDefinition: SpellDefinition } {
  const source = overlay ? { ...record, spellDefinition: undefined, data: spellSourceData(record) } : record;
  const definition = spellDefinition(source);
  if (overlay) definition.memberships = mergeSpellMemberships(source.data['classes'], overlay);
  assertSpellDefinition(definition);
  const data = structuredClone(record.data);
  for (const field of [...SPELL_FIELDS, 'classes']) delete data[field];
  return { ...record, data, spellDefinition: structuredClone(definition) };
}
/** Runtime consumers use these explicit lists; aliases and flat Android lists stay at the boundary. */
export function spellRecordClasses(record: ContentRecord): SpellClassMembership[] {
  const memberships = spellDefinition(record).memberships;
  const entries = new Map<string, SpellClassMembership>();
  for (const entry of [...memberships.fromClassList, ...memberships.fromClassListVariant]) {
    entries.set(JSON.stringify([normalize(entry.name), normalize(entry.source)]), { name: entry.name, source: entry.source });
  }
  return [...entries.values()];
}
/** Reconstruct conventional fields for copy inheritance and all-in-one portable spell entities. */
export function spellSourceData(record: ContentRecord): JsonObject {
  const definition = spellDefinition(record);
  return {
    ...structuredClone(record.data), name: record.data['name'] ?? record.name, source: record.publication,
    ...Object.fromEntries(SPELL_FIELDS.flatMap(field => definition[field] === undefined ? [] : [[field, structuredClone(definition[field])]])),
    classes: structuredClone(definition.memberships)
  };
}
export function projectSpellData(record: ContentRecord): JsonObject {
  return { ...spellSourceData(record), classes: spellRecordClasses(record) };
}
