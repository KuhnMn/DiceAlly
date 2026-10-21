import type { ObjectDefinition } from './object.model';
import type { ConditionDefinition } from './condition.model';
import type { StatusDefinition } from './status.model';
import type { SenseDefinition } from './sense.model';
import type { SkillDefinition } from './skill.model';
import type { ActionDefinition } from './action.model';
import type { BastionDefinition } from './bastion.model';
import type { VariantRuleDefinition } from './variant-rule.model';
import type { DiseaseDefinition } from './disease.model';
import type { VehicleDefinition } from './vehicle.model';

export interface ReferenceDefinitions {
  object: ObjectDefinition;
  condition: ConditionDefinition;
  status: StatusDefinition;
  sense: SenseDefinition;
  skill: SkillDefinition;
  action: ActionDefinition;
  facility: BastionDefinition;
  variantrule: VariantRuleDefinition;
  disease: DiseaseDefinition;
  vehicle: VehicleDefinition;
}
export type ReferenceKind = keyof ReferenceDefinitions;
/** Discriminated stored payload. Shared identity and links remain on ContentRecord. */
export type ReferenceDefinition = {
  [K in ReferenceKind]: ReferenceDefinitions[K] & { kind: K };
}[ReferenceKind];
