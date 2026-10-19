import { ContentLink, ContentRecord, entityKey, ImportDiagnostic, JsonObject, normalize, object, string } from './content.model';
import { applyCopyModifiers } from './copy-modifiers';
import { resolveCopyVariables } from './copy-variables';

export const CONTENT_KINDS = [
  'class', 'subclass', 'classFeature', 'subclassFeature', 'spell', 'feat', 'optionalfeature',
  'race', 'subrace', 'background', 'baseitem', 'item', 'itemGroup', 'magicvariant', 'itemType', 'itemProperty',
  'itemMastery', 'monster', 'monsterTemplate', 'condition', 'variantrule', 'table',
] as const;

export function mapContent(value: unknown, file: string): { records: ContentRecord[]; diagnostics: ImportDiagnostic[] } {
  const root = object(value);
  if (!root) throw new Error(`${file}: expected a JSON object.`);
  const records: ContentRecord[] = [];
  const diagnostics: ImportDiagnostic[] = [];
  for (const kind of CONTENT_KINDS) {
    if (root[kind] === undefined) continue;
    if (!Array.isArray(root[kind])) throw new Error(`${file}: ${kind} must be an array.`);
    for (const raw of root[kind]) {
      const data = object(raw);
      if (!data) throw new Error(`${file}: invalid ${kind} record.`);
      const propertyEntries = Array.isArray(data['entries']) ? data['entries'] : Array.isArray(data['entriesTemplate']) ? data['entriesTemplate'] : [];
      const entryName = kind === 'itemProperty' ? string(object(propertyEntries[0])?.['name']) : '';
      const name = string(data['name'], entryName || string(data['abbreviation'], kind === 'subrace' ? string(data['raceName']) : ''));
      if (!name) throw new Error(`${file}: ${kind} has no name/abbreviation.`);
      if (['classFeature', 'subclassFeature'].includes(kind) &&
          (!Number.isInteger(data['level']) || Number(data['level']) < 0 || !string(data['className']))) {
        throw new Error(`${file}: ${name} has an invalid feature level or parent class.`);
      }
      // Preserve upstream structures/unknown fields; projecting to the viewer would lose creator inputs.
      records.push({ key: entityKey(kind, data), kind, name, publication: string(data['source'], kind === 'magicvariant' ? string(object(data['inherits'])?.['source']) : ''), file, data, links: [] });
    }
  }
  if (!records.length && !file.endsWith('spells/sources.json')) {
    diagnostics.push({ severity: 'warning', file, message: 'No supported content category was found.' });
  }
  return { records, diagnostics };
}

export function featureReference(value: unknown, kind: 'classFeature' | 'subclassFeature', _parent: JsonObject): ContentLink {
  const token = typeof value === 'string' ? value : string(object(value)?.[kind]);
  const p = token.split('|');
  const subclass = kind === 'subclassFeature';
  const level = Number(p[subclass ? 5 : 3]);
  if (!token || p.length < (subclass ? 6 : 4) || !Number.isInteger(level) || level < 0) {
    throw new Error(`Invalid ${kind} reference: ${token}`);
  }
  const data: JsonObject = {
    name: p[0], className: p[1], classSource: p[2] || 'PHB',
    source: p[subclass ? 6 : 4] || (subclass ? p[4] : p[2]) || 'PHB', level,
  };
  if (subclass) { data['subclassShortName'] = p[3]; data['subclassSource'] = p[4] || 'PHB'; }
  return { role: kind, target: entityKey(kind, data) };
}

