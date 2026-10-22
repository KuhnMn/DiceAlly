import { itemTypeCode } from '../content/item.model';
import { classDefinition, isClassKind } from '../content/class-adapter';
import { IndexedDbContentCache } from '../content/content-cache';
import { ContentRecord, ImportRevision, entityKey, normalize, string } from '../content/content.model';
import { activeContentRevision } from '../editor/active-content-revision';
import { contentReference } from '../editor/editor-content-helpers';
import { normalizeCharacterEditorIdentity, wizardEditorId } from '../editor/editor-identity';
import { createWizardBaseline } from '../editor/wizard-bookkeeping';
import { ExportedCharacter, FeatureSource, Proficiencies } from '../models/character.model';

/** Android exports have database IDs and split casting sources, but no portable editor identities. */
export function isLegacyCharacterExport(sheet: ExportedCharacter): boolean {
  if (sheet.creatorWizard) return false;
  const entries = [...(sheet.features ?? []), ...(sheet.spells ?? []), ...(sheet.inventory ?? []), ...(sheet.monsters ?? []), ...(sheet.objects ?? []),
    ...(sheet.species ? [sheet.species] : [])];
  if (entries.some(entry => entry.editorId || entry.contentReference)) return false;
  const androidSnapshots = entries.some(entry => ['featureEntity', 'featEntity', 'optionalFeatureEntity', 'entity'].some(field => {
    const snapshot = (entry as unknown as Record<string, { id?: number } | undefined>)[field];
    return typeof snapshot?.id === 'number';
  }));
  return 'installationId' in sheet || androidSnapshots
    || !!sheet.character?.featureSources?.some(source => / - S$/i.test(source.name ?? ''));
}

const LANGUAGES = new Map(('Common,Common Sign Language,Draconic,Dwarvish,Elvish,Giant,Gnomish,Goblin,Halfling,Orc,Abyssal,'
  + 'Celestial,Deep Speech,Druidic,Infernal,Primordial,Sylvan,Undercommon,Aquan,Auran,Ignan,Terran,Thieves’ Cant,Thieves\' Cant')
  .split(',').map(name => [normalize(name), name]));
const ABILITIES: Record<string, string> = { strength: 'STR', dexterity: 'DEX', constitution: 'CON', intelligence: 'INT', wisdom: 'WIS', charisma: 'CHA' };
const SKILLS = 'Acrobatics,Animal Handling,Arcana,Athletics,Deception,History,Insight,Intimidation,Investigation,Medicine,Nature,Perception,Performance,Persuasion,Religion,Sleight of Hand,Stealth,Survival'.split(',');
const TOOL_TYPES = new Set(['T', 'AT', 'GS', 'INS']);

/** Match every available qualifier, never a numeric installation ID or a different publication. */
function findRecord(records: readonly ContentRecord[], kinds: string[], data: Record<string, unknown>): ContentRecord | undefined {
  for (const kind of kinds) {
    const candidates = records.filter(record => {
      if (record.kind !== kind || normalize(record.name) !== normalize(string(data['name']))
        || (data['source'] && normalize(record.publication) !== normalize(string(data['source'])))) return false;
      const definition = isClassKind(record.kind) ? classDefinition(record) : undefined;
      const qualifiers: Record<string, unknown> = definition ? {
        className: definition.parent?.name, classSource: definition.parent?.source,
        subclassShortName: definition.subclass?.shortName, subclassSource: definition.subclass?.source,
        level: definition.level,
      } : record.data;
      return ['className', 'classSource', 'subclassShortName', 'subclassSource', 'level'].every(field => data[field] == null
        || normalize(String(qualifiers[field] ?? '')) === normalize(String(data[field])));
    });
    if (candidates.length) return candidates.length === 1 ? candidates[0] : undefined;
  }
  return undefined;
}

