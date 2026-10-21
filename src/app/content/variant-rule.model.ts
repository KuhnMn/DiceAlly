import type { ResolvedReferenceSource } from './reference-source.model';

/** Complete source data after copy resolution, retaining site/brew metadata. */
export type VariantRuleSource = ResolvedReferenceSource<'variantrule'>;

/** Import/storage definition only; no rules or UI state. */
export type VariantRuleDefinition = VariantRuleSource & { version: 1 };
