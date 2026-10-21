import type { ResolvedReferenceSource } from './reference-source.model';

/** Complete source data after copy resolution, retaining site/brew metadata. */
export type ConditionSource = ResolvedReferenceSource<'condition'>;

/** Import/storage definition only; no rules or UI state. */
export type ConditionDefinition = ConditionSource & { version: 1 };
