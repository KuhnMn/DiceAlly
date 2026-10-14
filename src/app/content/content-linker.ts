import { ContentCache } from './content-cache';
import { directLinks, featureReference } from './content-adapter';
import { ContentLink, ContentRecord, entityKey, ImportDiagnostic, JsonObject, normalize, object, string } from './content.model';

const TAGS: Record<string, { kind: string; source: string }> = {
  spell: { kind: 'spell', source: 'PHB' }, item: { kind: 'item', source: 'DMG' },
  creature: { kind: 'monster', source: 'MM' }, race: { kind: 'species', source: 'PHB' },
  feat: { kind: 'feat', source: 'PHB' }, optfeature: { kind: 'optionalfeature', source: 'PHB' },
  condition: { kind: 'condition', source: 'PHB' }, variantrule: { kind: 'variantrule', source: 'DMG' },
  table: { kind: 'table', source: 'DMG' }, class: { kind: 'class', source: 'PHB' },
};
function aliasKey(kind: string, name: string, publication: string): string {
  return JSON.stringify([kind, normalize(name), normalize(publication)]);
}
export class ContentReferenceIndex {
  private readonly keys = new Set<string>();
  private readonly aliases = new Map<string, Set<string>>();
  has(key: string): boolean { return this.keys.has(key); }
  add(record: ContentRecord): void {
    this.keys.add(record.key);
    this.alias(record.kind, record.name, record.publication, record.key);
    if (record.homebrewVariant) this.alias(record.kind, string(record.data['name']), record.publication, record.key);
    if (record.kind === 'magicvariant') this.alias('item', record.name, record.publication, record.key);
    if (record.kind === 'item' && record.derivation?.operation === 'magicvariant') {
      this.alias('item', record.name, string(record.data['variantSource']), record.key);
    }
  }
  alias(kind: string, name: string, publication: string, key: string): void {
    const alias = aliasKey(kind, name, publication);
    const candidates = this.aliases.get(alias) ?? new Set<string>();
    candidates.add(key); this.aliases.set(alias, candidates);
  }
  resolve(kind: string, name: string, publication: string): { target: string; status: ContentLink['status'] } {
    const key = aliasKey(kind, name, publication);
    const candidates = this.aliases.get(key);
    // An explicitly published playable item wins over generated aliases with the same name.
    if (this.keys.has(key)) return { target: key, status: 'resolved' };
    if (candidates?.size === 1) return { target: [...candidates][0], status: 'resolved' };
    return { target: key, status: candidates?.size ? 'ambiguous' : 'missing' };
  }
}
export async function buildReferenceIndex(cache: ContentCache, revision: string, signal?: AbortSignal): Promise<ContentReferenceIndex> {
  const index = new ContentReferenceIndex();
  await cache.visit(revision, async record => {
    signal?.throwIfAborted(); index.add(record);
    if (record.kind === 'species' && record.derivation?.operation === 'subrace') {
      const subKey = record.derivation.inputs.find(link => link.role === 'subrace-definition')?.target;
      const sub = subKey ? await cache.get(revision, subKey) : undefined;
      if (sub) {
        const parent = string(sub.data['raceName']); const label = string(sub.data['name']);
        const brackets = /^(.*?)(\([^()]*\))$/.exec(parent);
        const name = !label ? parent : brackets
          ? `${brackets[1]}(${brackets[2].slice(1, -1)}; ${label})` : `${parent} (${label})`;
        index.alias('species', name, record.publication, record.key);
      }
    }
  });
  return index;
}

