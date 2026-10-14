import { featureReference } from '../content/content-adapter';
import { ContentRecord, entityKey, JsonObject, normalize, object, string } from '../content/content.model';
import { CasterProgression, ClassLevelInput } from './level-rules';

export interface ContentRulesIndex {
  sourceIdentity: string;
  revisionId: string;
  records: ReadonlyMap<string, ContentRecord>;
}
export interface ContentClassSelection {
  selectionId: string;
  classKey: string;
  subclassKey?: string;
  level: number;
}
export interface FeatureGrant {
  // A grant explains why the character has a feature; several grants can share one instance.
  id: string;
  selectionId: string;
  ownerKey: string;
  role: 'classFeature' | 'subclassFeature' | 'optionalfeature';
}
export interface FeatureInstance {
  id: string;
  sourceIdentity: string;
  revisionId: string;
  contentKey: string;
  manual: boolean;
  grants: FeatureGrant[];
  snapshot: ContentRecord;
  customization: JsonObject;
}
export interface FeaturePreview {
  canAccept: boolean;
  classInputs: ClassLevelInput[];
  instances: FeatureInstance[];
  removed: FeatureInstance[];
  diagnostics: { selectionId?: string; message: string }[];
}
const CASTERS: Record<string, CasterProgression> = { full: 'full', '1/2': 'half', '1/3': 'third', artificer: 'artificer', pact: 'pact' };
/** Pure selection preview. No source/edition guessing and no automatic content revision updates. */
export function deriveClassFeatures(selections: ContentClassSelection[], index: ContentRulesIndex,
  previous: FeatureInstance[] = [], suppressedGrantIds: readonly string[] = []): FeaturePreview {
  const diagnostics: FeaturePreview['diagnostics'] = [];
  const classInputs: ClassLevelInput[] = [];
  const wanted = new Map<string, { record: ContentRecord; grants: FeatureGrant[] }>();
  const ids = new Set<string>(); const classes = new Set<string>(); const suppressed = new Set(suppressedGrantIds);
  const report = (selectionId: string, message: string) => diagnostics.push({ selectionId, message });
  if (!index.sourceIdentity || !index.revisionId) diagnostics.push({ message: 'Content source and pinned revision are required.' });
  if (!selections.length || selections.reduce((sum, s) => sum + s.level, 0) > 20) diagnostics.push({ message: 'Select classes totaling 1–20 levels.' });
  for (const selection of selections) {
    if (!selection.selectionId || ids.has(selection.selectionId) || classes.has(selection.classKey)) {
      report(selection.selectionId, 'Class selection IDs and selected classes must be unique.'); continue;
    }
    ids.add(selection.selectionId); classes.add(selection.classKey);
    if (!Number.isInteger(selection.level) || selection.level < 1 || selection.level > 20) {
      report(selection.selectionId, 'Invalid class level.'); continue;
    }
    const parent = index.records.get(selection.classKey);
    if (!parent || parent.kind !== 'class') { report(selection.selectionId, 'Selected class is missing or has the wrong kind.'); continue; }
    const subclass = selection.subclassKey ? index.records.get(selection.subclassKey) : undefined;
    if (selection.subclassKey && (!subclass || subclass.kind !== 'subclass'
      || entityKey('class', { name: subclass.data['className'], source: subclass.data['classSource'] }) !== parent.key)) {
      report(selection.selectionId, 'Selected subclass is missing or belongs to a different class/publication.'); continue;
    }
    const die = object(parent.data['hd']);
    if (!die || die['number'] !== 1 || ![4,6,8,10,12].includes(Number(die['faces']))) {
      report(selection.selectionId, 'Class hit-die definition requires a supported handler.'); continue;
    }
    const classCaster = parent.data['casterProgression']; const subclassCaster = subclass?.data['casterProgression'];
    // A subclass can supply casting to a noncaster; do not double-count a casting class.
    if (classCaster && subclassCaster && classCaster !== subclassCaster) {
      report(selection.selectionId, 'Conflicting class/subclass casting progressions require a handler.'); continue;
    }
    const casterToken = subclassCaster || classCaster;
    const caster = !casterToken ? 'none' : CASTERS[string(casterToken)];
    if (!caster) { report(selection.selectionId, 'Unsupported casting progression.'); continue; }
    classInputs.push({ selectionId: selection.selectionId, level: selection.level, hitDie: Number(die['faces']) as ClassLevelInput['hitDie'], caster });
    for (const owner of [parent, ...(subclass ? [subclass] : [])]) {
      const role = owner.kind === 'class' ? 'classFeature' : 'subclassFeature';
      const raw = owner.data[owner.kind === 'class' ? 'classFeatures' : 'subclassFeatures'] ?? [];
      if (!Array.isArray(raw)) { report(selection.selectionId, 'Feature list must be an array.'); continue; }
      for (const reference of raw) {
        let key: string;
        try { key = featureReference(reference, role, owner.data).target; }
        catch (error) { report(selection.selectionId, String(error)); continue; }
        const record = index.records.get(key);
        if (!record || record.kind !== role) { report(selection.selectionId, `Missing qualified feature: ${key}`); continue; }
        if (entityKey('class', { name: record.data['className'], source: record.data['classSource'] }) !== parent.key) {
          report(selection.selectionId, `Feature belongs to a different class: ${key}`); continue;
        }
        if (role === 'subclassFeature' && (normalize(string(record.data['subclassShortName'])) !== normalize(string(owner.data['shortName'], owner.name))
          || normalize(string(record.data['subclassSource'])) !== normalize(owner.publication))) {
          report(selection.selectionId, `Feature belongs to a different subclass: ${key}`); continue;
        }
        const level = record.data['level'];
        if (typeof level !== 'number' || !Number.isInteger(level) || level < 0 || level > 20) {
          report(selection.selectionId, `Invalid feature level: ${key}`); continue;
        }
        if (level > selection.level) continue;
        const grant: FeatureGrant = { id: JSON.stringify(['feature-grant', index.sourceIdentity, selection.selectionId, owner.key, role, key]),
          selectionId: selection.selectionId, ownerKey: owner.key, role };
        if (suppressed.has(grant.id)) continue;
        const entry = wanted.get(key) ?? { record, grants: [] };
        if (!entry.grants.some(g => g.id === grant.id)) entry.grants.push(grant);
        wanted.set(key, entry);
      }
    }
  }
  const instances = structuredClone(previous.filter(instance => instance.manual || instance.sourceIdentity !== index.sourceIdentity).map(instance => ({ ...instance,
    grants: instance.sourceIdentity === index.sourceIdentity ? [] : instance.grants })));
  if (new Set(previous.map(p => p.id)).size !== previous.length) diagnostics.push({ message: 'Feature instance IDs must be unique.' });
  for (const [key, { record, grants }] of wanted) {
    const matching = previous.filter(p => p.contentKey === key && p.sourceIdentity === index.sourceIdentity);
    if (matching.length > 1) { diagnostics.push({ message: `Ambiguous existing feature instances: ${key}` }); continue; }
    const existing = matching[0];
    if (existing && existing.revisionId !== index.revisionId) {
      diagnostics.push({ message: `Explicit content-update preview required for ${key}.` }); continue;
    }
    const instance: FeatureInstance = existing ? { ...structuredClone(existing), grants: structuredClone(grants) }
      : { id: JSON.stringify(['feature-instance', index.sourceIdentity, key]), sourceIdentity: index.sourceIdentity,
        revisionId: index.revisionId, contentKey: key, manual: false, grants: structuredClone(grants), snapshot: structuredClone(record), customization: {} };
    const position = instances.findIndex(p => p.id === instance.id);
    if (position >= 0 && (instances[position].contentKey !== instance.contentKey || instances[position].sourceIdentity !== instance.sourceIdentity)) {
      diagnostics.push({ message: `Feature instance ID collision: ${instance.id}` }); continue;
    }
    if (position < 0) instances.push(instance); else instances[position] = instance;
  }
  const retained = new Set(instances.map(i => i.id));
  // Invalid references never produce an apparently usable partial replacement of existing features.
  return { canAccept: diagnostics.length === 0, classInputs, instances: diagnostics.length ? structuredClone(previous) : instances,
    removed: diagnostics.length ? [] : structuredClone(previous.filter(p => !retained.has(p.id))), diagnostics };
}