function combineSources(sheet: ExportedCharacter) {
  const sources = sheet.character!.featureSources ?? [];
  const aliases = new Map<string, string>();
  const merged = new Map<FeatureSource, FeatureSource>();
  for (const casting of sources) {
    if (!casting.name || !casting.isSpellcastingSource || casting.isGeneralFeatureSource || !/ - S$/i.test(casting.name)) continue;
    const baseName = casting.name.replace(/ - S$/i, '');
    const candidates = sources.filter(source => source !== casting && source.name === baseName);
    if (candidates.length !== 1) continue;
    const base = candidates[0];
    if (['customToHit', 'customDc'].some(field => {
      const key = field as 'customToHit' | 'customDc';
      return base[key] != null && casting[key] != null && base[key] !== casting[key];
    })) continue;
    const result = { ...casting, ...base, name: baseName };
    for (const field of ['isGeneralFeatureSource', 'isSpellcastingSource', 'useSpellbook', 'usesStrength', 'usesDexterity',
      'usesConstitution', 'usesIntelligence', 'usesWisdom', 'usesCharisma'] as const) result[field] = !!(base[field] || casting[field]);
    result.customToHit = base.customToHit ?? casting.customToHit;
    result.customDc = base.customDc ?? casting.customDc;
    merged.set(base, result); aliases.set(casting.name, baseName);
  }
  sheet.character!.featureSources = sources.filter(source => !aliases.has(source.name ?? '')).map(source => merged.get(source) ?? source);
  for (const feature of sheet.features ?? []) feature.featureSourceName = aliases.get(feature.featureSourceName ?? '') ?? feature.featureSourceName;
  for (const spell of sheet.spells ?? []) spell.castingSourceName = aliases.get(spell.castingSourceName ?? '') ?? spell.castingSourceName;
  const slots = sheet.character!.spellSlots;
  if (slots) {
    const buckets: NonNullable<typeof slots> = Object.create(null);
    for (const [name, entries] of Object.entries(slots)) {
      const target = aliases.get(name) ?? name;
      const bucket = buckets[target] ??= [];
      for (const entry of entries) {
        const same = bucket.find(slot => slot.level === entry.level && (slot.regainCondition || 'LONG_REST') === (entry.regainCondition || 'LONG_REST'));
        if (same) { same.total += entry.total; same.used = (same.used ?? 0) + (entry.used ?? 0); }
        else bucket.push(entry);
      }
    }
    sheet.character!.spellSlots = buckets;
  }
}

function mapProficiencies(sheet: ExportedCharacter, records: readonly ContentRecord[], revision?: ImportRevision) {
  const prof = sheet.character!.proficiencies;
  if (!prof) return;
  const tool = (label: string) => {
    const qualified = /^(.*?)\s+\(([^()]+)\)$/.exec(label.trim());
    const record = findRecord(records, ['item', 'baseitem'], { name: qualified?.[1] ?? label.trim(), source: qualified?.[2] });
    return record && TOOL_TYPES.has(itemTypeCode(record)) ? record : undefined;
  };
  const toolValue = (record: ContentRecord) => ({ contentKey: record.key, sourceIdentity: revision!.sourceIdentity,
    revisionId: revision!.id, snapshot: structuredClone(record) });
  const flags: Record<string, keyof Proficiencies> = { 'simple weapons': 'simpleWeapons', 'martial weapons': 'martialWeapons',
    'initiative': 'initiative', 'initiative proficiency': 'initiative', 'jack of all trades': 'jackOfAllTrades' };
  prof.custom = (prof.custom ?? []).filter(text => {
    const name = normalize(text);
    const language = LANGUAGES.get(name);
    if (language) {
      const languages = prof.languages ??= [];
      if (!languages.some(existing => normalize(existing) === normalize(language))) languages.push(language);
      return false;
    }
    if (flags[name]) { Object.assign(prof, { [flags[name]]: true }); return false; }
    const skill = SKILLS.find(skill => normalize(skill) === name.replace(/ proficiency$/, ''));
    if (skill) {
      const skills = prof.skills ??= {}; const key = skill.toUpperCase().replaceAll(' ', '_');
      if (!skills[key] || skills[key] === 'NONE') skills[key] = 'PROFICIENT';
      return false;
    }
    const save = /^(\w+) saving throws?$/.exec(name);
    if (save && ABILITIES[save[1]]) {
      const saves = prof.savingThrows ??= [];
      if (!saves.includes(ABILITIES[save[1]])) saves.push(ABILITIES[save[1]]);
      return false;
    }
    const match = revision && tool(text);
    if (match) { (prof.tools ??= {})[`${match.name} (${match.publication})`] = toolValue(match); return false; }
    return true;
  });
  if (revision) for (const [label, value] of Object.entries(prof.tools ?? {})) {
    const match = typeof value === 'number' && tool(label);
    if (match) prof.tools![label] = toolValue(match);
  }
}