export function linkContent(record: ContentRecord, index: ContentReferenceIndex): { links: ContentLink[]; diagnostics: ImportDiagnostic[] } {
  const diagnostics: ImportDiagnostic[] = [];
  const links: ContentLink[] = [];
  const add = (link: ContentLink) => {
    if (!links.some(other => other.role === link.role && other.target === link.target && other.path === link.path)) links.push(link);
  };
  const uid = (kind: string, token: string, defaultSource: string, role: string, path: string, scope: ContentLink['scope'], required: boolean) => {
    const parts = (kind === 'spell' ? token.replace(/#[^#]*$/, '') : token).split('|').map(p => p.trim());
    const name = parts[0].replace(/#[^#]*$/, '').trim();
    if (!name) throw new Error(`Invalid ${role} reference at ${path}.`);
    add({ role, ...index.resolve(kind, name, parts[1] || defaultSource), required, scope, path, reference: token });
  };
  for (const link of directLinks(record)) {
    const scope = link.scope ?? (['classFeature', 'subclassFeature'].includes(link.role) ? 'catalog'
      : link.role.startsWith('parent-') || link.role.includes('definition') || link.role === 'magic-variant' || link.role === 'copy-template' ? 'provenance' : 'rule');
    add({ ...link, scope, required: link.required ?? true, status: index.has(link.target) ? 'resolved' : 'missing' });
  }
  const group = record.kind === 'itemGroup' || record.derivation?.operation === 'item-group';
  if (group && Array.isArray(record.data['items'])) record.data['items'].forEach((value, position) => {
    if (typeof value !== 'string') throw new Error('Item-group members must be item UIDs.');
    uid('item', value, 'DMG', 'item-group-member', `items[${position}]`, 'catalog', true);
  });
  const deferred = (value: unknown, path: string) => {
    add({ role: 'spell-selection', target: JSON.stringify(['spell-query', value]), reference: JSON.stringify(value), scope: 'catalog',
      status: 'deferred', required: false, path });
  };
  const grant = (value: unknown, path: string, choice = false): void => {
    if (typeof value === 'string') { uid('spell', value, 'PHB', choice ? 'spell-choice' : 'spell-grant', path, choice ? 'catalog' : 'rule', true); return; }
    if (Array.isArray(value)) { value.forEach((v, i) => grant(v, `${path}[${i}]`, choice)); return; }
    const data = object(value);
    if (!data) throw new Error(`Invalid spell grant at ${path}.`);
    if (data['choose'] !== undefined) {
      const choose = object(data['choose']);
      if (choose?.['from'] !== undefined) grant(choose['from'], `${path}.choose.from`, true);
      else deferred(data['choose'], `${path}.choose`);
      return;
    }
    if (data['all'] !== undefined) { deferred(data['all'], `${path}.all`); return; }
    if (data['spell'] !== undefined) { grant(data['spell'], `${path}.spell`, choice); return; }
    for (const [key, child] of Object.entries(data)) {
      // Metadata describes the grant, not another spell reference.
      if (['ability', 'name', 'resourceName', 'count'].includes(key)) continue;
      grant(child, `${path}.${key}`, choice);
    }
  };
  const additional = record.data['additionalSpells'];
  if (additional !== undefined && additional !== null) {
    if (!Array.isArray(additional)) throw new Error('additionalSpells must be an array.');
    additional.forEach((value, position) => {
      const block = object(value);
      if (!block) throw new Error('Invalid additionalSpells block.');
      for (const field of ['innate', 'known', 'prepared', 'expanded']) if (block[field] !== undefined) {
        const start = links.length;
        grant(block[field], `additionalSpells[${position}].${field}`);
        // Expanded lists make spells available; they do not automatically grant them.
        if (field === 'expanded') for (const link of links.slice(start)) {
          link.scope = 'catalog';
          if (link.role === 'spell-grant') link.role = 'spell-expanded';
        }
      }
    });
  }
  if (Array.isArray(record.data['attachedSpells'])) grant(record.data['attachedSpells'], 'attachedSpells');

  const reference = (kind: 'classFeature' | 'subclassFeature', value: unknown, path: string) => {
    try {
      const link = featureReference(value, kind, record.data);
      add({ ...link, role: `entry-${kind}`, path, scope: 'description', required: false, status: index.has(link.target) ? 'resolved' : 'missing' });
    } catch (error) {
      diagnostics.push({ severity: 'warning', file: record.file, record: record.key, message: `${path}: ${String(error)}` });
    }
  };
  const walk = (value: unknown, path: string): void => {
    if (typeof value === 'string') {
      // Match innermost tags too; display labels do not form part of the UID.
      for (const match of value.matchAll(/\{@([a-zA-Z]+)\s+([^{}]+)\}/g)) {
        const tag = match[1]; const token = match[2];
        if (tag === 'classFeature' || tag === 'subclassFeature') reference(tag, token, path);
        else if (TAGS[tag]) uid(TAGS[tag].kind, token, TAGS[tag].source, `entry-${tag}`, path, 'description', false);
      }
      return;
    }
    if (Array.isArray(value)) { value.forEach((v, i) => walk(v, `${path}[${i}]`)); return; }
    const data = object(value);
    if (!data) return;
    const type = string(data['type']);
    if (type === 'refClassFeature') reference('classFeature', data['classFeature'], path);
    if (type === 'refSubclassFeature') reference('subclassFeature', data['subclassFeature'], path);
    for (const [typeName, field, kind] of [['refFeat', 'feat', 'feat'], ['refOptionalfeature', 'optionalfeature', 'optionalfeature']] as const) {
      if (type === typeName && typeof data[field] === 'string') uid(kind, data[field], 'PHB', `entry-${field}`, path, 'description', false);
    }
    for (const [field, child] of Object.entries(data)) walk(child, `${path}.${field}`);
  };
  // Only presentation-bearing trees; scanning classFeatures/grants again would lose their semantics.
  for (const field of ['entries', 'entriesTemplate', 'action', 'bonus', 'reaction', 'trait', 'legendary', 'mythic', 'variant', 'spellcasting', 'headerEntries', 'footerEntries']) {
    if (record.data[field] !== undefined) walk(record.data[field], field);
  }
  for (const link of links) {
    if (link.status === 'resolved' || link.status === 'deferred') continue;
    diagnostics.push({ severity: link.required ? 'error' : 'warning', file: record.file, record: record.key,
      message: `${link.status} ${link.role} at ${link.path ?? 'root'}: ${link.reference ?? link.target}` });
  }
  return { links, diagnostics };
}
