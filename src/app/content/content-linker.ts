import { referenceSourceData } from './reference-record-adapter';
import { contentEntries, visitEntryTree, tablePresentation, TABLE_PRESENTATION_FIELDS } from './content-entries';
import { attachedSpells, visitAttachedSpells } from './attached-spells';
import { additionalSpells, SPELL_GRANT_LISTS, visitSpellGrantGroups } from './additional-spells';
import { ContentCache } from './content-cache';
import { directLinks, featureReference } from './content-adapter';
import { ContentLink, ContentRecord, ImportDiagnostic, normalize, string } from './content.model';
import { referenceDefaultSource, referenceEdition, RulesEdition } from './reference-edition';

const TAGS: Record<string, { kind: string; source: string }> = {
  spell: { kind: 'spell', source: 'PHB' }, item: { kind: 'item', source: 'DMG' },
  creature: { kind: 'monster', source: 'MM' }, race: { kind: 'species', source: 'PHB' },
  feat: { kind: 'feat', source: 'PHB' }, optfeature: { kind: 'optionalfeature', source: 'PHB' },
  background: { kind: 'background', source: 'PHB' },
  condition: { kind: 'condition', source: 'PHB' }, status: { kind: 'status', source: 'PHB' },
  variantrule: { kind: 'variantrule', source: 'DMG' },
  table: { kind: 'table', source: 'DMG' }, class: { kind: 'class', source: 'PHB' },
};
function aliasKey(kind: string, name: string, publication: string): string {
  return JSON.stringify([kind, normalize(name), normalize(publication)]);
}
export class ContentReferenceIndex {
  private readonly keys = new Set<string>();
  private readonly aliases = new Map<string, Set<string>>();
  private readonly editions = new Map<string, RulesEdition | undefined>();
  private readonly standardSpecies = new Map<string, Map<string, string>>();
  has(key: string): boolean { return this.keys.has(key); }
  add(record: ContentRecord): void {
    if (record.referenceDefinition) record = { ...record, data: referenceSourceData(record) };
    this.keys.add(record.key);
    // A generated item's edition is the base item's edition, not its recipe's publication.
    const baseSource = string(record.data['baseItem']).split('|')[1];
    this.editions.set(record.key, baseSource ? referenceEdition(baseSource) ?? referenceEdition('', record.data['edition'])
      : referenceEdition(record.publication, record.data['edition']));
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
  /** A standard subrace supplies the playable form of its exact base definition. */
  standardSpeciesAlias(name: string, publication: string, key: string, baseKey: string): void {
    this.alias('species', name, publication, key);
    const alias = aliasKey('species', name, publication);
    const standards = this.standardSpecies.get(alias) ?? new Map<string, string>();
    standards.set(key, baseKey);
    this.standardSpecies.set(alias, standards);
  }
  resolve(kind: string, name: string, publication: string, contextEdition?: RulesEdition): { target: string; status: ContentLink['status'] } {
    const key = aliasKey(kind, name, publication);
    const candidates = this.aliases.get(key);
    // An explicitly published playable item wins over generated aliases with the same name.
    if (this.keys.has(key)) return { target: key, status: 'resolved' };
    if (candidates?.size === 1) return { target: [...candidates][0], status: 'resolved' };
    if (kind === 'species' && candidates?.size) {
      const standards = [...this.standardSpecies.get(key) ?? []].filter(([standard, base]) =>
        candidates.has(standard) && [...candidates].every(candidate => candidate === standard || candidate === base));
      if (standards.length === 1) return { target: standards[0][0], status: 'resolved' };
    }
    const edition = referenceEdition(publication) ?? contextEdition;
    if (edition && candidates?.size) {
      const preferred = [...candidates].filter(candidate => this.editions.get(candidate) === edition);
      if (preferred.length === 1) return { target: preferred[0], status: 'resolved' };
    }
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
        const parentKey = record.derivation.inputs.find(link => link.role === 'parent-species')?.target;
        if (!label && parentKey) index.standardSpeciesAlias(name, record.publication, record.key, JSON.stringify(['species', parentKey]));
        else index.alias('species', name, record.publication, record.key);
      }
    }
  });
  return index;
}

