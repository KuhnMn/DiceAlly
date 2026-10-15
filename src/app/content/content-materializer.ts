import { ContentCache } from './content-cache';
import { ContentLink, ContentRecord, entityKey, ImportDiagnostic, JsonObject, normalize, object, string } from './content.model';
import { arithmetic } from './copy-variables';

const MATERIALIZER_VERSION = 1;
export const MAX_GENERATED_VARIANTS = 50_000;
function array(value: unknown): unknown[] { return Array.isArray(value) ? value : []; }
function uid(value: unknown): string { return string(value, string(object(value)?.['uid'])); }
function unique(values: unknown[]): unknown[] {
  const keys = new Set<string>();
  return values.filter(v => { const key = JSON.stringify(v); if (keys.has(key)) return false; keys.add(key); return true; });
}
function derived(input: ContentRecord, kind: string, key: string, data: JsonObject,
  operation: NonNullable<ContentRecord['derivation']>['operation'], inputs: ContentLink[]): ContentRecord {
  return { key, kind, name: string(data['name']), publication: string(data['source']), file: input.file,
    data, links: inputs, derivation: { operation, inputs, version: MATERIALIZER_VERSION } };
}

/** Android-compatible numeric/conditional movement, without losing extra upstream movement metadata. */
export function normalizeSpecies(data: JsonObject): JsonObject {
  const result = structuredClone(data);
  if (typeof result['speed'] === 'number') result['speed'] = { walk: { number: result['speed'] } };
  else if (object(result['speed'])) {
    const speed = result['speed'] as JsonObject;
    const normalized: JsonObject = { ...speed };
    for (const mode of ['walk', 'climb', 'swim', 'fly', 'burrow']) {
      const value = speed[mode];
      if (typeof value === 'number') normalized[mode] = { number: value };
      else if (value === true) {
        const walk = typeof speed['walk'] === 'number' ? speed['walk'] : object(speed['walk'])?.['number'];
        if (typeof walk !== 'number') throw new Error(`Cannot resolve ${mode} speed without numeric walk speed.`);
        normalized[mode] = { number: walk };
      }
    }
    result['speed'] = normalized;
  }
  if (Array.isArray(result['resist'])) result['resist'] = result['resist'].map(v => typeof v === 'string' ? { type: v } : v);
  return result;
}

export function mergeSubrace(base: JsonObject, child: JsonObject): JsonObject {
  const result = { ...structuredClone(base), ...structuredClone(child) };
  const label = string(child['name'], 'Variant');
  result['name'] = label ? `${label} ${string(base['name'])}` : string(base['name']);
  result['source'] = child['source'];
  result['page'] = child['page'] ?? base['page'];
  for (const field of ['speed', 'darkvision', 'resist', 'size']) result[field] = child[field] ?? structuredClone(base[field]);
  for (const field of ['creatureTypes', 'creatureTypeTags', 'sizeEntry']) result[field] = structuredClone(base[field]);
  const entries = structuredClone(array(base['entries']));
  for (const entry of array(child['entries'])) {
    const overwrite = string(object(object(entry)?.['data'])?.['overwrite']);
    const index = overwrite ? entries.findIndex(v => normalize(string(object(v)?.['name'])) === normalize(overwrite)) : -1;
    if (index >= 0) entries[index] = structuredClone(entry);
    else entries.push(structuredClone(entry)); // Preserve unmatched entries instead of Android's silent omission.
  }
  result['entries'] = entries;
  const overwrite = object(child['overwrite']);
  if (Array.isArray(child['ability'])) {
    const abilities = child['ability'];
    const parents = overwrite?.['ability'] || !Array.isArray(base['ability']) ? abilities.map(() => ({})) : base['ability'];
    if (parents.length !== abilities.length) throw new Error('Base/subrace ability options have different lengths.');
    result['ability'] = abilities.map((value, index) => ({ ...object(parents[index]), ...object(value) }));
  }
  for (const field of ['traitTags', 'languageProficiencies']) {
    if (child[field] !== undefined && !overwrite?.[field]) result[field] = unique([...array(base[field]), ...array(child[field])]);
  }
  if (Array.isArray(child['skillProficiencies']) && Array.isArray(base['skillProficiencies']) && !overwrite?.['skillProficiencies']) {
    if (child['skillProficiencies'].length !== 1 || base['skillProficiencies'].length !== 1) throw new Error('Ambiguous base/subrace skill choices.');
    const parent = object(base['skillProficiencies'][0]); const sub = object(child['skillProficiencies'][0]);
    if (parent?.['choose'] && sub?.['choose']) throw new Error('Independent base/subrace skill choices require a rule handler.');
    result['skillProficiencies'] = [{ ...parent, ...sub }];
  }
  // Child publication flags must not inherit licensing/reprint metadata from a different book.
  for (const field of ['srd', 'srd52', 'basicRules', 'basicRules2024', '_versions', 'hasFluff', 'hasFluffImages', 'reprintedAs']) {
    if (!Object.hasOwn(child, field)) delete result[field];
  }
  // Explicit removals must survive fallback/merge handling above.
  for (const [field, value] of Object.entries(child)) if (value === null) delete result[field];
  return normalizeSpecies(result);
}

