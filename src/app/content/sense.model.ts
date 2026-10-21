import type { ResolvedReferenceSource } from './reference-source.model';

/** Complete source data after copy resolution, retaining site/brew metadata. */
export type SenseSource = ResolvedReferenceSource<'sense'>;

/** Import/storage definition only; no rules or UI state. */
export type SenseDefinition = SenseSource & { version: 1 };