/** Conversion changes provenance and structure, preserving snapshots and all authored/session values. */
export function migrateLegacyCharacter(sheet: ExportedCharacter, records: readonly ContentRecord[] = [], revision?: ImportRevision) {
  if (!isLegacyCharacterExport(sheet)) return sheet;
  let migrated = structuredClone(sheet);
  combineSources(migrated);
  mapProficiencies(migrated, records, revision);
  const linked = new Map<object, ContentRecord>();
  const link = (entry: { name?: string; source?: string; contentReference?: ReturnType<typeof contentReference> }, kinds: string[], snapshot: unknown) => {
    if (!revision || /^custom\b/i.test(entry.source ?? '')) return;
    const data = snapshot && typeof snapshot === 'object' ? snapshot as Record<string, unknown> : {};
    const record = findRecord(records, kinds, { ...data, name: data['name'] ?? entry.name, source: data['source'] ?? entry.source });
    if (record) { entry.contentReference = contentReference(record, revision); linked.set(entry, record); }
  };
  for (const feature of migrated.features ?? []) {
    const entity = feature.featureEntity;
    link(feature, feature.featEntity ? ['feat'] : feature.optionalFeatureEntity ? ['optionalfeature']
      : entity?.subclassShortName ? ['subclassFeature'] : ['classFeature'], entity ?? feature.featEntity ?? feature.optionalFeatureEntity);
  }
  for (const spell of migrated.spells ?? []) link(spell, ['spell'], spell.entity);
  for (const item of migrated.inventory ?? []) if (!item.isDummy) link(item, ['item', 'baseitem'], item.entity?.item);
  for (const monster of migrated.monsters ?? []) link(monster, ['monster'], monster.entity);
  if (migrated.species) link(migrated.species, ['species'], migrated.species.entity);
  if (revision) initializeWizard(migrated, records, revision, linked);
  migrated = normalizeCharacterEditorIdentity(migrated);
  return migrated;
}

