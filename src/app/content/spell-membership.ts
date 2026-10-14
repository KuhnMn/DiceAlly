import { JsonObject, object, normalize } from './content.model';

export interface SpellClassMembership { name: string; source: string; }

function uniqueClasses(values: unknown[]): SpellClassMembership[] {
  const result = new Map<string, SpellClassMembership>();
  for (const value of values) {
    const entry = object(value);
    if (typeof entry?.['name'] !== 'string' || !entry['name'].trim()) continue;
    const name = entry['name'];
    const source = typeof entry['source'] === 'string' ? entry['source'] : '';
    result.set(JSON.stringify([normalize(name), normalize(source)]), { name, source });
  }
  return [...result.values()];
}

function classesIn(value: unknown, fields: string[]): SpellClassMembership[] {
  if (Array.isArray(value)) return fields.includes('fromClassList') ? uniqueClasses(value) : [];
  const membership = object(value);
  return uniqueClasses(fields.flatMap(field => Array.isArray(membership?.[field]) ? membership[field] as unknown[] : []));
}

/** Accept sources.json, inline spell definitions and the flat Android export format. */
export function spellClassMemberships(value: unknown): SpellClassMembership[] {
  return classesIn(value, ['class', 'classVariant', 'fromClassList', 'fromClassListVariant']);
}

/** Keep inline memberships and overlay memberships; preserve subclass metadata too. */
export function mergeSpellMemberships(inline: unknown, overlay: unknown): JsonObject {
  const core = ['class', 'fromClassList'];
  const variant = ['classVariant', 'fromClassListVariant'];
  const metadata = { ...object(inline), ...object(overlay) };
  // Store one canonical shape; the external sources.json aliases are only import inputs.
  delete metadata['class'];
  delete metadata['classVariant'];
  return {
    ...metadata,
    fromClassList: uniqueClasses([...classesIn(inline, core), ...classesIn(overlay, core)]),
    fromClassListVariant: uniqueClasses([...classesIn(inline, variant), ...classesIn(overlay, variant)]),
  };
}
