import { DisplayItem, DisplayMastery, DisplayProperty, Entry, ItemAttachedSpell } from '../models/character.model';
import { ItemChargeDetails, prepareItemCharges } from '../content/item-charges';

export interface EquipmentDetails {
  charges?: ItemChargeDetails;
  attunementRequirementText?: string;
  descriptionEntries: Entry[];
  properties: DisplayProperty[];
  masteries: DisplayMastery[];
  attachedSpells: ItemAttachedSpell[];
  spellcastingAbilityDescription?: string;
}

/** Presentation reads the detached definition, without library queries or eligibility inference. */
export function prepareEquipmentDetails(entity: DisplayItem): EquipmentDetails {
  const requirement = entity.item.reqAttune;
  return {
    charges: prepareItemCharges(entity.item),
    attunementRequirementText: !requirement || requirement === 'false' ? undefined
      : requirement === 'by anyone' || requirement === 'true' ? 'Required' : requirement.charAt(0).toUpperCase() + requirement.slice(1),
    descriptionEntries: entity.item.entries ?? [],
    properties: entity.properties ?? [],
    masteries: entity.masteries ?? [],
    attachedSpells: entity.attachedSpells ?? [],
    spellcastingAbilityDescription: entity.spellcastingAbilityDescription,
  };
}
