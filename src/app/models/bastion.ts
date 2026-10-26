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

export const FACILITY_ORDERS = [
  { value: 'craft', label: 'Craft' }, { value: 'empower', label: 'Empower' },
  { value: 'harvest', label: 'Harvest' }, { value: 'maintain', label: 'Maintain' },
  { value: 'recruit', label: 'Recruit' }, { value: 'research', label: 'Research' }, { value: 'trade', label: 'Trade' },
] as const;
export const FACILITY_SPACES = { cramped: 'Cramped', roomy: 'Roomy', vast: 'Vast' } as const;
export const facilityOrderLabel = (value: string) => FACILITY_ORDERS.find(order => order.value === value)?.label ?? value;
export const facilitySpaceLabel = (value: string) => FACILITY_SPACES[value as keyof typeof FACILITY_SPACES] ?? value;

export interface FacilityFilters { type: string; level: string; order: string; }
export const emptyFacilityFilters = (): FacilityFilters => ({ type: 'ALL', level: '', order: '' });
export const facilityFilterCount = (filters: FacilityFilters) => Number(filters.type !== 'ALL') + Number(!!filters.level) + Number(!!filters.order);
export function matchesFacilityFilters(facility: BastionDefinition, filters: FacilityFilters): boolean {
  return (filters.type === 'ALL' || facility.facilityType === filters.type)
    && (!filters.level || facility.level === Number(filters.level)) && (!filters.order || !!facility.orders?.some(order => order === filters.order));
}

/** Preserve source alternatives and size-dependent staffing; never sum mutually exclusive options. */
export function facilityHirelingOptions(facility: BastionDefinition): { value: string; note: string }[] {
  return (facility.hirelings ?? []).map(option => ({
    value: 'exact' in option ? String(option.exact) : option.max != null ? `${option.min}–${option.max}` : `At Least ${option.min}`,
    note: option.space ? facilitySpaceLabel(option.space) : '',
  }));
}
