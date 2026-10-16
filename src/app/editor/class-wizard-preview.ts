import { updateSpeciesChoiceNotes } from './species-choice-notes';
import { capitalizeFirst } from '../text';
import { wizardEditorId } from './editor-identity';
import { ContentRecord, ImportRevision, entityKey, normalize, object, string } from '../content/content.model';
import { ExportedCharacter, FeatureSource, SpellEntryFull } from '../models/character.model';
import { ContentRulesIndex, deriveClassFeatures } from '../rules/feature-rules';
import { deriveLevelRules } from '../rules/level-rules';
import { deriveProficiencyGrants } from '../rules/proficiency-rules';
import { deriveOptionalSlots } from '../rules/optional-progression';
import { deriveSpellGrants, SpellGrantOwner } from '../rules/spell-rules';
import { deriveSpecies } from '../rules/species-rules';
import { DEFENSE_ABILITIES } from './basic-info';
import { spellClasses, spellSnapshot } from './spell-selection';
import { PrefillValue, WizardState, mergeWizardPrefill } from './wizard-prefill';
import { averageClassHp, contentReference, sourceAbilityFlags, speciesSnapshot, spellUseTrackers } from './editor-content-helpers';
import { isCompleteSelection } from '../rules/spell-choice';
import { createFeatureEntry } from './feature-selection';

export interface WizardChoice { ownerKey?: string; id: string; label: string; count: number; searchable?: boolean; candidates: { value: string; label: string }[]; }
export const WIZARD_SECTIONS = [
  { key: 'level', label: 'Level' }, { key: 'hp', label: 'Maximum HP' }, { key: 'dice', label: 'Hit Dice' },
  { key: 'proficiencies', label: 'Proficiencies' }, { key: 'features', label: 'Features' },
  { key: 'spells', label: 'Spells & Slots' }, { key: 'species', label: 'Species & Movement' },
];
/** Metadata such as a casting ability alone does not grant spells. */
function hasAdditionalSpells(record: ContentRecord): boolean {
  const blocks = record.data['additionalSpells'];
  return Array.isArray(blocks) && blocks.some(block => {
    const data = object(block);
    return ['known', 'prepared', 'innate', 'expanded'].some(key => {
      const grants = object(data?.[key]);
      return grants != null && Object.keys(grants).length > 0;
    });
  });
}

/** An explicit casting ability also declares a source, even without a spell list. */
function declaresSpellcasting(record: ContentRecord): boolean {
  return !!string(record.data['spellcastingAbility']).trim() || hasAdditionalSpells(record);
}

export function matchesSubclass(record: ContentRecord, classKey: string) {
  return record.kind === 'subclass' && entityKey('class', { name: record.data['className'], source: record.data['classSource'] }) === classKey;
}

/**
 * Build a detached proposal in four passes: classes/resources, features/species,
 * proficiency and spell choices, then merge with the sheet's manual edits.
 * Rules read structured imported data; they do not interpret description text.
 */
