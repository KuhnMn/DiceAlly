import type { ResolvedReferenceSource } from './reference-source.model';

/** Complete source data after copy resolution, retaining site/brew metadata. */
export type SkillSource = ResolvedReferenceSource<'skill'>;

/** Import/storage definition only; no rules or UI state. */
export type SkillDefinition = SkillSource & { version: 1 };
