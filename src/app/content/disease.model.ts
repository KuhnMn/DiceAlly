import type { ResolvedReferenceSource } from './reference-source.model';

/** Complete source data after copy resolution, retaining site/brew metadata. */
export type DiseaseSource = ResolvedReferenceSource<'disease'>;

/** Import/storage definition only; no rules or UI state. */
export type DiseaseDefinition = DiseaseSource & { version: 1 };