export function linkContent(record: ContentRecord, index: ContentReferenceIndex): { links: ContentLink[]; diagnostics: ImportDiagnostic[] } {
  if (record.referenceDefinition) record = { ...record, data: referenceSourceData(record) };
  const diagnostics: ImportDiagnostic[] = [];
  const links: ContentLink[] = [];
  const edition = record.derivation?.operation === 'magicvariant'
    ? referenceEdition(string(record.data['variantSource']))
    : referenceEdition(record.publication, record.data['edition']);
  const add = (link: ContentLink) => {
    if (!links.some(other => other.role === link.role && other.target === link.target && other.path === link.path)) links.push(link);
  };
  const uid = (kind: string, token: string, defaultSource: string, role: string, path: string, scope: ContentLink['scope'], required: boolean) => {
    const parts = (kind === 'spell' ? token.replace(/#[^#]*$/, '') : token).split('|').map(p => p.trim());
    const name = parts[0].replace(/#[^#]*$/, '').trim();
    if (!name) throw new Error(`Invalid ${role} reference at ${path}.`);
    const publication = parts[1] || referenceDefaultSource(defaultSource, edition);
    let resolved = index.resolve(kind, name, publication, edition);
    // Unqualified references retain their old core default as a fallback when no revised target exists.
    if (!parts[1] && publication !== defaultSource && resolved.status === 'missing') resolved = index.resolve(kind, name, defaultSource);
    add({ role, ...resolved, required, scope, path, reference: token });
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
    add({
      role: 'spell-selection', target: JSON.stringify(['spell-query', value]), reference: JSON.stringify(value), scope: 'catalog',
      status: 'deferred', required: false, path
    });
  };
  const additional = additionalSpells(record);
  if (additional !== undefined) {
    additional.forEach((block, position) => {
      for (const field of SPELL_GRANT_LISTS) if (block[field] !== undefined) {
        const start = links.length;
        for (const [requirement, value] of Object.entries(block[field]!)) {
          visitSpellGrantGroups(value, `additionalSpells[${position}].${field}.${requirement}`, (entries, path) => {
            entries.forEach((entry, position) => {
              const entryPath = `${path}[${position}]`;
              if (typeof entry === 'string') uid('spell', entry, 'PHB', 'spell-grant', entryPath, 'rule', true);
              else if ('all' in entry) deferred(entry.all, `${entryPath}.all`);
              else if (typeof entry.choose === 'string') deferred(entry.choose, `${entryPath}.choose`);
              else entry.choose.from.forEach((token, position) => {
                uid('spell', token, 'PHB', 'spell-choice', `${entryPath}.choose.from[${position}]`, 'catalog', true);
              });
            });
          });
        }
        // Expanded lists make spells available; they do not automatically grant them.
        if (field === 'expanded') for (const link of links.slice(start)) {
          link.scope = 'catalog';
          if (link.role === 'spell-grant') link.role = 'spell-expanded';
        }
      }
    });
  }
  const attached = attachedSpells(record);
  if (attached) visitAttachedSpells(attached, (token, path) => uid('spell', token, 'PHB', 'spell-grant', path, 'rule', true));

  const reference = (kind: 'classFeature' | 'subclassFeature', value: unknown, path: string) => {
    try {
      const link = featureReference(value, kind, record.data);
      add({ ...link, role: `entry-${kind}`, path, scope: 'description', required: false, status: index.has(link.target) ? 'resolved' : 'missing' });
    } catch (error) {
      diagnostics.push({ severity: 'warning', file: record.file, record: record.key, message: `${path}: ${String(error)}` });
    }
  };
  const text = (value: string, path: string) => {
    // Match innermost tags too; display labels do not form part of the UID.
    for (const match of value.matchAll(/\{@([a-zA-Z]+)\s+([^{}]+)\}/g)) {
      const tag = match[1]; const token = match[2];
      if (tag === 'classFeature' || tag === 'subclassFeature') reference(tag, token, path);
      else if (TAGS[tag]) uid(TAGS[tag].kind, token, TAGS[tag].source, `entry-${tag}`, path, 'description', false);
    }
  };
  const node: Parameters<typeof visitEntryTree>[3] = (entry, path) => {
    switch (entry.type) {
      case 'refClassFeature': reference('classFeature', entry.classFeature, path); break;
      case 'refSubclassFeature': reference('subclassFeature', entry.subclassFeature, path); break;
      case 'refFeat': if (typeof entry.feat === 'string') uid('feat', entry.feat, 'PHB', 'entry-feat', path, 'description', false); break;
      case 'refOptionalfeature': if (typeof entry.optionalfeature === 'string') uid('optionalfeature', entry.optionalfeature, 'PHB', 'entry-optionalfeature', path, 'description', false); break;
    }
  };
  // Only presentation-bearing trees; classFeatures/grants have separate semantics.
  for (const field of ['entries', 'entriesHigherLevel', 'entriesTemplate'] as const) {
    if (record.data[field] !== undefined) visitEntryTree(contentEntries(record, field), field, text, node);
  }
  if (record.kind === 'table') {
    const table = tablePresentation(record);
    for (const field of TABLE_PRESENTATION_FIELDS) {
      if (table[field] !== undefined) visitEntryTree(table[field], field, text, node);
    }
  }
  for (const field of ['action', 'actionEntries', 'bonus', 'reaction', 'trait', 'legendary', 'mythic', 'variant', 'spellcasting', 'headerEntries', 'footerEntries']) {
    if (record.data[field] !== undefined) visitEntryTree(record.data[field], field, text, node);
  }
  for (const link of links) {
    if (link.status === 'resolved' || link.status === 'deferred') continue;
    diagnostics.push({
      severity: link.required ? 'error' : 'warning', file: record.file, record: record.key,
      message: `${link.status} ${link.role} at ${link.path ?? 'root'}: ${link.reference ?? link.target}`
    });
  }
  return { links, diagnostics };
}