function matchesValue(candidate: unknown, requirement: unknown, every: boolean): boolean {
  if (Array.isArray(requirement)) return array(candidate).length
    ? array(candidate).some(v => requirement.includes(v)) : requirement.includes(candidate);
  const nested = object(requirement);
  if (nested) return matchesRequirement(object(candidate), nested, every);
  if (Array.isArray(candidate)) return candidate.includes(requirement);
  return typeof candidate === 'string' && typeof requirement === 'string'
    ? normalize(candidate) === normalize(requirement) : candidate === requirement;
}
function matchesRequirement(candidate: JsonObject | undefined, requirement: JsonObject, every: boolean): boolean {
  if (!candidate) return false;
  const entries = Object.entries(requirement);
  if (!entries.length) return every;
  const checks = entries.map(([field, value]) => matchesValue(candidate[field], value, every));
  return every ? checks.every(Boolean) : checks.some(Boolean);
}
export function variantMatches(base: JsonObject, variant: JsonObject): boolean {
  if (!Array.isArray(variant['requires'])) throw new Error('Magic variant requires must be an array.');
  const required = variant['requires'].some(value => {
    const requirement = object(value);
    if (!requirement) throw new Error('Invalid variant requirement.');
    return matchesRequirement(base, requirement, true);
  });
  const excludes = object(variant['excludes']);
  return required && (!excludes || !matchesRequirement(base, excludes, false));
}

