import { ItemDefinition } from './item.model';
import { itemDefinition, itemSourceData } from './item-adapter';
import { ContentCache } from './content-cache';
import { ContentRecord, JsonObject } from './content.model';
import { applyItemTemplate } from './item-entry-resolver';
import { resolveItemMetadata } from './item-metadata';

/** Temporary presentation value, never persisted as part of a content record. */
export interface ItemView {
  item: JsonObject;
  baseItem?: JsonObject;
  itemType: string | null;
  properties: { key: string; name: string; entry: unknown; entries: unknown[]; notes?: string[] }[];
  masteries: { key: string; name: string; entry: unknown; entries: unknown[]; notes?: string[] }[];
  page: ItemDefinition['page'] | null;
  ac: number | null;
}
/** Property templates describe this particular item; keep the reusable definition unchanged. */
export function itemRuleEntries(definition: ContentRecord, item: JsonObject): unknown[] {
  const description = Array.isArray(definition.data['entries']) ? definition.data['entries'] : [];
  if (definition.kind !== 'itemProperty' || typeof definition.data['template'] !== 'string') return description;
  const name = definition.name.replace(/-/g, '\u2011');
  try {
    const template = applyItemTemplate(definition.data['template'], item, 'Unspecified', {
      prop_name: name, prop_name_lower: name.toLowerCase(),
    });
    return [template, ...description];
  } catch {
    // An unsupported presentation template must not interrupt rendering the entire catalog.
    return [...description, 'Some details for this property could not be displayed.'];
  }
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
  const metadata = new Map(resolved.map(({ definition }) => [definition.key, definition]));
  const definition = itemDefinition(record);
  const notes = new Map<string, string[]>();
  for (const field of ['property', 'mastery'] as const) {
    for (const reference of definition[field] ?? []) {
      if (typeof reference === 'string' || !reference.note) continue;
      const target = resolveItemMetadata(metadata, field === 'property' ? 'itemProperty' : 'itemMastery', reference, field === 'property' ? 'PHB' : 'XPHB');
      notes.set(target.key, [...notes.get(target.key) ?? [], reference.note]);
    }
  }
  const entries = (role: string) => resolved.filter(link => link.role === role).map(({ definition }) => {
    const values = itemRuleEntries(definition, item);
    const entry = values.length > 1 ? { type: 'entries', entries: values } : values[0] ?? null;
    return { key: definition.key, name: definition.name, entry, entries: values,
      ...(notes.has(definition.key) ? { notes: notes.get(definition.key) } : {}) };
  });
  return { item, baseItem: base?.data, itemType: type?.name ?? null,
    properties: entries('item-property'), masteries: entries('item-mastery'),
    page: definition.page ?? (base ? itemDefinition(base).page : undefined) ?? null, ac: definition.ac ?? (base ? itemDefinition(base).ac : undefined) ?? null };
}
