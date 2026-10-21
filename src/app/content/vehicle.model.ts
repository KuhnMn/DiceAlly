import type { ResolvedReferenceSource } from './reference-source.model';

/** Complete source data after copy resolution, retaining site/brew metadata. */
export type VehicleSource = ResolvedReferenceSource<'vehicle'>;

/** Import/storage definition only; no rules or UI state. */
export type VehicleDefinition = VehicleSource & { version: 1 };
