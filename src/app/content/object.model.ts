import type { ResolvedReferenceSource, ReferenceEntries } from './reference-source.model';

export type ObjectSource = ResolvedReferenceSource<'object'>;

// Distribute over the source profiles so site-only and brew-only metadata remain typed.
type DefinedObject<Source> = Source extends ObjectSource
  ? Omit<Source, 'entries' | 'actionEntries'> & {
      version: 1;
      entries: ReferenceEntries;
      actionEntries: ReferenceEntries;
    }
  : never;

/** Typed source stats and metadata with explicit description/action arrays after adaptation. */
export type ObjectDefinition = DefinedObject<ObjectSource>;
