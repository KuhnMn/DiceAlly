import path from 'node:path';

/**
 * Emit structural TS types without dereferencing recursive schema graphs.
 * Runtime validators enforce constraints TS cannot express (integer/range/regex,
 * conditional requiredness, uniqueness, and exact oneOf membership).
 */
export function generateSourceTypes(schemas, kindSchemas, name) {
  const definitions = new Map();
  const names = new Map();
  const refType = (file, pointer = '') => {
    const identity = `${file}#${pointer}`;
    if (names.has(identity)) return names.get(identity);
    const alias = `S${names.size}_${file.replace(/\.json$/, '').replaceAll(/[^a-zA-Z0-9]/g, '_')}_${pointer.split('/').at(-1)?.replaceAll(/[^a-zA-Z0-9]/g, '_') || 'root'}`;
    names.set(identity, alias);
    definitions.set(alias, ''); // Register before recursing: refs may point back here.
    let schema = schemas.get(file);
    if (schema === undefined) throw new Error(`Missing type schema: ${file}`);
    for (const token of pointer.split('/').slice(1)) schema = schema?.[decodeURIComponent(token).replaceAll('~1', '/').replaceAll('~0', '~')];
    if (schema === undefined) throw new Error(`Missing type schema pointer: ${identity}`);
    definitions.set(alias, render(schema, file));
    return alias;
  };
  const literal = value => {
    if (value === null) return 'null';
    if (Array.isArray(value)) return `[${value.map(literal).join(', ')}]`;
    if (typeof value === 'object') return `{ ${Object.entries(value).map(([k, v]) => `${JSON.stringify(k)}: ${literal(v)}`).join('; ')} }`;
    return JSON.stringify(value);
  };
  const render = (schema, file) => {
    if (schema === true) return 'unknown';
    if (schema === false) return 'never';
    if (!schema || typeof schema !== 'object') throw new Error(`Invalid schema in ${file}`);
    const clauses = [];
    if (schema.$ref) {
      const [target, pointer = ''] = schema.$ref.split('#');
      const resolved = !target ? file : /^https:/.test(target) ? target
        : /^https:/.test(file) ? new URL(target, file).href
        : path.posix.normalize(path.posix.join(path.posix.dirname(file), target));
      clauses.push(refType(resolved, pointer));
    }
    if (Object.hasOwn(schema, 'const')) clauses.push(literal(schema.const));
    else if (schema.enum) clauses.push(`(${schema.enum.map(literal).join(' | ') || 'never'})`);
    for (const key of ['anyOf', 'oneOf', 'allOf']) if (schema[key]) {
      clauses.push(`(${schema[key].map(s => render(s, file)).join(key === 'allOf' ? ' & ' : ' | ')})`);
    }
    if (Array.isArray(schema.type)) {
      clauses.push(`(${schema.type.map(type => render({ ...schema, type, anyOf: undefined, oneOf: undefined, allOf: undefined, $ref: undefined, enum: undefined }, file)).join(' | ')})`);
    } else if (schema.type === 'object' || schema.properties || schema.patternProperties || schema.additionalProperties !== undefined) {
      const properties = Object.entries(schema.properties ?? {});
      const required = new Set(schema.required ?? []);
      const fields = properties.map(([key, value]) => `${JSON.stringify(key)}${required.has(key) ? '' : '?'}: ${render(value, file)};`);
      // Regex key domains cannot be expressed in TS. Preserve their value types
      // for pure maps; named fields retain precise types in mixed open objects.
      const patterns = Object.values(schema.patternProperties ?? {});
      if (schema.additionalProperties !== false || patterns.length) {
        const values = properties.length || schema.additionalProperties === undefined || schema.additionalProperties === true
          ? 'unknown' : [...patterns, ...(schema.additionalProperties === false ? [] : [schema.additionalProperties])].map(s => render(s, file)).join(' | ') || 'never';
        fields.push(`[key: string]: ${values};`);
      }
      clauses.push(`{ ${fields.join(' ')} }`);
    } else if (schema.type === 'array') {
      if (schema.prefixItems) {
        const minimum = schema.minItems ?? 0;
        const entries = schema.prefixItems.map((s, i) => `${render(s, file)}${i >= minimum ? '?' : ''}`);
        if (schema.items !== false) entries.push(`...(${render(schema.items ?? true, file)})[]`);
        clauses.push(`[${entries.join(', ')}]`);
      } else clauses.push(`(${render(schema.items ?? true, file)})[]`);
    } else if (schema.type) {
      const primitive = { string: 'string', number: 'number', integer: 'number', boolean: 'boolean', null: 'null' }[schema.type];
      if (!primitive) throw new Error(`Unsupported schema type ${schema.type} in ${file}`);
      clauses.push(primitive);
    }
    return clauses.length ? clauses.join(' & ') : 'unknown';
  };
  const kinds = Object.entries(kindSchemas).map(([kind, file]) => `  ${JSON.stringify(kind)}: ${refType(file, `/properties/${kind}/items`)};`);
  return `/* Generated from the pinned 5etools schemas. Do not edit.\n * Structural types only; runtime validators enforce all schema constraints. */\nexport interface ${name} {\n${kinds.join('\n')}\n}\n\n${[...definitions].map(([alias, type]) => `export type ${alias} = ${type};`).join('\n\n')}\n`;
}
