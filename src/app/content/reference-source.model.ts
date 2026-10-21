import type { SiteSourceByKind } from './generated/site-source';
import type { BrewSourceByKind } from './generated/brew-source';

/** Site and brew are explicit profiles; retain their distinct publication/extension metadata.
 * A resolved source has its identity, unlike a possibly incomplete copy instruction.
 */
export type ResolvedReferenceSource<K extends keyof SiteSourceByKind> = Extract<
  SiteSourceByKind[K] | BrewSourceByKind[K], { name: string; source: string }
>;

export type ReferenceEntry = NonNullable<ResolvedReferenceSource<'condition'>['entries']>[number];
export type ReferenceEntries = ReferenceEntry[];
