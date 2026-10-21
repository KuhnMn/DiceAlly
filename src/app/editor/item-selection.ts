import { ContentCache } from '../content/content-cache';
import { ContentRecord, ImportRevision } from '../content/content.model';
import { resolveItemView } from '../content/item-resolver';
import { DisplayItem, InventoryItem } from '../models/character.model';
import { contentReference } from './editor-content-helpers';
import { newEditorId } from './editor-identity';
import { prepareItemAttachedSpells } from './item-attached-spells';

/** Freeze resolved definitions with the character; the viewer never needs the catalog to display an item. */
export async function createInventoryEntry(cache: Pick<ContentCache, 'get'>, record: ContentRecord, revision: ImportRevision): Promise<InventoryItem> {
  const view = structuredClone(await resolveItemView(cache, revision.id, record));
  // The viewer expects a single Entry per property. Preserve all paragraphs in an entries wrapper.
  const definitions = (values: typeof view.properties) => values.map(value => ({ name: value.name,
    ...(value.notes?.length ? { notes: value.notes } : {}),
    entry: { type: 'entries', entries: value.entries } }));
  const entity = { ...view, properties: definitions(view.properties), masteries: definitions(view.masteries) } as unknown as DisplayItem;
  Object.assign(entity, await prepareItemAttachedSpells(cache, record, revision.id));
  return { editorId: newEditorId(), contentReference: contentReference(record, revision), name: record.name,
    source: record.publication, count: 1, allowMultiples: false, isEquipped: false, isAttuned: false,
    entity, uses: [], notes: [] };
}

export function setCustomItemDescription(item: InventoryItem, text: string): void {
  item.entity ??= { item: { name: item.name, source: item.source || 'Custom' } };
  item.entity.item.entries = text.trim() ? text.split(/\n\s*\n/).map(paragraph => ({ text: paragraph })) : [];
}
