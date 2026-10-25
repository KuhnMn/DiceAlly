import type { BastionDefinition } from '../content/bastion.model';
import type { ContentReference, FeatureNotes } from './character.model';

/** Each facility is an independent instance; its definition remains usable offline. */
export interface FacilityEntry {
  editorId: string;
  name: string;
  source?: string;
  contentReference?: ContentReference;
  userAdded?: boolean;
  entity: BastionDefinition;
  notes?: FeatureNotes[];
}

export interface CharacterBastion {
  planUrl?: string;
  facilities?: FacilityEntry[];
}

/** Plan images are external web links, never embedded character payloads. */
export function bastionPlanUrl(value: string | undefined): string | null {
  if (!value?.trim()) return null;
  try {
    const url = new URL(value.trim());
    return ['https:', 'http:'].includes(url.protocol) ? url.href : null;
  } catch { return null; }
}

export function facilityTypeLabel(facility: Pick<BastionDefinition, 'facilityType'>): string {
  return facility.facilityType === 'basic' ? 'Basic' : 'Special';
}
