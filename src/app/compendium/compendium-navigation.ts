import { ParamMap } from '@angular/router';
import { ContentRecord } from '../content/content.model';
import { CONTENT_TYPES } from './compendium-catalog';

export const COMPENDIUM_SEARCH_KINDS = [...new Set(CONTENT_TYPES.flatMap(type => [...type.kinds]))];

export function compendiumDestination(record: ContentRecord, sources: readonly string[]) {
  const category = CONTENT_TYPES.find(type => (type.kinds as readonly string[]).includes(record.kind));
  return {
    commands: ['/compendium', category?.id ?? 'reference'],
    queryParams: { entry: record.key, books: JSON.stringify(sources), ...(record.kind === 'class' || record.kind === 'subclass' ? {} : { q: record.name }) },
  };
}

/** Preserve an explicit empty selection (all books) without changing shared defaults. */
export function requestedSourceBooks(params: ParamMap | undefined): string[] | null {
  const books = params?.get('books');
  if (books === null || books === undefined) return null;
  try {
    const value: unknown = JSON.parse(books);
    return Array.isArray(value) && value.every(book => typeof book === 'string') ? [...new Set(value)] : null;
  } catch { return null; }
}
