import { JsonObject, object, string } from './content.model';
import { challengeRating } from './copy-variables';

function pathParts(path: string): string[] {
  const parts = path.split('.');
  if (parts.some(p => !p || ['__proto__', 'constructor', 'prototype'].includes(p))) throw new Error('Unsafe copy field path.');
  return parts;
}
function parentAt(root: JsonObject, path: string): { parent: JsonObject; field: string } {
  const parts = pathParts(path); const field = parts.pop()!;
  let parent = root;
  for (const part of parts) {
    if (parent[part] === undefined) parent[part] = {};
    const next = object(parent[part]);
    if (!next) throw new Error(`Copy path ${path} does not target an object.`);
    parent = next;
  }
  return { parent, field };
}
const COPY_ENTRY_FIELDS = ['action', 'bonus', 'reaction', 'trait', 'legendary', 'mythic', 'variant', 'spellcasting',
  'actionHeader', 'bonusHeader', 'reactionHeader', 'legendaryHeader', 'mythicHeader'];
function replaceText(value: unknown, expression: RegExp, replacement: string, tagInsensitive: boolean): unknown {
  if (typeof value === 'string') {
    if (tagInsensitive) return value.replace(expression, replacement);
    let output = ''; let plainStart = 0;
    for (let i = 0; i < value.length; i++) {
      if (value[i] !== '{' || value[i + 1] !== '@') continue;
      output += value.slice(plainStart, i).replace(expression, replacement);
      const start = i; let depth = 1;
      for (i++; i < value.length && depth; i++) {
        if (value[i] === '{') depth++;
        else if (value[i] === '}') depth--;
      }
      output += value.slice(start, i); plainStart = i; i--;
    }
    return output + value.slice(plainStart).replace(expression, replacement);
  }
  if (Array.isArray(value)) return value.map(v => replaceText(v, expression, replacement, tagInsensitive));
  if (object(value)) return Object.fromEntries(Object.entries(value as JsonObject).map(([k, v]) => [k, replaceText(v, expression, replacement, tagInsensitive)]));
  return value;
}
function replaceEntries(value: unknown, modifier: JsonObject): unknown {
  if (value === undefined || value === null) return value;
  if (!Array.isArray(value)) throw new Error('Copy text replacement requires an entry array.');
  const flags = [...new Set(`g${string(modifier['flags'])}`)].join('');
  const expression = new RegExp(string(modifier['replace']), flags);
  const replacement = string(modifier['with']);
  const tagInsensitive = modifier['tagInsensitive'] === true;
  const props = modifier['props'] ?? [null, 'entries', 'headerEntries', 'footerEntries'];
  if (!Array.isArray(props) || props.some(p => p !== null && typeof p !== 'string')) throw new Error('Invalid copy text properties.');
  return value.map(entry => {
    if (typeof entry === 'string') return props.includes(null) ? replaceText(entry, expression, replacement, tagInsensitive) : entry;
    const data = object(entry);
    if (!data) return entry;
    const result = { ...data };
    for (const prop of props) if (typeof prop === 'string' && result[prop] !== undefined) {
      pathParts(prop);
      result[prop] = replaceText(result[prop], expression, replacement, tagInsensitive);
    }
    return result;
  });
}
function rootModifier(result: JsonObject, modifier: JsonObject): void {
  const mode = string(modifier['mode']);
  if (mode === 'addSenses') {
    const senses = Array.isArray(result['senses']) ? [...result['senses']] : [];
    const additions = Array.isArray(modifier['senses']) ? modifier['senses'] : [modifier['senses']];
    for (const raw of additions) {
      const sense = object(raw);
      const type = string(sense?.['type']); const range = Number(sense?.['range']);
      if (!type || !Number.isFinite(range) || range < 0) throw new Error('Invalid template sense.');
      const index = senses.findIndex(v => typeof v === 'string' && v.toLowerCase().startsWith(`${type.toLowerCase()} `));
      const existing = index >= 0 ? Number(String(senses[index]).match(/\d+/)?.[0]) : -1;
      if (index < 0) senses.push(`${type} ${range} ft.`);
      else if (existing < range) senses[index] = `${type} ${range} ft.`;
    }
    result['senses'] = senses; return;
  }
  if (mode === 'maxSize') {
    const sizes = ['T', 'S', 'M', 'L', 'H', 'G'];
    const maximum = sizes.indexOf(string(modifier['max']));
    const current = Array.isArray(result['size']) ? result['size'] : [];
    if (maximum < 0 || !current.length || current.some(size => !sizes.includes(String(size)))) throw new Error('Invalid template size.');
    const retained = current.filter(size => sizes.indexOf(String(size)) <= maximum);
    result['size'] = retained.length ? retained : [sizes[maximum]]; return;
  }
  if (mode === 'scalarMultXp') {
    const cr = challengeRating(result);
    const table = [0, 200, 450, 700, 1100, 1800, 2300, 2900, 3900, 5000, 5900, 7200, 8400, 10000, 11500, 13000, 15000, 18000, 20000, 22000, 25000, 33000, 41000, 50000, 62000, 75000, 90000, 105000, 120000, 135000, 155000];
    const details = object(result['cr']);
    const xp = typeof details?.['xp'] === 'number' ? details['xp'] : cr === 0 ? 10 : cr === 0.125 ? 25 : cr === 0.25 ? 50 : cr === 0.5 ? 100 : table[cr];
    const scalar = modifier['scalar'];
    if (typeof xp !== 'number' || typeof scalar !== 'number') throw new Error('Invalid XP scalar operation.');
    const value = xp * scalar;
    result['cr'] = { ...(details ?? { cr: String(result['cr']) }), xp: modifier['floor'] ? Math.floor(value) : value }; return;
  }
  if (mode === 'setProp') {
    const target = parentAt(result, string(modifier['prop']));
    target.parent[target.field] = structuredClone(modifier['value']); return;
  }
  if (mode === 'addSkills') {
    const abilities: Record<string, string> = {
      athletics: 'str', acrobatics: 'dex', 'sleight of hand': 'dex', stealth: 'dex', arcana: 'int', history: 'int', investigation: 'int', nature: 'int', religion: 'int',
      'animal handling': 'wis', insight: 'wis', medicine: 'wis', perception: 'wis', survival: 'wis', deception: 'cha', intimidation: 'cha', performance: 'cha', persuasion: 'cha',
    };
    const rawCr = string(result['cr'], string(object(result['cr'])?.['cr']));
    const fraction = rawCr.split('/').map(Number);
    const cr = fraction.length === 2 ? fraction[0] / fraction[1] : Number(rawCr);
    const skills = { ...object(result['skill']) };
    for (const [skill, multiplier] of Object.entries(object(modifier['skills']) ?? {})) {
      const score = Number(result[abilities[skill]]);
      if (!rawCr || !Number.isFinite(cr) || !Number.isFinite(score) || typeof multiplier !== 'number') throw new Error('Invalid addSkills inputs.');
      const bonus = Math.max(2, Math.ceil(cr / 4) + 1) * multiplier + Math.floor((score - 10) / 2);
      if (skills[skill] === undefined || Number(skills[skill]) < bonus) skills[skill] = bonus >= 0 ? `+${bonus}` : `${bonus}`;
    }
    result['skill'] = skills; return;
  }
  if (!['addSpells', 'replaceSpells', 'removeSpells'].includes(mode)) throw new Error(`Unsupported copy operation _:${mode}.`);
  const blocks = Array.isArray(result['spellcasting']) ? result['spellcasting'].map(object) : [];
  const block = modifier['name'] ? blocks.find(b => b?.['name'] === modifier['name']) : blocks[0];
  if (!block) throw new Error('Copy spell modifier has no matching spellcasting block.');
  const updateList = (old: unknown, changes: unknown, sortAdded = false): unknown[] => {
    const list = Array.isArray(old) ? [...old] : [];
    if (!Array.isArray(changes)) throw new Error('Spell modification must be an array.');
    if (mode === 'addSpells') {
      const added = [...list, ...changes];
      return sortAdded ? added.sort((a, b) => String(a).toLowerCase().localeCompare(String(b).toLowerCase())) : added;
    }
    if (mode === 'removeSpells') return list.filter(v => !changes.includes(v));
    for (const raw of changes) {
      const change = object(raw);
      const index = list.indexOf(change?.['replace']);
      if (!change || index < 0) throw new Error('Replacement spell was not found.');
      const replacements = Array.isArray(change['with']) ? change['with'] : [change['with']];
      list.splice(index, 1, ...replacements);
    }
    return list.sort((a, b) => String(a).toLowerCase().localeCompare(String(b).toLowerCase()));
  };
  for (const [category, changes] of Object.entries(modifier)) {
    if (['mode', 'name'].includes(category)) continue;
    if (['constant', 'will', 'ritual'].includes(category)) { block[category] = updateList(block[category], changes); continue; }
    if (!['spells', 'daily', 'rest', 'restLong', 'weekly', 'monthly', 'yearly', 'recharge', 'legendary', 'charges'].includes(category)) throw new Error(`Unsupported spell category ${category}.`);
    const categories = { ...object(block[category]) };
    for (const [level, change] of Object.entries(object(changes) ?? {})) {
      if (category !== 'spells') categories[level] = updateList(categories[level], change);
      else {
        const previous = object(categories[level]);
        if (mode === 'addSpells') {
          const next = object(change);
          if (!next) throw new Error('Invalid spell level definition.');
          categories[level] = { ...previous, ...next, spells: updateList(previous?.['spells'], next['spells'] ?? [], previous !== undefined) };
        } else if (previous) categories[level] = { ...previous, spells: updateList(previous['spells'], change) };
      }
    }
    block[category] = categories;
  }
}
export function applyCopyModifiers(result: JsonObject, modifications: JsonObject): void {
  const rank = (path: string) => path === '*' ? 1 : path === '_' ? 0 : -1;
  const entries = Object.entries(modifications).sort(([a], [b]) => rank(a) - rank(b));
  for (const [path, operations] of entries) {
    for (const raw of Array.isArray(operations) ? operations : [operations]) {
      if (path === '_' || path === '*') {
        const modifier = object(raw);
        if (path === '_' && modifier) { rootModifier(result, modifier); continue; }
        if (path === '*') {
          for (const field of COPY_ENTRY_FIELDS) applyCopyModifiers(result, { [field]: raw });
          continue;
        }
        throw new Error(`Unsupported copy operation ${path}:${string(modifier?.['mode'])}.`);
      }
      const { parent, field } = parentAt(result, path);
      if (raw === 'remove') { delete parent[field]; continue; }
      const modifier = object(raw);
      if (!modifier) throw new Error(`Unsupported copy operation on ${path}.`);
      const mode = string(modifier['mode']);
      if (['scalarAddProp', 'scalarMultProp', 'prefixSuffixStringProp'].includes(mode)) {
        const target = object(parent[field]);
        if (!target) { if (parent[field] === undefined) continue; throw new Error(`${path} is not an object.`); }
        const property = string(modifier['prop']);
        const properties = property === '*' ? Object.keys(target) : [property];
        for (const prop of properties) {
          pathParts(prop);
          if (target[prop] === undefined) continue;
          if (mode === 'prefixSuffixStringProp') {
            target[prop] = `${string(modifier['prefix'])}${String(target[prop])}${string(modifier['suffix'])}`;
          } else {
            const original = target[prop]; const scalar = modifier['scalar']; const numeric = Number(original);
            if (!Number.isFinite(numeric) || typeof scalar !== 'number') throw new Error(`Invalid numeric template field ${path}.${prop}.`);
            let value = mode === 'scalarAddProp' ? numeric + scalar : numeric * scalar;
            if (modifier['floor']) value = Math.floor(value);
            target[prop] = typeof original === 'string' ? (value >= 0 ? `+${value}` : String(value)) : value;
          }
        }
        continue;
      }
      if (mode === 'scalarAddHit' || mode === 'scalarAddDc') {
        const scalar = modifier['scalar'];
        if (typeof scalar !== 'number') throw new Error('Invalid hit/DC scalar.');
        const transform = (value: unknown): unknown => {
          if (typeof value === 'string') return value.replace(mode === 'scalarAddHit' ? /\{@hit ([+-]?\d+)\}/g : /\{@dc (\d+)(\|[^}]+)?\}/g,
            (_, number: string, suffix = '') => `{@${mode === 'scalarAddHit' ? 'hit' : 'dc'} ${Number(number) + scalar}${mode === 'scalarAddDc' ? suffix : ''}}`);
          if (Array.isArray(value)) return value.map(transform);
          if (object(value)) return Object.fromEntries(Object.entries(value as JsonObject).map(([k, v]) => [k, transform(v)]));
          return value;
        };
        parent[field] = transform(parent[field]); continue;
      }
      if (mode === 'setProp') {
        const target = string(modifier['prop']);
        const destination = target ? parentAt(result, `${path}.${target}`) : { parent, field };
        destination.parent[destination.field] = structuredClone(modifier['value']);
        continue;
      }
      if (mode === 'replaceTxt') {
        if (parent[field] !== undefined) parent[field] = replaceEntries(parent[field], modifier);
        continue;
      }
      const current = parent[field] ?? [];
      if (!Array.isArray(current)) throw new Error(`${path} must be an array for ${mode}.`);
      const items = modifier['items'] === undefined ? [] : structuredClone(Array.isArray(modifier['items']) ? modifier['items'] : [modifier['items']]);
      switch (mode) {
        case 'appendArr': parent[field] = [...current, ...items]; break;
        case 'prependArr': parent[field] = [...items, ...current]; break;
        case 'appendIfNotExistsArr': {
          const seen = new Set(current.map(v => JSON.stringify(v)));
          parent[field] = [...current];
          for (const item of items) if (!seen.has(JSON.stringify(item))) { (parent[field] as unknown[]).push(item); seen.add(JSON.stringify(item)); }
          break;
        }
        case 'insertArr': {
          const index = Number(modifier['index']);
          if (!Number.isInteger(index) || index < -1) throw new Error(`Invalid insert index for ${path}.`);
          const position = index === -1 ? current.length : Math.min(index, current.length);
          parent[field] = [...current.slice(0, position), ...items, ...current.slice(position)]; break;
        }
        case 'removeArr': {
          const rawTargets = modifier['names'] ?? modifier['items'] ?? modifier['name'];
          if (rawTargets === undefined) throw new Error(`No removal targets for ${path}.`);
          const targets = Array.isArray(rawTargets) ? rawTargets : [rawTargets];
          const remaining = [...current];
          for (const target of targets) {
            const index = remaining.findIndex(v => (modifier['items'] !== undefined ? v : object(v)?.['name'] ?? v) === target);
            if (index < 0) { if (!modifier['force']) throw new Error(`Copy removal target not found in ${path}.`); }
            else remaining.splice(index, 1);
          }
          parent[field] = remaining; break;
        }
        case 'replaceArr': {
          const replacement = modifier['replace'];
          const meta = object(replacement);
          const expression = meta?.['regex'] ? new RegExp(string(meta['regex']), string(meta['flags'])) : undefined;
          const index = typeof replacement === 'number' ? replacement : typeof meta?.['index'] === 'number' ? meta['index'] : current.findIndex(v => {
            const name = typeof v === 'string' ? v : string(object(v)?.['name']);
            if (expression) { expression.lastIndex = 0; return expression.test(name); }
            return name === replacement;
          });
          if (!Number.isInteger(index) || index < 0 || index >= current.length) throw new Error(`Copy replacement target not found in ${path}.`);
          parent[field] = [...current.slice(0, index), ...items, ...current.slice(index + 1)]; break;
        }
        default: throw new Error(`Unsupported copy operation ${path}:${mode}.`);
      }
    }
  }
}