function inject(value: unknown, properties: JsonObject): unknown {
  if (typeof value === 'string') return value.replace(/\{=([^}]+)\}/g, (_, expression: string) => {
    const [field, format] = expression.split('/');
    const replacement = properties[field];
    if (replacement === undefined || replacement === null) throw new Error(`Unresolved variant entry property: ${field}`);
    let text = String(replacement);
    for (const modifier of format ?? '') {
      if (modifier === 'l') text = text.toLowerCase();
      else if (modifier === 'u') text = text.toUpperCase();
      else if (modifier === 't') text = text.replace(/\b\p{L}/gu, c => c.toUpperCase());
      else if (modifier === 'a') text = /^[aeiou]/i.test(text) ? 'an' : 'a';
      else if (['r', 'f', 'c'].includes(modifier)) {
        const value = Number(text);
        if (!Number.isFinite(value)) throw new Error('Invalid numeric entry formatting.');
        text = String(modifier === 'r' ? Math.round(value) : modifier === 'f' ? Math.floor(value) : Math.ceil(value));
      } else throw new Error(`Unsupported variant entry format: ${modifier}`);
    }
    return text;
  });
  if (Array.isArray(value)) return value.map(v => inject(v, properties));
  if (object(value)) return Object.fromEntries(Object.entries(value as JsonObject).map(([k, v]) => [k, inject(v, properties)]));
  return value;
}
export function generateVariant(base: ContentRecord, variant: ContentRecord, warn?: (message: string) => void): ContentRecord {
  const inherits = object(variant.data['inherits']);
  if (!inherits || !string(inherits['source'])) throw new Error('Magic variant has no inherited publication.');
  const data = { ...structuredClone(base.data), ...structuredClone(inherits) };
  let name = string(base.data['name']);
  if (typeof inherits['nameRemove'] === 'string') name = name.split(inherits['nameRemove']).join('');
  data['name'] = `${string(inherits['namePrefix'])}${name}${string(inherits['nameSuffix'])}`;
  // Retain Android's composite publication for existing export/import interoperability.
  data['source'] = `${string(inherits['source'])}:${base.publication}`;
  data['baseItem'] = `${base.name}|${base.publication}`;
  data['variantSource'] = inherits['source'];
  data['page'] = inherits['page'];
  const damageTypes: Record<string, string> = { A: 'acid', B: 'bludgeoning', C: 'cold', F: 'fire', O: 'force', L: 'lightning', N: 'necrotic', P: 'piercing', I: 'poison', Y: 'psychic', R: 'radiant', S: 'slashing', T: 'thunder' };
  const properties = { ...inherits, baseName: base.name, dmgType: damageTypes[string(base.data['dmgType'])] ?? base.data['dmgType'] };
  data['entries'] = [...structuredClone(array(base.data['entries'])), ...array(inject(inherits['entries'], properties))];
  for (const field of ['vulnerable', 'resist', 'immune']) {
    if (inherits[field] === null) { delete data[field]; continue; }
    const assignedElsewhere = ['vulnerable', 'resist', 'immune'].filter(f => f !== field).flatMap(f => array(inherits[f]));
    data[field] = unique([...array(base.data[field]).filter(v => !assignedElsewhere.includes(v)), ...array(inherits[field])]);
  }
  if (inherits['conditionImmune'] !== null) data['conditionImmune'] = unique([...array(base.data['conditionImmune']), ...array(inherits['conditionImmune'])]);
  for (const field of ['property', 'mastery']) {
    const removed = array(inherits[`${field}Remove`]).map(uid);
    data[field] = unique([...array(data[field]).filter(v => !removed.includes(uid(v))), ...array(inherits[`${field}Add`])]);
  }
  const pendingExpressions = new Set<string>();
  for (const field of ['weight', 'value']) {
    if (inherits[`${field}Mult`] !== undefined) {
      if (typeof base.data[field] !== 'number' || typeof inherits[`${field}Mult`] !== 'number') throw new Error(`Invalid ${field} multiplier.`);
      data[field] = Number(base.data[field]) * Number(inherits[`${field}Mult`]);
    }
    if (typeof inherits[`${field}Expression`] === 'string') {
      let missing = false;
      const expression = (inherits[`${field}Expression`] as string).replace(/\[\[([^\]]+)\]\]/g, (_, path: string) => {
        const parts = path.split('.');
        const root = parts[0] === 'baseItem' ? base.data : data;
        const fields = ['baseItem', 'item'].includes(parts[0]) ? parts.slice(1) : parts;
        let value: unknown = root;
        for (const part of fields) value = object(value)?.[part];
        if (value === undefined || value === null) { missing = true; return '0'; }
        if (typeof value !== 'number') throw new Error(`Invalid numeric variant property: ${path}`);
        return String(value);
      });
      if (missing) {
        delete data[field]; pendingExpressions.add(`${field}Expression`);
        warn?.(`${string(data['name'])}: ${field} is unknown because the base definition has no numeric value; expression retained.`);
      } else data[field] = arithmetic(expression);
    }
  }
  if (inherits['barding']) data['bardingType'] = base.data['type'];
  for (const field of ['srd', 'srd52', 'basicRules', 'basicRules2024', 'reprintedAs', 'otherSources', 'hasFluff', 'hasFluffImages']) {
    if (!Object.hasOwn(inherits, field)) delete data[field];
  }
  for (const [field, value] of Object.entries(inherits)) if (value === null) delete data[field];
  for (const field of ['namePrefix', 'nameSuffix', 'nameRemove', 'propertyAdd', 'propertyRemove', 'masteryAdd', 'masteryRemove', 'weightExpression', 'valueExpression', 'weightMult', 'valueMult']) {
    if (!pendingExpressions.has(field)) delete data[field];
  }
  const generated = derived(variant, 'item', JSON.stringify(['generated-item', base.key, variant.key, MATERIALIZER_VERSION]), data,
    'magicvariant', [{ role: 'base-item', target: base.key }, { role: 'magic-variant', target: variant.key }]);
  // A core recipe applied to a homebrew weapon still depends on that homebrew file.
  // Keep its origin so missing external definitions receive the same treatment as the base item.
  if (base.file.startsWith('homebrew/') && !variant.file.startsWith('homebrew/')) generated.file = base.file;
  return generated;
}

