import type { VehicleDefinition, VehicleSource } from './vehicle.model';
import type { DiseaseDefinition, DiseaseSource } from './disease.model';
import type { VariantRuleDefinition, VariantRuleSource } from './variant-rule.model';
import type { BastionDefinition, BastionSource } from './bastion.model';
import type { ActionDefinition, ActionSource } from './action.model';
import type { ObjectDefinition, ObjectSource } from './object.model';
import type { ConditionDefinition, ConditionSource } from './condition.model';
import type { StatusDefinition, StatusSource } from './status.model';
import type { SenseDefinition, SenseSource } from './sense.model';
import type { SkillDefinition, SkillSource } from './skill.model';

/** Inputs use the pinned source types and must pass source validation first.
 * Import storage calls these after copy resolution; rules and UI remain separate.
 */
function detachedSource<T extends { name: string; source: string }>(source: T): T {
  if ('_copy' in source) throw new Error('Resolve copy inheritance before creating a reference definition.');
  return structuredClone(source);
}

export function adaptObjectDefinition(source: ObjectSource): ObjectDefinition {
  const data = detachedSource(source);
  return { ...data, version: 1, entries: data.entries ?? [], actionEntries: data.actionEntries ?? [] };
}

export function adaptConditionDefinition(source: ConditionSource): ConditionDefinition {
  return { ...detachedSource(source), version: 1 };
}

export function adaptStatusDefinition(source: StatusSource): StatusDefinition {
  return { ...detachedSource(source), version: 1 };
}

export function adaptSenseDefinition(source: SenseSource): SenseDefinition {
  return { ...detachedSource(source), version: 1 };
}

export function adaptSkillDefinition(source: SkillSource): SkillDefinition {
  return { ...detachedSource(source), version: 1 };
}

export function adaptActionDefinition(source: ActionSource): ActionDefinition {
  return { ...detachedSource(source), version: 1 };
}

export function adaptBastionDefinition(source: BastionSource): BastionDefinition {
  return { ...detachedSource(source), version: 1 };
}

export function adaptVariantRuleDefinition(source: VariantRuleSource): VariantRuleDefinition {
  return { ...detachedSource(source), version: 1 };
}

export function adaptDiseaseDefinition(source: DiseaseSource): DiseaseDefinition {
  return { ...detachedSource(source), version: 1 };
}

export function adaptVehicleDefinition(source: VehicleSource): VehicleDefinition {
  return { ...detachedSource(source), version: 1 };
}
