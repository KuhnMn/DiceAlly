import { ContentLink, entityKey, JsonObject, object, string } from './content.model';
import type { ContentRecord } from './content.model';
import { contentEntries } from './content-entries';

export interface FeatureEntryPlan {
  references: ContentLink[];
  choices: { id: string; label: string; count: number;
    options: { value: string; label: string; plan: FeatureEntryPlan }[] }[];
}

/** Preserve choice boundaries: prose links and transient options never grant permanent features. */
export function featureEntryPlan(record: ContentRecord, kind: 'classFeature' | 'subclassFeature'): FeatureEntryPlan {
  const type = kind === 'classFeature' ? 'refClassFeature' : 'refSubclassFeature';
  const identities = new Map<string, number>();
  const targets = (plan: FeatureEntryPlan): string[] => [...new Set([
    ...plan.references.map(reference => reference.target),
    ...plan.choices.flatMap(choice => choice.options.flatMap(option => targets(option.plan))),
  ])].sort();
  const read = (value: unknown): FeatureEntryPlan => {
    const plan: FeatureEntryPlan = { references: [], choices: [] };
    const append = (child: unknown) => {
      const next = read(child); plan.references.push(...next.references); plan.choices.push(...next.choices);
    };
    if (Array.isArray(value)) { value.forEach(append); return plan; }
    const entry = object(value);
    if (!entry) return plan;
    if (entry['type'] === type) { plan.references.push(featureReference(entry[kind], kind, {})); return plan; }
    if (entry['type'] === 'options') {
      if (entry['count'] === undefined || entry['count'] === 0) return plan;
      const options = (Array.isArray(entry['entries']) ? entry['entries'] : []).map(raw => {
        const branch = read(raw), keys = targets(branch), data = object(raw);
        const label = string(data?.['name']) || (data?.['type'] === type ? string(data[kind]).split('|')[0]
          : keys.map(key => String(JSON.parse(key)[1])).join(' / ')) || (typeof raw === 'string' ? raw : 'Option');
        const value = branch.references.length === 1 && !branch.choices.length ? branch.references[0].target
          : JSON.stringify(['feature-entry-option', label, keys]);
        return { value, label, plan: branch };
      });
      if (!options.some(option => targets(option.plan).length)) return plan;
      const unique = [...new Map(options.map(option => [option.value, option])).values()];
      const count = entry['count'];
      if (typeof count !== 'number' || !Number.isSafeInteger(count) || count < 1 || count > unique.length) {
        throw new Error(`Invalid feature choice count in ${record.name}.`);
      }
      const label = string(entry['name']) || 'Choose features';
      const identity = string(entry['id']) || string(entry['name']) || JSON.stringify(unique.map(option => option.value).sort());
      const occurrence = identities.get(identity) ?? 0; identities.set(identity, occurrence + 1);
      plan.choices.push({ id: JSON.stringify([identity, occurrence]), label, count, options: unique });
      return plan;
    }
    // Tables, quotations and open metadata are descriptions, not permanent acquisition instructions.
    if (['table', 'tableGroup', 'quote'].includes(string(entry['type']))) return plan;
    for (const field of ['entries', 'items', 'entry']) if (entry[field] !== undefined) append(entry[field]);
    return plan;
  };
  return read(contentEntries(record));
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