export async function materializeContent(cache: ContentCache, revisionId: string, diagnostics: ImportDiagnostic[], signal?: AbortSignal,
  progress?: (processed: number, added: number, file: string) => void,
  shouldProcess: (record: ContentRecord) => boolean = () => true): Promise<{ added: number }> {
  let added = 0, processed = 0;
  const bases: ContentRecord[] = [];
  const metadata = new Map<string, ContentRecord>();
  const reportError = (record: ContentRecord, error: unknown) => {
    signal?.throwIfAborted(); diagnostics.push({ severity: 'error', file: record.file, record: record.key, message: String(error) });
  };
  const add = async (record: ContentRecord) => {
    if (await cache.get(revisionId, record.key)) throw new Error(`Generated identity collision: ${record.name}`);
    await cache.put(revisionId, [record]); added++;
  };
  // Small reusable metadata/base-item indexes only; the monster/spell corpus stays in IndexedDB.
  await cache.visit(revisionId, async record => {
    signal?.throwIfAborted();
    if (record.kind === 'baseitem') bases.push(record);
    if (['itemType', 'itemProperty', 'itemMastery'].includes(record.kind)) metadata.set(record.key, record);
  });
  await cache.visit(revisionId, async record => {
    signal?.throwIfAborted();
    if (!shouldProcess(record)) return;
    try {
      if (record.kind === 'race') await add(derived(record, 'species', JSON.stringify(['species', record.key]), normalizeSpecies(record.data),
        'species', [{ role: 'species-definition', target: record.key }]));
      if (record.kind === 'subrace') {
        const key = entityKey('race', { name: record.data['raceName'], source: record.data['raceSource'] });
        const parent = await cache.get(revisionId, key);
        if (!parent) throw new Error(`Subrace parent not found: ${key}`);
        await add(derived(record, 'species', JSON.stringify(['species', record.key]), mergeSubrace(parent.data, record.data),
          'subrace', [{ role: 'parent-species', target: key }, { role: 'subrace-definition', target: record.key }]));
      }
      if (record.kind === 'baseitem' || record.kind === 'itemGroup') {
        const key = record.kind === 'baseitem' ? entityKey('item', record.data) : JSON.stringify(['item-group', record.key]);
        const existing = await cache.get(revisionId, key);
        if (!existing) await add(derived(record, 'item', key, structuredClone(record.data), record.kind === 'baseitem' ? 'base-item' : 'item-group',
          [{ role: record.kind === 'baseitem' ? 'base-item' : 'item-group-definition', target: record.key }]));
        else if (record.kind === 'baseitem') {
          await cache.put(revisionId, [{ ...existing, derivation: { operation: 'base-item', version: MATERIALIZER_VERSION, inputs: [{ role: 'base-item', target: record.key }] } }]);
        }
      }
    } catch (error) { reportError(record, error); }
    if (++processed % 128 === 0) progress?.(processed, added, record.file);
  });
  let generated = 0;
  await cache.visit(revisionId, async record => {
    signal?.throwIfAborted();
    if (record.kind !== 'magicvariant') return;
    try {
      const batch: ContentRecord[] = [];
      for (const base of bases) {
        signal?.throwIfAborted();
        if (!variantMatches(base.data, record.data)) continue;
        if (++generated > MAX_GENERATED_VARIANTS) throw new Error('Magic variant expansion exceeds the 50,000-record limit.');
        try {
          batch.push(generateVariant(base, record, message => diagnostics.push({ severity: 'warning', file: record.file, record: record.key, message })));
        } catch (error) {
          signal?.throwIfAborted();
          // An incomplete homebrew base cannot invalidate every core item using this recipe.
          // Skip this combination, retain the base, and report exactly which weapon needs fixing.
          const homebrewBase = base.file.startsWith('homebrew/');
          diagnostics.push({ severity: homebrewBase ? 'warning' : 'error', file: homebrewBase ? base.file : record.file,
            record: base.key, message: `${base.name} + ${record.name}: ${String(error)}` });
        }
      }
      for (let index = 0; index < batch.length; index += 128) {
        await cache.put(revisionId, batch.slice(index, index + 128));
      }
      added += batch.length;
    } catch (error) { reportError(record, error); }
    progress?.(++processed, added, record.file);
  });
  const lookup = (kind: string, value: unknown, defaultSource: string): ContentRecord => {
    const token = uid(value); const [identifier, publication] = token.split('|');
    if (!identifier) throw new Error(`Invalid ${kind} reference.`);
    const fields = kind === 'itemMastery' ? { name: identifier } : { abbreviation: identifier };
    const exact = metadata.get(entityKey(kind, { ...fields, source: publication || defaultSource }));
    if (exact) return exact;
    // Android's bare abbreviation links predate qualified UIDs. Honor the classic DMG definition
    // when a bare legacy token has no PHB definition; explicit UIDs never fall back across books.
    if (!publication && defaultSource === 'PHB') {
      const legacy = metadata.get(entityKey(kind, { ...fields, source: 'DMG' }));
      if (legacy) return legacy;
    }
    // Legacy bare abbreviations may have a sole definition outside the default book.
    const candidates = publication ? [] : [...metadata.values()].filter(r => r.kind === kind && normalize(kind === 'itemMastery' ? r.name : string(r.data['abbreviation'])) === normalize(identifier));
    if (candidates.length === 1) return candidates[0];
    throw new Error(`Missing or ambiguous ${kind} definition: ${token}`);
  };
  await cache.visit(revisionId, async record => {
    signal?.throwIfAborted();
    if (record.kind !== 'item' || !shouldProcess(record)) return;
    try {
      const derivedBase = record.derivation?.inputs.find(link => link.role === 'base-item');
      let base = derivedBase ? await cache.get(revisionId, derivedBase.target) : undefined;
      if (!base && typeof record.data['baseItem'] === 'string') {
        const [name, source = 'DMG'] = record.data['baseItem'].split('|');
        base = await cache.get(revisionId, entityKey('baseitem', { name, source }));
        if (!base) throw new Error(`Item base not found: ${record.data['baseItem']}`);
      }
      const data = structuredClone(record.data);
      if (base) for (const [field, value] of Object.entries(base.data)) {
        if (['name', 'source', '_copy', 'entries'].includes(field)) continue;
        if (data[field] === undefined || data[field] === null) data[field] = structuredClone(value);
      }
      data['reqAttune'] = data['reqAttune'] === true ? 'by anyone' : typeof data['reqAttune'] === 'string' ? data['reqAttune'] : null;
      const type = data['type'] ? lookup('itemType', data['type'], 'PHB') : undefined;
      const resolve = (field: 'property' | 'mastery', kind: string, publication: string) => array(data[field]).map(value => {
        const definition = lookup(kind, value, publication);
        return { key: definition.key };
      }).filter((definition, index, all) => all.findIndex(other => other.key === definition.key) === index);
      const properties = resolve('property', 'itemProperty', 'PHB');
      const masteries = resolve('mastery', 'itemMastery', 'XPHB');
      if (data['range'] === undefined && string(data['type']).split('|')[0] === 'M') data['range'] = '5';
      const links = [...record.links];
      if (base && !links.some(link => link.role === 'base-item' && link.target === base.key)) links.push({ role: 'base-item', target: base.key });
      if (type) links.push({ role: 'item-type', target: type.key });
      links.push(...properties.map(p => ({ role: 'item-property', target: p.key })), ...masteries.map(p => ({ role: 'item-mastery', target: p.key })));
      await cache.put(revisionId, [{ ...record, data, links }]);
    } catch (error) { reportError(record, error); }
    if (++processed % 128 === 0) progress?.(processed, added, record.file);
  });
  return { added };
}
