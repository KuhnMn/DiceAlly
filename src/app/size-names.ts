/** Size codes defined by the imported schema, including its extended sizes. */
export const SIZE_NAMES = {
  F: 'Fine', D: 'Diminutive', T: 'Tiny', S: 'Small', M: 'Medium',
  L: 'Large', H: 'Huge', G: 'Gargantuan', C: 'Colossal', V: 'Varies',
} as const;

export type SizeAbbreviation = keyof typeof SIZE_NAMES;

/** Already expanded names and custom sizes remain readable as provided. */
export function sizeName(size: string): string {
  return Object.hasOwn(SIZE_NAMES, size) ? SIZE_NAMES[size as SizeAbbreviation] : size;
}

export function formatSizeNames(sizes: readonly string[] | null | undefined): string {
  return sizes?.map(sizeName).join(', ') ?? '';
}
