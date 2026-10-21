import { ItemDefinition } from './item.model';
import { itemDefinition, itemSourceData } from './item-adapter';
import { ContentCache } from './content-cache';
import { ContentRecord, JsonObject } from './content.model';
import { applyItemTemplate } from './item-entry-resolver';

/** Temporary presentation value, never persisted as part of a content record. */
export interface ItemView {
  item: JsonObject;
  baseItem?: JsonObject;
  itemType: string | null;
  properties: { key: string; name: string; entry: unknown; entries: unknown[] }[];
  masteries: { key: string; name: string; entry: unknown; entries: unknown[] }[];
  page: ItemDefinition['page'] | null;
  ac: number | null;
}
/** Property templates describe this particular item; keep the reusable definition unchanged. */
export function itemRuleEntries(definition: ContentRecord, item: JsonObject): unknown[] {
  const description = Array.isArray(definition.data['entries']) ? definition.data['entries'] : [];
  const template = definition.kind === 'itemProperty' && typeof definition.data['template'] === 'string'
    ? applyItemTemplate(definition.data['template'], item, 'Unspecified') : undefined;
  return template === undefined ? description : [template, ...description];
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
  const item = itemSourceData(record);
  const entries = (role: string) => resolved.filter(link => link.role === role).map(({ definition }) => {
    const values = itemRuleEntries(definition, item);
    const entry = values.length > 1 ? { type: 'entries', entries: values } : values[0] ?? null;
    return { key: definition.key, name: definition.name, entry, entries: values };
  });
  const definition = itemDefinition(record);
  return { item, baseItem: base?.data, itemType: type?.name ?? null,
    properties: entries('item-property'), masteries: entries('item-mastery'),
    page: definition.page ?? (base ? itemDefinition(base).page : undefined) ?? null, ac: definition.ac ?? (base ? itemDefinition(base).ac : undefined) ?? null };
}
