import type { ExportedCharacter } from './character.model';

export const OPTIONAL_SHEET_PAGES = [
  { id: 7, key: 'combat', label: 'Combat' },
  { id: 3, key: 'spells', label: 'Spells' },
  { id: 4, key: 'inventory', label: 'Inventory' },
  { id: 5, key: 'companions', label: 'Companions' },
  { id: 8, key: 'bastions', label: 'Bastions' },
  { id: 6, key: 'notes', label: 'Notes' },
] as const;

export type OptionalSheetPage = typeof OPTIONAL_SHEET_PAGES[number]['key'];
export interface SheetSettings {
  visiblePages?: Partial<Record<OptionalSheetPage, boolean>>;
}

export const SHEET_PAGES = [
  { id: 1, label: 'Sheet' }, OPTIONAL_SHEET_PAGES[0], { id: 2, label: 'Features' },
  ...OPTIONAL_SHEET_PAGES.slice(1),
];

/** Missing settings preserve every tab on existing characters. */
export function isSheetPageVisible(sheet: ExportedCharacter | null | undefined, id: number): boolean {
  const page = OPTIONAL_SHEET_PAGES.find(page => page.id === id);
  return !page || sheet?.sheetSettings?.visiblePages?.[page.key] !== false;
}

export function sheetPageForAnchor(anchor: string): number {
  if (anchor.startsWith('spell-')) return 3;
  if (anchor.startsWith('item-')) return 4;
  if (anchor.startsWith('monster-') || anchor.startsWith('object-')) return 5;
  return 2;
}
