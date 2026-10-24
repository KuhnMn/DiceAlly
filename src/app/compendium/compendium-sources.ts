/** Shared defaults may include books absent from a particular category or class. */
export function relevantSources(selection: readonly string[], books: readonly string[]): string[] {
  const available = new Set(books);
  return [...new Set(selection)].filter(book => available.has(book));
}

export function sourceChipValues(selection: readonly string[], books: readonly string[]): string[] {
  const relevant = relevantSources(selection, books);
  return relevant.length || !selection.length ? relevant : ['No matching source books'];
}

export function sourceFilterCount(selection: readonly string[], books: readonly string[]): number {
  // A restrictive selection with no applicable books is still one removable filter.
  return selection.length ? Math.max(1, relevantSources(selection, books).length) : 0;
}
