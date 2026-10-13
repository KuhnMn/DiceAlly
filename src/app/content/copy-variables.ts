import { JsonObject, object, string } from './content.model';

export function challengeRating(data: JsonObject): number {
  const raw = data['cr'];
  const text = typeof raw === 'number' ? String(raw) : string(raw, string(object(raw)?.['cr']));
  const parts = text.split('/').map(Number);
  const value = parts.length === 2 ? parts[0] / parts[1] : Number(text);
  if (!text || !Number.isFinite(value) || value < 0 || value > 30) throw new Error('Missing or invalid challenge rating.');
  return value;
}
export function proficiency(data: JsonObject): number {
  return Math.max(2, Math.ceil(challengeRating(data) / 4) + 1);
}
function abilityModifier(data: JsonObject, ability: string): number {
  if (!['str', 'dex', 'con', 'int', 'wis', 'cha'].includes(ability) || typeof data[ability] !== 'number') {
    throw new Error(`Missing or invalid ability for copy variable: ${ability}`);
  }
  return Math.floor((Number(data[ability]) - 10) / 2);
}
function shortName(data: JsonObject, title: boolean): string {
  const named = data['isNamedCreature'] === true;
  const name = string(data['name']);
  const explicit = data['shortName'];
  let label: string;
  if (explicit === true) label = name;
  else if (typeof explicit === 'string') label = named && title
    ? explicit.replace(/\b\p{L}/gu, value => value.toUpperCase()) : explicit.toLowerCase();
  else {
    label = name.split(',')[0].replace(/(?:adult|ancient|young) \w+ (dragon|dracolich)/gi, '$1');
    label = named ? label.split(' ')[0] : label.toLowerCase();
  }
  return `${named ? '' : title ? 'The ' : 'the '}${label}`;
}
/** Small arithmetic parser: content expressions are data, never executable JavaScript. */
export function arithmetic(expression: string): number {
  const tokens = expression.match(/\d+(?:\.\d+)?|[()+*/-]/g) ?? [];
  if (tokens.join('') !== expression.replace(/\s/g, '')) throw new Error('Unsupported copy arithmetic expression.');
  let index = 0;
  const atom = (): number => {
    const token = tokens[index++];
    if (token === '+' || token === '-') return (token === '-' ? -1 : 1) * atom();
    if (token === '(') {
      const value = sum();
      if (tokens[index++] !== ')') throw new Error('Unclosed copy arithmetic expression.');
      return value;
    }
    if (!token || !/^\d/.test(token)) throw new Error('Invalid copy arithmetic operand.');
    return Number(token);
  };
  const product = (): number => {
    let value = atom();
    while (tokens[index] === '*' || tokens[index] === '/') {
      const op = tokens[index++]; const next = atom();
      value = op === '*' ? value * next : value / next;
    }
    return value;
  };
  const sum = (): number => {
    let value = product();
    while (tokens[index] === '+' || tokens[index] === '-') {
      const op = tokens[index++]; const next = product(); value = op === '+' ? value + next : value - next;
    }
    return value;
  };
  const result = sum();
  if (index !== tokens.length || !Number.isFinite(result)) throw new Error('Invalid copy arithmetic result.');
  return result;
}
export function resolveCopyVariables(value: unknown, data: JsonObject): unknown {
  if (Array.isArray(value)) return value.map(v => resolveCopyVariables(v, data));
  if (object(value)) return Object.fromEntries(Object.entries(value as JsonObject).map(([k, v]) => [k, resolveCopyVariables(v, data)]));
  if (typeof value !== 'string') return value;
  return value.replace(/<\$([^$]+)\$>/g, (_, token: string) => {
    const [mode, detail = ''] = token.split('__');
    const size = Array.isArray(data['size']) ? data['size'][0] : 'M';
    const sizeMultiplier = size === 'L' ? 2 : size === 'H' ? 3 : size === 'G' ? 4 : 1;
    switch (mode) {
      case 'name': return string(data['name']);
      case 'short_name': return shortName(data, false);
      case 'title_short_name': return shortName(data, true);
      case 'dc': case 'spell_dc': return String(8 + abilityModifier(data, detail) + proficiency(data));
      case 'to_hit': { const total = abilityModifier(data, detail) + proficiency(data); return total >= 0 ? `+${total}` : String(total); }
      case 'damage_mod': { const total = abilityModifier(data, detail); return total === 0 ? '' : total > 0 ? ` + ${total}` : ` - ${-total}`; }
      case 'size_mult': return String(detail ? Math.floor(sizeMultiplier * arithmetic(detail)) : sizeMultiplier);
      case 'damage_avg': {
        const expression = detail.replace(/\b(str|dex|con|int|wis|cha)\b/gi, ability => String(abilityModifier(data, ability.toLowerCase())))
          .replace(/\bsize_mult\b/g, String(sizeMultiplier));
        return String(Math.floor(arithmetic(expression)));
      }
      default: throw new Error(`Unsupported copy variable: ${mode}`);
    }
  });
}
