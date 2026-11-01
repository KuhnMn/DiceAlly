const WEAPON_TYPES: Readonly<Record<string, string>> = {
  'simple weapon': 'Simple Weapons',
  'martial weapon': 'Martial Weapons',
  'melee weapon': 'Melee Weapons',
  'ranged weapon': 'Ranged Weapons',
};

/** Describe positive type/property filters without discarding unsupported conditions. */
export function weaponProficiencyFilterLabel(filter: string): string | undefined {
  const fields = new Map<string, string>();
  for (const clause of filter.split('|')) {
    const match = /^\s*(type|property)\s*=\s*([^=]+?)\s*$/i.exec(clause);
    if (!match || fields.has(match[1].toLowerCase())) return;
    fields.set(match[1].toLowerCase(), match[2].toLowerCase());
  }
  const type = fields.get('type');
  const weapons = type ? (Object.hasOwn(WEAPON_TYPES, type) ? WEAPON_TYPES[type] : undefined) : 'Weapons';
  if (!weapons) return;
  const property = fields.get('property');
  if (!property) return weapons;
  const properties = property.split(';').map(value => value.trim());
  if (properties.some(value => !/^[a-z]+(?:[ -][a-z]+)*$/.test(value))) return;
  const names = properties.map(value => value.replace(/\b[a-z]/g, letter => letter.toUpperCase()));
  const alternatives = names.length > 2
    ? `${names.slice(0, -1).join(', ')}, or ${names.at(-1)}`
    : names.join(' or ');
  return `${weapons} with the ${alternatives} Property`;
}

/** Older wizard versions stored the filter itself in custom proficiency descriptions. */
export function proficiencyLabel(value: string): string {
  const prefix = 'All weapons matching ';
  return value.startsWith(prefix)
    ? weaponProficiencyFilterLabel(value.slice(prefix.length)) ?? value
    : value;
}
