const normalize = (value: string) => value.trim().toLowerCase().replace(/\s+/g, ' ');

/** Name relevance only: preserve existing filters and use their ordering for ties. */
export function compareSearchMatches(left: string, right: string, search: string): number {
  const query = normalize(search);
  if (!query) return 0;
  const terms = query.split(' ');
  const score = (label: string): [number, number] => {
    const name = normalize(label);
    const match = name === query ? 0 : name.includes(query) ? 1 : terms.every(term => name.includes(term)) ? 2 : 3;
    return [match, name.length];
  };
  const a = score(left), b = score(right);
  return a[0] - b[0] || a[1] - b[1];
}

export function rankSearchResults<T>(entries: readonly T[], search: string, label: (entry: T) => string): T[] {
  return [...entries].sort((a, b) => compareSearchMatches(label(a), label(b), search));
}
