import { ContentCache } from './content-cache';
import { ContentRecord, JsonObject } from './content.model';

/** Temporary presentation value, never persisted as part of a content record. */
export interface ItemView {
  item: JsonObject;
  baseItem?: JsonObject;
  itemType: string | null;
  properties: { key: string; name: string; entry: unknown; entries: unknown[] }[];
  masteries: { key: string; name: string; entry: unknown; entries: unknown[] }[];
  page: unknown;
  ac: unknown;
}
export async function resolveItemView(cache: Pick<ContentCache, 'get'>, revisionId: string, record: ContentRecord): Promise<ItemView> {
  if (record.kind !== 'item') throw new Error('Only playable items have an item view.');
  const resolved = await Promise.all(record.links.filter(link => ['base-item', 'item-type', 'item-property', 'item-mastery'].includes(link.role)).map(async link => {
    const definition = await cache.get(revisionId, link.target);
    if (!definition) throw new Error(`Missing ${link.role} definition for ${record.name}. Reimport content.`);
    return { role: link.role, definition };
  }));
  const base = resolved.find(link => link.role === 'base-item')?.definition;
  const type = resolved.find(link => link.role === 'item-type')?.definition;
  const entries = (role: string) => resolved.filter(link => link.role === role).map(({ definition }) => {
    const values = Array.isArray(definition.data['entries']) ? definition.data['entries'] : [];
    return { key: definition.key, name: definition.name, entry: values[0] ?? null, entries: values };
  });
  return { item: record.data, baseItem: base?.data, itemType: type?.name ?? null,
    properties: entries('item-property'), masteries: entries('item-mastery'),
    page: record.data['page'] ?? base?.data['page'] ?? null, ac: record.data['ac'] ?? base?.data['ac'] ?? null };
}
