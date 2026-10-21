import { ContentLink, ContentRecord, entityKey, JsonObject, object } from './content.model';

const DAMAGE_TYPES = ['acid', 'bludgeoning', 'cold', 'fire', 'force', 'lightning', 'necrotic', 'piercing', 'poison', 'psychic', 'radiant', 'slashing', 'thunder'];

/** Text equivalent of the source's getFullImmRes template function; keep inline markup intact. */
function resistanceText(value: unknown, group = false): string {
  if (!Array.isArray(value)) throw new Error('getFullImmRes requires a resistance array.');
  if (value.length === DAMAGE_TYPES.length && DAMAGE_TYPES.every(type => value.includes(type))) return 'all damage';
  const simple = (entry: unknown) => typeof entry === 'string' || typeof object(entry)?.['special'] === 'string';
  return value.map((entry, index) => {
    const data = object(entry);
    const text = typeof entry === 'string' ? entry : typeof data?.['special'] === 'string' ? data['special']
      : data && Array.isArray(data['resist']) ? [data['preNote'], resistanceText(data['resist'], true), data['note']].filter(Boolean).join(' ')
        : undefined;
    if (text === undefined) throw new Error('Invalid getFullImmRes resistance entry.');
    if (index === value.length - 1) return text;
    if (!simple(entry) || !simple(value[index + 1])) return `${text}; `;
    if (group && index === value.length - 2) return `${text}${value.length === 2 ? ' and ' : ', and '}`;
    return `${text}, `;
  }).join('');
}

function applyTemplate(text: string, item: JsonObject): string {
  return text.replace(/\{\{([^}]+)\}\}/g, (_match, expression: string) => {
    const args = expression.trim().split(/\s+/);
    const path = args.at(-1)!.split('.');
    if (path.shift() !== 'item' || !path.length) throw new Error(`Invalid item template path: ${expression}`);
    let value: unknown = item;
    for (const key of path) {
      const data = object(value);
      value = data && Object.hasOwn(data, key) ? data[key] : undefined;
    }
    if (value === undefined || value === null) throw new Error(`Unresolved item template property: ${expression}`);
    if (args.length === 2 && args[0] === 'getFullImmRes') return resistanceText(value);
    if (args.length !== 1) throw new Error(`Unsupported item template function: ${expression}`);
    if (typeof value === 'object' && (!Array.isArray(value) || value.some(entry => typeof entry === 'object'))) {
      throw new Error(`Item template property requires a formatter: ${expression}`);
    }
    return String(value);
  });
}

/** Expand explicit itemEntry references in entry arrays using the fully materialized item's fields. */
export function resolveItemEntries(item: JsonObject, templates: ReadonlyMap<string, ContentRecord>): { entries: unknown[]; links: ContentLink[] } {
  const links = new Map<string, ContentLink>();
  let expansions = 0;
  const walk = (value: unknown, ancestors: ReadonlySet<string>, template: boolean): unknown => {
    if (Array.isArray(value)) return value.flatMap(entry => {
      const match = typeof entry === 'string' ? /^\{#itemEntry ([^}]+)\}$/.exec(entry) : null;
      if (!match) return [walk(entry, ancestors, template)];
      const [name, source = 'DMG'] = match[1].split('|').map(part => part.trim());
      const key = entityKey('itemEntry', { name, source });
      if (ancestors.has(key)) throw new Error(`Cyclic itemEntry reference: ${match[1]}`);
      if (++expansions > 1000) throw new Error('Item entry expansion exceeds the 1,000-reference limit.');
      const definition = templates.get(key);
      if (!definition || !Array.isArray(definition.data['entriesTemplate'])) throw new Error(`Missing itemEntry definition: ${match[1]}`);
      links.set(key, { role: 'item-entry', target: key, scope: 'provenance' });
      return walk(definition.data['entriesTemplate'], new Set([...ancestors, key]), true) as unknown[];
    });
    if (typeof value === 'string') {
      if (value.includes('{#itemEntry ')) throw new Error('itemEntry references must occupy an entire entry-array element.');
      return template ? applyTemplate(value, item) : value;
    }
    if (object(value)) return Object.fromEntries(Object.entries(value as JsonObject).map(([key, child]) => [key, walk(child, ancestors, template)]));
    return value;
  };
  return { entries: walk(item['entries'] ?? [], new Set(), false) as unknown[], links: [...links.values()] };
}
