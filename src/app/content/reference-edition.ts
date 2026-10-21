import { SOURCE_PUBLICATION_DATES } from './source-publications';

export type RulesEdition = 'classic' | 'one';

/** Explicit edition wins; publication dates classify books from the revised PHB onward. */
export function referenceEdition(source: string, edition?: unknown): RulesEdition | undefined {
  if (edition === 'classic' || edition === 'one') return edition;
  const published = SOURCE_PUBLICATION_DATES[source.toLowerCase()];
  return typeof published === 'string' ? published >= SOURCE_PUBLICATION_DATES['xphb'] ? 'one' : 'classic' : undefined;
}

/** Only implicit core-book defaults follow the referring record's edition. */
export function referenceDefaultSource(source: string, edition: RulesEdition | undefined): string {
  if (edition !== 'one') return source;
  return ({ PHB: 'XPHB', DMG: 'XDMG', MM: 'XMM' } as Record<string, string>)[source] ?? source;
}
