import type { ContentRecord, JsonObject } from './content.model';
import type { ReferenceDefinition, ReferenceKind } from './reference-content.model';
import type { ObjectSource } from './object.model';
import type { ConditionSource } from './condition.model';
import type { StatusSource } from './status.model';
import type { SenseSource } from './sense.model';
import type { SkillSource } from './skill.model';
import type { ActionSource } from './action.model';
import type { BastionSource } from './bastion.model';
import type { VariantRuleSource } from './variant-rule.model';
import type { DiseaseSource } from './disease.model';
import type { VehicleSource } from './vehicle.model';
import { REFERENCE_VALIDATORS } from './generated/reference-registry';
import { validateReferenceSource } from './content-schema';
import {
  adaptObjectDefinition, adaptConditionDefinition, adaptStatusDefinition, adaptSenseDefinition, adaptSkillDefinition,
  adaptActionDefinition, adaptBastionDefinition, adaptVariantRuleDefinition,
  adaptDiseaseDefinition, adaptVehicleDefinition,
} from './reference-content-adapter';

// Generated copy provenance is not part of the upstream definition.
const PROVENANCE_FIELDS = new Set(['_copy_templates']);

export function isReferenceKind(kind: string): kind is ReferenceKind {
  return Object.hasOwn(REFERENCE_VALIDATORS, kind);
}

/** Restore source fields for copying/linking only; the stored payload remains unduplicated. */
export function referenceSourceData(record: ContentRecord): JsonObject {
  if (!isReferenceKind(record.kind)) throw new Error('Expected an import-only reference category.');
  const definition = record.referenceDefinition;
  if (!definition) return structuredClone(record.data);
  if (definition.version !== 1 || definition.kind !== record.kind) {
    throw new Error('Invalid reference definition version or category.');
  }
  if (Object.keys(record.data).some(field => !PROVENANCE_FIELDS.has(field))) {
    throw new Error('Reference definition contains duplicate source payload.');
  }
  const { version, kind, ...source } = structuredClone(definition);
  return { ...source, ...structuredClone(record.data) };
}

/** Canonicalize only after inheritance and full validation of the resulting source record. */
export async function canonicalReferenceRecord(record: ContentRecord): Promise<ContentRecord & { referenceDefinition: ReferenceDefinition }> {
  if (!isReferenceKind(record.kind)) throw new Error('Expected an import-only reference category.');
  const raw = referenceSourceData(record);
  const data = Object.fromEntries(Object.entries(raw).filter(([field]) => PROVENANCE_FIELDS.has(field)));
  const source = Object.fromEntries(Object.entries(raw).filter(([field]) => !PROVENANCE_FIELDS.has(field)));
  await validateReferenceSource(record.kind, source, record.file);
  let referenceDefinition: ReferenceDefinition;
  switch (record.kind) {
    case 'object': referenceDefinition = { ...adaptObjectDefinition(source as ObjectSource), kind: 'object' }; break;
    case 'condition': referenceDefinition = { ...adaptConditionDefinition(source as ConditionSource), kind: 'condition' }; break;
    case 'status': referenceDefinition = { ...adaptStatusDefinition(source as StatusSource), kind: 'status' }; break;
    case 'sense': referenceDefinition = { ...adaptSenseDefinition(source as SenseSource), kind: 'sense' }; break;
    case 'skill': referenceDefinition = { ...adaptSkillDefinition(source as SkillSource), kind: 'skill' }; break;
    case 'action': referenceDefinition = { ...adaptActionDefinition(source as ActionSource), kind: 'action' }; break;
    case 'facility': referenceDefinition = { ...adaptBastionDefinition(source as BastionSource), kind: 'facility' }; break;
    case 'variantrule': referenceDefinition = { ...adaptVariantRuleDefinition(source as VariantRuleSource), kind: 'variantrule' }; break;
    case 'disease': referenceDefinition = { ...adaptDiseaseDefinition(source as DiseaseSource), kind: 'disease' }; break;
    case 'vehicle': referenceDefinition = { ...adaptVehicleDefinition(source as VehicleSource), kind: 'vehicle' }; break;
  }
  return { ...record, data, referenceDefinition };
}
