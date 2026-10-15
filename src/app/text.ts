/** Sentence casing for generated display text; preserve the rest of the original spelling. */
export function capitalizeFirst(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
