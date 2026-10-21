import type { ResolvedReferenceSource } from './reference-source.model';

/** Complete source data after copy resolution, retaining site/brew metadata. */
export type ActionSource = ResolvedReferenceSource<'action'>;

/** Import/storage definition only; no rules or UI state. */
export type ActionDefinition = ActionSource & { version: 1 };