/** Only an unambiguous single-class level can be recovered; never guess multiclass levels. */
function initializeWizard(sheet: ExportedCharacter, records: readonly ContentRecord[], revision: ImportRevision, linked: Map<object, ContentRecord>) {
  const classKeys = new Set((sheet.features ?? []).flatMap(feature => feature.featureEntity?.className
    ? [entityKey('class', { name: feature.featureEntity.className, source: feature.featureEntity.classSource })] : []));
  for (const record of records) if (record.kind === 'class' && sheet.character?.featureSources?.some(source =>
    source.name === `${record.name} (${record.publication})`)) classKeys.add(record.key);
  if (classKeys.size !== 1 || !Number.isInteger(sheet.character?.level) || sheet.character!.level! < 1 || sheet.character!.level! > 20) return;
  const parent = records.find(record => record.kind === 'class' && classKeys.has(record.key));
  if (!parent) return;
  const sources = sheet.character!.featureSources ?? [];
  const parentSource = sources.find(source => source.name === `${parent.name} (${parent.publication})`);
  const subclasses = records.filter(record => record.kind === 'subclass'
    && classDefinition(record).parent?.key === parent.key
    && sources.some(source => source.name === `${record.name} (${record.publication})`));
  const subclass = subclasses.length === 1 ? subclasses[0] : undefined;
  const selectionId = wizardEditorId('imported-class', sheet.character!.characterUuid ?? '', parent.key);
  const state: NonNullable<ExportedCharacter['creatorWizard']> = { revisionId: revision.id,
    classes: [{ selectionId, classKey: parent.key, level: sheet.character!.level!,
      ...(subclass ? { subclassKey: subclass.key } : {}), useSpellbook: parentSource?.useSpellbook ?? false }],
    ...(sheet.species?.contentReference ? { speciesKey: sheet.species.contentReference.key } : {}),
    answers: {}, options: {}, baseline: [], protectedPaths: [] };
  const adopt = (entry: { editorId?: string }, id: string, path: string[], scope: string, label: string, owned = true) => {
    entry.editorId = id;
    if (owned) state.baseline.push(createWizardBaseline({ path, scope, label, value: entry }));
  };
  for (const owner of [parent, ...(subclass ? [subclass] : [])]) {
    const source = sources.find(source => source.name === `${owner.name} (${owner.publication})`);
    if (!source) continue;
    const id = wizardEditorId('source', revision.sourceIdentity, selectionId, owner.key);
    adopt(source, id, ['sources', id], 'sources', `${source.name} source`,
      source.userAdded !== true && source.customDc == null && source.customToHit == null);
  }
  if (state.speciesKey && sheet.species) {
    const candidates = sources.filter(source => source.isSpellcastingSource && source.name?.startsWith(`${sheet.species!.name} (`));
    if (candidates.length === 1) {
      const id = wizardEditorId('species-source', revision.sourceIdentity, state.speciesKey);
      // A lineage's chosen ability cannot be recovered from a generic species record.
      adopt(candidates[0], id, ['sources', id], 'species', `${candidates[0].name} source`, false);
    }
  }
  for (const feature of sheet.features ?? []) {
    const record = linked.get(feature);
    if (!record || feature.userAdded !== false || !['classFeature', 'subclassFeature'].includes(record.kind)) continue;
    const owner = record.kind === 'classFeature' ? parent : subclass;
    if (!owner || feature.featureSourceName !== `${owner.name} (${owner.publication})`) continue;
    const id = wizardEditorId('feature', revision.sourceIdentity, selectionId, record.key);
    adopt(feature, id, ['features', id], 'features', feature.name);
  }
  for (const spell of sheet.spells ?? []) if (spell.userAdded === false && linked.has(spell)) {
    const id = wizardEditorId('spell', revision.sourceIdentity, spell.castingSourceName ?? '', linked.get(spell)!.key, spell.listType ?? 'KNOWN');
    // Old exports do not identify which grant/choice created a spell. Reuse its identity,
    // but do not claim ownership and later delete it when a choice cannot be recovered.
    spell.editorId = id;
  }
  if (sheet.species?.contentReference && sheet.species.userAdded !== true) {
    adopt(sheet.species, wizardEditorId('species', revision.sourceIdentity, sheet.species.contentReference.key), ['species'], 'species', sheet.species.name ?? 'Species');
  }
  state.baseline.push(createWizardBaseline({ path: ['character', 'level'], scope: 'level', label: 'Character level', value: sheet.character!.level }));
  for (const [name, slots] of Object.entries(sheet.character!.spellSlots ?? {})) {
    if (!sources.some(source => source.name === name && [parent, ...(subclass ? [subclass] : [])].some(owner =>
      source.editorId === wizardEditorId('source', revision.sourceIdentity, selectionId, owner.key)))) continue;
    for (const slot of slots) if (slot.userAdded !== true && slots.filter(other => other.level === slot.level).length === 1) {
      state.baseline.push(createWizardBaseline({ path: ['slots', name, String(slot.level)], scope: 'spells', label: `${name}: level ${slot.level} slots`, value: slot }));
    }
  }
  if (Array.isArray(sheet.character!.hitDice)) for (const die of sheet.character!.hitDice) {
    if (die.userAdded !== true) state.baseline.push(createWizardBaseline({ path: ['dice', die.dieType], scope: 'dice', label: `${die.dieType} hit dice`, value: die }));
  }
  sheet.creatorWizard = state;
}

/** Use only the active installed library; imports also work offline without any game data. */
export async function migrateLegacyCharacterExport(sheet: ExportedCharacter): Promise<ExportedCharacter> {
  if (!isLegacyCharacterExport(sheet)) return sheet;
  const cache = new IndexedDbContentCache();
  const revision = typeof indexedDB !== 'undefined' ? await activeContentRevision(cache) : undefined;
  const records: ContentRecord[] = [];
  if (revision) {
    const names = new Set([...(sheet.features ?? []), ...(sheet.spells ?? []), ...(sheet.inventory ?? []), ...(sheet.monsters ?? []), ...(sheet.objects ?? []),
      ...(sheet.species ? [sheet.species] : [])].map(entry => normalize(entry.name ?? '')));
    for (const text of [...(sheet.character?.proficiencies?.custom ?? []), ...Object.keys(sheet.character?.proficiencies?.tools ?? {})]) {
      names.add(normalize(text.replace(/\s+\([^()]+\)$/, '')));
    }
    await cache.visit(revision.id, async record => {
      if (['class', 'subclass'].includes(record.kind) || names.has(normalize(record.name))) records.push(record);
    });
  }
  return migrateLegacyCharacter(sheet, records, revision);
}