export function previewClassWizard(sheet: ExportedCharacter, state: WizardState, revision: ImportRevision,
  records: ReadonlyMap<string, ContentRecord>, sourceBooks: readonly string[] = []) {
  const index: ContentRulesIndex = { records, sourceIdentity: revision.sourceIdentity, revisionId: revision.id };
  const values: PrefillValue[] = []; const choices: WizardChoice[] = []; const warnings: string[] = []; const errors: string[] = [];
  const put = (scope: string, label: string, path: string[], value: unknown) => values.push({ scope, label, path, value });
  const features = deriveClassFeatures(state.classes, index);
  errors.push(...features.diagnostics.map(issue => issue.message));
  const sourceNames = new Map<string, string>();
  const spellLevels = new Map<string, number>();
  const owners: { owner: SpellGrantOwner; label: string; source: string }[] = [];
  const spells = new Map<string, SpellEntryFull>();
  const reference = (record: ContentRecord) => contentReference(record, revision);
  // Stable IDs let later wizard runs update their own entries without claiming manual ones.
  const source = (id: string, name: string, data: Partial<FeatureSource>, scope = 'sources') => {
    const existing = sheet.character?.featureSources?.find(entry => entry.editorId === id);
    const label = existing?.name || name;
    put(scope, `${label} source`, ['sources', id], { editorId: id, name: label, userAdded: false, ...data });
    return label;
  };
  const addSpell = (record: ContentRecord, castingSourceName: string, listType = 'KNOWN', uses: SpellEntryFull['uses'] = []) => {
    const id = wizardEditorId('spell', revision.sourceIdentity, castingSourceName, record.key, listType);
    const entry = spells.get(id) ?? { editorId: id, name: record.name, source: record.publication,
      castingSourceName, listType, userAdded: false, entity: spellSnapshot(record), contentReference: reference(record), notes: [], uses: [] };
    entry.uses!.push(...uses.filter(use => !entry.uses!.some(old => old.tag === use.tag)));
    spells.set(id, entry);
  };
  const addOwner = (selectionId: string, record: ContentRecord, level: number, castingSource: string, fallback: string, maxSpellLevel: number) => {
    // A class, subclass, feature or species can independently define additionalSpells.
    // Register its ability/block choices now; resolve actual spell choices in pass 3.
    if (!hasAdditionalSpells(record)) return;
    const blocks = record.data['additionalSpells'];
    const blockId = `blocks:${selectionId}:${record.key}`;
    let selectedBlocks: number[] | undefined;
    if (Array.isArray(blocks) && blocks.length > 1) {
      choices.push({ ownerKey: record.key, id: blockId, label: `${record.name}: spell options`, count: 1,
        candidates: blocks.map((block, position) => ({ value: String(position), label: string(object(block)?.['name'], `Option ${position + 1}`) })) });
      selectedBlocks = (state.answers[blockId] ?? []).map(Number);
    }
    const abilityId = `ability:${selectionId}:${record.key}`;
    const abilityOptions = Array.isArray(blocks) ? blocks.flatMap(block => {
      const choose = object(object(block)?.['ability'])?.['choose']; return Array.isArray(choose) ? choose : [];
    }).filter((ability): ability is string => typeof ability === 'string') : [];
    if (abilityOptions.length) choices.push({ ownerKey: record.key, id: abilityId, label: `${record.name}: casting ability`, count: 1,
      candidates: [...new Set(abilityOptions)].map(value => ({ value, label: DEFENSE_ABILITIES.find(ability => ability.key.startsWith(value))?.label ?? value })) });
    const owner: SpellGrantOwner = { selectionId, ownerKey: record.key, level, maxSpellLevel,
      ability: (state.answers[abilityId]?.[0] ?? string(record.data['spellcastingAbility'], fallback)) || undefined,
      ...(selectedBlocks ? { blocks: selectedBlocks } : {}) };
    owners.push({ owner, label: record.name, source: castingSource });
    const sourceValue = values.find(entry => entry.path[0] === 'sources' && (entry.value as FeatureSource).name === castingSource)?.value as FeatureSource | undefined;
    if (sourceValue) {
      sourceValue.isSpellcastingSource = true;
      const selected = selectedBlocks ?? (Array.isArray(blocks) ? blocks.map((_, position) => position) : []);
      const castingAbilities = new Set([owner.ability, ...selected.map(position => string(object((blocks as unknown[])[position])?.['ability']))]);
      for (const ability of DEFENSE_ABILITIES) if (castingAbilities.has(ability.key.slice(0, 3))) {
        Object.assign(sourceValue, { [`uses${ability.label}`]: true });
      }
    }
  };
  // 1. Classes determine sources, average HP, hit dice and available spell levels.
  let maxHp = 0;
  const conModifier = Math.floor(((sheet.character?.abilityScores?.constitution ?? 10) - 10) / 2);
  const normalCasters = features.classInputs.filter(entry => entry.caster !== 'none' && entry.caster !== 'pact');
  for (const [position, selection] of state.classes.entries()) {
    const parent = records.get(selection.classKey); if (!parent) continue;
    const subclass = selection.subclassKey ? records.get(selection.subclassKey) : undefined;
    const classInput = features.classInputs.find(entry => entry.selectionId === selection.selectionId); if (!classInput) continue;
    const castingRecord = parent.data['casterProgression'] || parent.data['spellcastingAbility'] ? parent : subclass ?? parent;
    const castingAbility = string(castingRecord.data['spellcastingAbility']);
    const parentId = wizardEditorId('source', revision.sourceIdentity, selection.selectionId, parent.key);
    const parentName = source(parentId, `${parent.name} (${parent.publication})`, {
      isGeneralFeatureSource: true, isSpellcastingSource: (castingRecord === parent && classInput.caster !== 'none') || declaresSpellcasting(parent),
      useSpellbook: selection.useSpellbook ?? false, ...sourceAbilityFlags(parent),
    });
    sourceNames.set(`${selection.selectionId}:${parent.key}`, parentName);
    let castingSource = parentName;
    if (subclass) {
      const name = source(wizardEditorId('source', revision.sourceIdentity, selection.selectionId, subclass.key),
        `${subclass.name} (${subclass.publication})`, { isGeneralFeatureSource: true,
          isSpellcastingSource: (castingRecord === subclass && classInput.caster !== 'none') || declaresSpellcasting(subclass),
          useSpellbook: castingRecord === subclass && (selection.useSpellbook ?? false), ...sourceAbilityFlags(subclass, castingAbility) });
      sourceNames.set(`${selection.selectionId}:${subclass.key}`, name);
      if (castingRecord === subclass) castingSource = name;
    }
    const singleLevel = deriveLevelRules({ classes: [classInput], constitution: 10, manualMaxHp: 0,
      applyHp: false, applyHitDice: false, manualPools: [] }, { currentHp: 0, annotations: {}, resources: {} });
    const maxSpellLevel = Math.max(0, ...singleLevel.pools.filter(pool => pool.kind === 'spell-slots').map(pool => pool.rank));
    spellLevels.set(selection.selectionId, maxSpellLevel);
    maxHp += averageClassHp(classInput.hitDie, selection.level, conModifier, position === 0);
    for (const owner of [parent, ...(subclass ? [subclass] : [])]) {
      addOwner(selection.selectionId, owner, selection.level, sourceNames.get(`${selection.selectionId}:${owner.key}`)!, castingAbility, maxSpellLevel);
    }
    if (selection.spellList && classInput.caster !== 'none') for (const record of records.values()) {
      if (record.kind !== 'spell' || (sourceBooks.length && !sourceBooks.includes(record.publication))
        || Number(record.data['level']) > maxSpellLevel) continue;
      if (spellClasses(record.data).some(entry => normalize(entry.name) === normalize(selection.spellList!))) addSpell(record, castingSource);
    }
  }
  if (!errors.length) {
    const levels = deriveLevelRules({ classes: features.classInputs, constitution: 10, manualMaxHp: 0,
      applyHp: false, applyHitDice: true, manualPools: [] }, { currentHp: 0, annotations: {}, resources: {} });
    put('level', 'Character level', ['character', 'level'], levels.totalLevel);
    put('hp', 'Maximum HP', ['character', 'maxHp'], Math.max(0, maxHp));
    if (maxHp < 0) warnings.push('This Constitution score gives a negative HP calculation; the proposal uses zero. Set your intended HP manually.');
    let sharedSource = '';
    if (normalCasters.length > 1) sharedSource = source(wizardEditorId('shared-source', revision.sourceIdentity), 'Shared Spellcasting', { isSpellcastingSource: true });
    for (const pool of levels.pools) {
      if (pool.kind === 'hit-dice') put('dice', `d${pool.rank} hit dice`, ['dice', `d${pool.rank}`], { dieType: `d${pool.rank}`, total: pool.total, used: 0, userAdded: false });
      else {
        const origin = state.classes.find(selection => pool.origins.includes(selection.selectionId))!;
        const parent = records.get(origin.classKey)!;
        const owner = parent.data['casterProgression'] || !origin.subclassKey ? parent : records.get(origin.subclassKey)!;
        const name = pool.regain === 'LONG_REST' && sharedSource ? sharedSource : sourceNames.get(`${origin.selectionId}:${owner.key}`)!;
        put('spells', `${name}: level ${pool.rank} slots`, ['slots', name, String(pool.rank)], { level: pool.rank, total: pool.total, used: 0, regainCondition: pool.regain, userAdded: false });
      }
    }
  }
  // 2. Copy feature/species snapshots and register any spell definitions they own.
  for (const instance of features.instances) {
    const record = instance.snapshot; const grant = instance.grants[0];
    const sourceName = sourceNames.get(`${grant.selectionId}:${grant.ownerKey}`)!;
    const id = wizardEditorId('feature', revision.sourceIdentity, grant.selectionId, record.key);
    put('features', record.name, ['features', id], createFeatureEntry(record, revision, {
      editorId: id, sourceName, userAdded: false,
    }));
    const selection = state.classes.find(entry => entry.selectionId === grant.selectionId)!;
    addOwner(grant.selectionId, record, selection.level, sourceName,
      string(records.get(selection.classKey)?.data['spellcastingAbility']), spellLevels.get(grant.selectionId) ?? 0);
  }
  const optional = deriveOptionalSlots(state.classes, index, state.answers);
  warnings.push(...optional.diagnostics);
  for (const slot of optional.slots) {
    const owner = records.get(slot.ownerKey)!;
    const candidates = [...records.values()].filter(record => record.kind === 'optionalfeature'
      && Array.isArray(record.data['featureType']) && record.data['featureType'].some(type => slot.featureTypes.includes(String(type)))
      && (!sourceBooks.length || sourceBooks.includes(record.publication)));
    choices.push({ id: slot.id, label: `${owner.name}: optional features`, count: slot.count,
      candidates: candidates.map(record => ({ value: record.key, label: `${record.name} (${record.publication})` })) });
    for (const key of slot.selectedKeys) {
      const record = candidates.find(entry => entry.key === key); if (!record) continue;
      const id = wizardEditorId('optional-feature', revision.sourceIdentity, slot.selectionId, slot.id, key);
      const sourceName = sourceNames.get(`${slot.selectionId}:${slot.ownerKey}`)!;
      put('features', record.name, ['features', id], createFeatureEntry(record, revision, {
        editorId: id, sourceName, userAdded: false,
      }));
      addOwner(slot.selectionId, record, state.classes.find(entry => entry.selectionId === slot.selectionId)!.level, sourceName, '', spellLevels.get(slot.selectionId) ?? 0);
    }
  }
  if (state.speciesKey) {
    const record = records.get(state.speciesKey);
    if (!record || record.kind !== 'species') errors.push('The selected species is missing from this import.');
    else {
      const species = deriveSpecies({ id: 'wizard-species', key: record.key }, index, [], undefined, state.answers);
      choices.push(...species.choices.map(choice => ({ ownerKey: record.key, id: choice.id, label: `${record.name}: resistance`,
        count: choice.count, searchable: false,
        candidates: choice.candidates.map(value => ({ value, label: capitalizeFirst(value) })) })));
      warnings.push(...species.diagnostics);
      put('species', `${record.name} species`, ['species'], { editorId: wizardEditorId('species', revision.sourceIdentity, record.key), name: record.name, source: record.publication,
        userAdded: false, contentReference: reference(record), entity: speciesSnapshot(record), notes: [], uses: [] });
      for (const contribution of species.generated) {
        const value = object(contribution.value);
        if (contribution.field === 'speed') put('species', `${value!['mode']} speed`, ['character', 'speeds', String(value!['mode'])], value!['number']);
        if (contribution.field === 'sense') put('species', `${value!['sense']} sense`, ['character', 'senses', capitalizeFirst(String(value!['sense']))], value!['range']);
        if (contribution.field === 'resist' && typeof contribution.value === 'string') put('species', `${contribution.value} resistance`, ['resistances', capitalizeFirst(contribution.value)], capitalizeFirst(contribution.value));
      }
      // Species already have their own feature section; only spell grants need a source.
      if (declaresSpellcasting(record)) {
        const name = source(wizardEditorId('species-source', revision.sourceIdentity, record.key), `${record.name} (${record.publication})`, {
          isGeneralFeatureSource: false, isSpellcastingSource: true, ...sourceAbilityFlags(record) }, 'species');
        addOwner('wizard-species', record, state.classes.reduce((sum, entry) => sum + entry.level, 0), name, '', 9);
      }
      if (record.data['ability']) warnings.push('Species ability-score options remain editable on Ability Scores; this prefill preserves your current scores.');
    }
  }
  // 3. Rule handlers expose candidates and validate answers before producing sheet entries.
  const proficiencies = deriveProficiencyGrants(state.classes, index, state.answers, state.speciesKey, [], {}, sourceBooks);
  warnings.push(...proficiencies.diagnostics.filter(message => !message.startsWith('Select ')));
  choices.push(...proficiencies.choices.map(choice => ({ ownerKey: choice.ownerKey, id: choice.id, label: `${records.get(choice.ownerKey)?.name ?? 'Character'}: ${choice.kind} proficiencies`, count: choice.count, searchable: false,
    candidates: choice.candidates.map(value => ({ value, label: records.has(value) ? `${records.get(value)!.name} (${records.get(value)!.publication})` : value })) })));
  choices.push(...proficiencies.packages.map(choice => ({ ownerKey: choice.ownerKey, id: choice.id, label: `${records.get(choice.ownerKey)?.name ?? 'Character'}: ${choice.kind} options`, count: 1, searchable: false,
    candidates: choice.options.map(option => ({ value: option.value, label: `Option ${Number(option.value) + 1}: ${Object.keys(option.data).join(', ')}` })) })));
  for (const entry of proficiencies.generated) {
    if (entry.kind === 'save') put('proficiencies', `${entry.target.toUpperCase()} saving throw`, ['saves', entry.target.toUpperCase()], entry.target.toUpperCase());
    else if (entry.kind === 'skill') put('proficiencies', `${entry.target} proficiency`, ['character', 'proficiencies', 'skills', entry.target.toUpperCase().replace(/\s+/g, '_')], entry.rank === 2 ? 'EXPERTISE' : entry.rank === .5 ? 'HALF' : 'PROFICIENT');
    else if (entry.kind === 'weapon' && ['simple', 'martial'].includes(entry.target)) put('proficiencies', `${entry.target} weapons`, ['character', 'proficiencies', `${entry.target}Weapons`], true);
    else if (entry.kind === 'language') put('proficiencies', `${entry.target} language`, ['languages', capitalizeFirst(entry.target)], capitalizeFirst(entry.target));
    else if (entry.kind === 'tool') {
      const record = records.get(entry.target);
      const label = record ? `${record.name} (${record.publication})` : capitalizeFirst(entry.target);
      put('proficiencies', `${label} tool`, ['character', 'proficiencies', 'tools', label], record ? {
        contentKey: record.key, sourceIdentity: revision.sourceIdentity, revisionId: revision.id, snapshot: structuredClone(record),
      } : true);
    } else {
      const label = records.get(entry.target)?.name ?? capitalizeFirst(entry.kind === 'weapon' ? entry.target : `${entry.target} ${entry.kind}`);
      put('proficiencies', label, ['custom', label], label);
    }
  }
  for (const { owner, label, source: sourceName } of owners) {
    const result = deriveSpellGrants([owner], index, [], state.answers);
    warnings.push(...result.diagnostics.filter(message => !message.includes('Select ') && !message.includes('Choose additionalSpells'))
      .map(message => `${label}: ${message}`));
    choices.push(...result.choices.map(choice => ({ ownerKey: owner.ownerKey, id: choice.id, label: `${label}: spells`, count: choice.count,
      candidates: choice.candidates.map(value => ({ value, label: `${records.get(value)?.name} (${records.get(value)?.publication})` })) })));
    for (const expanded of result.expanded) addSpell(records.get(expanded.contentKey)!, sourceName);
    for (const instance of result.instances) {
      const uses = spellUseTrackers(instance.grants, label);
      addSpell(instance.snapshot, sourceName);
      // Explicit additionalSpells grants are usable spells, including known cantrips such
      // as Arcane Trickster's Mage Hand. Expanded lists above only provide eligibility.
      addSpell(instance.snapshot, sourceName, 'PREPARED', uses);
    }
  }
  for (const [id, entry] of spells) put('spells', `${entry.name}: ${entry.listType?.toLowerCase()}`, ['spells', id], entry);
  const uniqueChoices = [...new Map(choices.map(choice => [choice.id, choice])).values()];
  const unresolved = uniqueChoices.filter(choice => {
    const answer = state.answers[choice.id] ?? [];
    return !isCompleteSelection(answer, choice.count, choice.candidates.map(candidate => candidate.value));
  });
  // 4. Reconcile with the last baseline. Manual changes and annotations take precedence.
  const proposal = mergeWizardPrefill(sheet, state, values);
  // Notes follow the species that was actually applied, not a manually retained different species.
  if (state.options['species'] !== false && state.speciesKey
    && proposal.sheet.species?.contentReference?.key === state.speciesKey) {
    updateSpeciesChoiceNotes(proposal.sheet.species,
      uniqueChoices.filter(choice => choice.ownerKey === state.speciesKey), state.answers);
  }
  return { ...proposal, errors: [...new Set(errors)], warnings: [...new Set(warnings)], choices: uniqueChoices, unresolved,
    summary: { level: state.classes.reduce((sum, entry) => sum + entry.level, 0), maxHp: Math.max(0, maxHp),
      features: values.filter(entry => entry.path[0] === 'features').length, spells: spells.size } };
}