export function directLinks(record: ContentRecord): ContentLink[] {
  const data = record.data;
  const links: ContentLink[] = [...record.links];
  const field = record.kind === 'class' ? 'classFeatures' : record.kind === 'subclass' ? 'subclassFeatures' : undefined;
  if (field && Array.isArray(data[field])) {
    for (const reference of data[field]) {
      links.push(featureReference(reference, field === 'classFeatures' ? 'classFeature' : 'subclassFeature', data));
    }
  }
  if (['subclass', 'classFeature', 'subclassFeature'].includes(record.kind)) {
    links.push({ role: 'parent-class', target: entityKey('class', { name: data['className'], source: data['classSource'] }) });
  }
  if (record.kind === 'subrace') {
    links.push({ role: 'parent-species', target: entityKey('race', { name: data['raceName'], source: data['raceSource'] }) });
  }
  if (typeof data['baseItem'] === 'string') {
    const [name, source] = data['baseItem'].split('|');
    links.push({ role: 'base-item', target: entityKey('baseitem', { name, source: source || 'DMG' }) });
  }
  if (Array.isArray(data['_copy_templates'])) {
    for (const reference of data['_copy_templates']) {
      const template = object(reference);
      if (!template) throw new Error('Invalid applied template reference.');
      links.push({ role: 'copy-template', target: entityKey('monsterTemplate', template) });
    }
  }
  return links.filter((link, index) => links.findIndex(other => other.role === link.role && other.target === link.target) === index);
}

/** Copy inheritance is deliberately conservative: unsupported transforms remain visible failures. */
export function inheritCopy(base: JsonObject, child: JsonObject, templates: JsonObject[] = [], kind = ''): JsonObject {
  const copy = object(child['_copy']);
  if (copy?.['_trait']) throw new Error('Legacy _trait copy syntax is not supported; use named _templates references.');
  const result = { ...structuredClone(base), ...structuredClone(child) };
  const preserve = object(copy?.['_preserve']);
  // Publication metadata belongs to the child, unless explicitly preserved by the copy contract.
  const categoryFields = kind === 'monster' ? ['legendaryGroup', 'environment', 'soundClip', 'variant', 'dragonCastingColor', 'familiar']
    : ['item', 'itemGroup', 'baseitem', 'magicvariant'].includes(kind) ? ['lootTables', 'tier'] : [];
  for (const field of [...categoryFields, 'page', 'otherSources', 'referenceSources', 'srd', 'srd52', 'basicRules', 'basicRules2024', 'reprintedAs', 'hasFluff', 'hasFluffImages', 'hasToken', 'tokenCredit', 'tokenCustom', 'foundryTokenScale', 'altArt', '_versions']) {
    if (!Object.hasOwn(child, field) && !preserve?.['*'] && !preserve?.[field]) delete result[field];
  }
  for (const [field, value] of Object.entries(child)) if (value === null) delete result[field];
  const mods: JsonObject = structuredClone(object(copy?.['_mod'] ?? copy?.['mod']) ?? {});
  const references = copy?.['_templates'];
  if (references !== undefined && !Array.isArray(references)) throw new Error('Copy templates must be an array.');
  for (const reference of (references as unknown[] | undefined) ?? []) {
    const ref = object(reference);
    const matches = templates.filter(t => normalize(string(t['name'])) === normalize(string(ref?.['name'])) && normalize(string(t['source'])) === normalize(string(ref?.['source'])));
    if (!ref || matches.length !== 1) throw new Error(`Missing or ambiguous copy template: ${string(ref?.['name'])} (${string(ref?.['source'])}).`);
    const apply = object(matches[0]['apply']);
    if (!apply) throw new Error('Copy template has no apply definition.');
    for (const [field, value] of Object.entries(object(apply['_root']) ?? {})) {
      if (!Object.hasOwn(child, field)) result[field] = structuredClone(value);
    }
    for (const [field, operations] of Object.entries(object(apply['_mod']) ?? {})) {
      const existing = mods[field] === undefined ? [] : Array.isArray(mods[field]) ? mods[field] as unknown[] : [mods[field]];
      mods[field] = [...existing, ...structuredClone(Array.isArray(operations) ? operations : [operations])];
    }
  }
  if (Object.keys(mods).length) applyCopyModifiers(result, resolveCopyVariables(mods, result) as JsonObject);
  if (Array.isArray(references)) result['_copy_templates'] = structuredClone(references);
  delete result['_copy'];
  return result;
}
