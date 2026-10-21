import type { ResolvedReferenceSource } from './reference-source.model';

/** Complete validated status reference data; separate from active sheet state. */
export type StatusSource = ResolvedReferenceSource<'status'>;
export type StatusDefinition = StatusSource & { version: 1 };
