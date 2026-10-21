import type { BrewSourceByKind } from './generated/brew-source';
import type { ContentRecord, JsonObject } from './content.model';

/** Full pinned entry union, including strings, integer cells and unsupported renderable types. */
export type SourceEntry = NonNullable<BrewSourceByKind['feat']['entries']>[number];
export type SourceEntries = SourceEntry[];

/** Imported trees are deeply validated by the full source validator before staging.
 * Keep that recursive graph at the import boundary instead of bundling a second renderer validator.
 * The outer check also diagnoses malformed historical record payloads.
 */
export function contentEntries(
  record: ContentRecord,
  field: 'entries' | 'entriesHigherLevel' | 'entriesTemplate' = 'entries',
): SourceEntries {
  const value = record.data[field];
  if (value == null) return [];
  if (!Array.isArray(value)) throw new Error(`Invalid ${field}: expected an entry array.`);
  return value as SourceEntries;
}

/** Reference fields can also occur in open metadata, so their values remain untrusted here. */
export interface EntryTreeNode extends JsonObject {
  type: string;
  classFeature?: unknown;
  subclassFeature?: unknown;
  feat?: unknown;
  optionalfeature?: unknown;
}

/** Source entries may carry open metadata. Visit its JSON values as well, preserving
 * existing inline-reference discovery without inventing entry kinds from property names.
 */
export function visitEntryTree(
  value: unknown,
  path: string,
  text: (value: string, path: string) => void,
  node: (value: EntryTreeNode, path: string) => void,
): void {
  if (typeof value === 'string') {
    text(value, path);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((child, position) => visitEntryTree(child, `${path}[${position}]`, text, node));
    return;
  }
  if (value === null || typeof value !== 'object') return;
  // Open metadata is not necessarily an entry; consumers check its exact reference discriminants.
  if ('type' in value && typeof value.type === 'string') node(value as EntryTreeNode, path);
  for (const [field, child] of Object.entries(value)) visitEntryTree(child, `${path}.${field}`, text, node);
}

/** Presentation fields common to ordinary and generated tables; provenance is kept separately. */
export type TablePresentation = Pick<BrewSourceByKind['table'],
  'caption' | 'colLabels' | 'colLabelRows' | 'rowLabels' | 'rows' | 'footnotes' | 'intro' | 'outro'>
  & { tables?: Extract<SourceEntry, { type: 'tableGroup' }>['tables'] };
export const TABLE_PRESENTATION_FIELDS = [
  'caption', 'colLabels', 'colLabelRows', 'rowLabels', 'rows', 'footnotes', 'intro', 'outro', 'tables',
] as const;
export function tablePresentation(record: ContentRecord): TablePresentation {
  if (record.kind !== 'table') throw new Error('Expected an imported table.');
  return record.data as TablePresentation;
}
