import { additionalSpells, SPELL_GRANT_LISTS } from '../content/additional-spells';
import { spellDefinition, spellRecordClasses } from '../content/spell-adapter';
import { characterOption, characterOptionSourceData } from '../content/character-option-adapter';
import { castingMetadata, classDefinition } from '../content/class-adapter';
import { subclassMatchesClass, usesLegacySubclass } from '../content/class-compatibility';
import { updateSpeciesChoiceNotes } from './species-choice-notes';
import { capitalizeFirst } from '../text';
import { wizardEditorId } from './editor-identity';
import { ContentRecord, ImportRevision, normalize, object } from '../content/content.model';
import { ExportedCharacter, FeatureSource, SpellEntryFull } from '../models/character.model';
import { ContentRulesIndex, deriveClassFeatures } from '../rules/feature-rules';
import { deriveLevelRules } from '../rules/level-rules';
import { deriveProficiencyGrants } from '../rules/proficiency-rules';
import { deriveOptionalSlots } from '../rules/optional-progression';
import { deriveSpellGrants, SpellGrantOwner } from '../rules/spell-rules';
import { deriveSpecies } from '../rules/species-rules';
import { speciesDefinition } from '../content/species-adapter';
import { speciesSpeedEntries } from '../content/species-speed-projection';
import { sizeName } from '../size-names';
import { DEFENSE_ABILITIES } from './basic-info';
import { spellSnapshot } from './spell-selection';
import { PrefillValue, WizardState, mergeWizardPrefill } from './wizard-prefill';
import { averageClassHp, contentReference, sourceAbilityFlags, speciesSnapshot, spellUseTrackers } from './editor-content-helpers';
import { isCompleteSelection } from '../rules/spell-choice';
import { createFeatureEntry } from './feature-selection';

export interface WizardChoice { ownerKey?: string; scope?: 'features' | 'spells' | 'species' | 'proficiencies'; id: string; label: string; count: number; searchable?: boolean; candidates: { value: string; label: string }[]; }
export interface WizardHpContribution { label: string; level: number; hitDie: number; starting: boolean; constitutionModifier: number; total: number; }
export const WIZARD_SECTIONS = [
  { key: 'hp', label: 'Maximum HP' }, { key: 'dice', label: 'Hit Dice' },
  { key: 'proficiencies', label: 'Proficiencies' }, { key: 'features', label: 'Features' },
  { key: 'spells', label: 'Spells & Slots' }, { key: 'species', label: 'Species & Movement' },
];
/** Metadata such as a casting ability alone does not grant spells. */
function hasAdditionalSpells(record: ContentRecord): boolean {
  return additionalSpells(record)?.some(block => SPELL_GRANT_LISTS.some(key => block[key] !== undefined)) ?? false;
}

/** An explicit casting ability also declares a source, even without a spell list. */
function declaresSpellcasting(record: ContentRecord): boolean {
  return !!castingMetadata(record).ability || hasAdditionalSpells(record);
}

export function matchesSubclass(record: ContentRecord, classKey: string, records?: ReadonlyMap<string, ContentRecord>) {
  const parent = records?.get(classKey);
  return parent ? subclassMatchesClass(record, parent)
    : record.kind === 'subclass' && classDefinition(record).parent?.key === classKey;
}

/**
 * Build a detached proposal in four passes: classes/resources, features/species,
 * proficiency and spell choices, then merge with the sheet's manual edits.
 * Rules read structured imported data; they do not interpret description text.
 */
export function previewClassWizard(sheet: ExportedCharacter, state: WizardState, revision: ImportRevision,
  records: ReadonlyMap<string, ContentRecord>, sourceBooks: readonly string[] = [], overrideSections: readonly string[] = []) {
  const index: ContentRulesIndex = { records, sourceIdentity: revision.sourceIdentity, revisionId: revision.id };
  const values: PrefillValue[] = []; const choices: WizardChoice[] = []; const warnings: string[] = []; const errors: string[] = [];
  const put = (scope: string, label: string, path: string[], value: unknown, origin?: string) => values.push({ scope, label, path, value, origin });
  const features = deriveClassFeatures(state.classes, index, [], [], state.answers);
  errors.push(...features.diagnostics.map(issue => issue.message));
  choices.push(...features.choices.map(choice => ({ id: choice.id, ownerKey: choice.ownerKey, scope: 'features' as const,
    label: choice.label, count: choice.count, candidates: choice.candidates })));
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
    const blocks = additionalSpells(record)!;
    const blockId = `blocks:${selectionId}:${record.key}`;
    let selectedBlocks: number[] | undefined;
    if (blocks.length > 1) {
      choices.push({ scope: 'spells', ownerKey: record.key, id: blockId, label: `${record.name}: spell options`, count: 1,
        candidates: blocks.map((block, position) => ({ value: String(position), label: block.name ?? `Option ${position + 1}` })) });
      selectedBlocks = (state.answers[blockId] ?? []).map(Number);
    }
    const abilityId = `ability:${selectionId}:${record.key}`;
    const abilityOptions = blocks.flatMap(block => typeof block.ability === 'object' ? block.ability.choose : []);
    if (abilityOptions.length) choices.push({ scope: 'spells', ownerKey: record.key, id: abilityId, label: `${record.name}: casting ability`, count: 1,
      candidates: [...new Set(abilityOptions)].map(value => ({ value, label: DEFENSE_ABILITIES.find(ability => ability.key.startsWith(value))?.label ?? value })) });
    const owner: SpellGrantOwner = { selectionId, ownerKey: record.key, level, maxSpellLevel,
      ability: (state.answers[abilityId]?.[0] ?? (castingMetadata(record).ability ?? fallback)) || undefined,
      ...(selectedBlocks ? { blocks: selectedBlocks } : {}) };
    owners.push({ owner, label: record.name, source: castingSource });
    const sourceValue = values.find(entry => entry.path[0] === 'sources' && (entry.value as FeatureSource).name === castingSource)?.value as FeatureSource | undefined;
    if (sourceValue) {
      sourceValue.isSpellcastingSource = true;
      const selected = selectedBlocks ?? blocks.map((_, position) => position);
      const castingAbilities = new Set([owner.ability, ...selected.map(position => typeof blocks[position]?.ability === 'string' ? blocks[position].ability : undefined)]);
      for (const ability of DEFENSE_ABILITIES) if (castingAbilities.has(ability.key.slice(0, 3))) {
        Object.assign(sourceValue, { [`uses${ability.label}`]: true });
      }
    }
  };
  // 1. Classes determine sources, average HP, hit dice and available spell levels.
  let maxHp = 0;
  const hpContributions: WizardHpContribution[] = [];
  const conModifier = Math.floor(((sheet.character?.abilityScores?.constitution ?? 10) - 10) / 2);
  const normalCasters = features.classInputs.filter(entry => entry.caster !== 'none' && entry.caster !== 'pact');
  for (const [position, selection] of state.classes.entries()) {
    const parent = records.get(selection.classKey); if (!parent) continue;
    const subclass = selection.subclassKey ? records.get(selection.subclassKey) : undefined;
    const classInput = features.classInputs.find(entry => entry.selectionId === selection.selectionId); if (!classInput) continue;
    const castingRecord = castingMetadata(parent).progression || castingMetadata(parent).ability ? parent : subclass ?? parent;
    const castingAbility = castingMetadata(castingRecord).ability ?? '';
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
    const total = averageClassHp(classInput.hitDie, selection.level, conModifier, position === 0);
    maxHp += total;
    hpContributions.push({ label: `${parent.name} (${parent.publication})`, level: selection.level,
      hitDie: classInput.hitDie, starting: position === 0, constitutionModifier: conModifier, total });
    for (const owner of [parent, ...(subclass ? [subclass] : [])]) {
      if (owner.kind === 'subclass' && usesLegacySubclass(parent, owner) && selection.level < 3) continue;
      addOwner(selection.selectionId, owner, selection.level, sourceNames.get(`${selection.selectionId}:${owner.key}`)!, castingAbility, maxSpellLevel);
    }
    if (selection.spellList && classInput.caster !== 'none') for (const record of records.values()) {
      if (record.kind !== 'spell' || (sourceBooks.length && !sourceBooks.includes(record.publication))
        || spellDefinition(record).level > maxSpellLevel) continue;
      if (spellRecordClasses(record).some(entry => normalize(entry.name) === normalize(selection.spellList!))) addSpell(record, castingSource);
    }
  }
  if (!errors.length) {
    const levels = deriveLevelRules({ classes: features.classInputs, constitution: 10, manualMaxHp: 0,
      applyHp: false, applyHitDice: true, manualPools: [] }, { currentHp: 0, annotations: {}, resources: {} });
    put('level', 'Character level', ['character', 'level'], levels.totalLevel);
    put('hp', 'Maximum HP', ['character', 'maxHp'], Math.max(0, maxHp));
    if (state.options['hp'] !== false && maxHp < 0) warnings.push('This Constitution score gives a negative HP calculation; the proposal uses zero. Set your intended HP manually.');
    let sharedSource = '';
    if (normalCasters.length > 1) sharedSource = source(wizardEditorId('shared-source', revision.sourceIdentity), 'Shared Spellcasting', { isSpellcastingSource: true });
    for (const pool of levels.pools) {
      if (pool.kind === 'hit-dice') put('dice', `d${pool.rank} hit dice`, ['dice', `d${pool.rank}`], { dieType: `d${pool.rank}`, total: pool.total, used: 0, userAdded: false });
      else {
        const origin = state.classes.find(selection => pool.origins.includes(selection.selectionId))!;
        const parent = records.get(origin.classKey)!;
        const owner = castingMetadata(parent).progression || !origin.subclassKey ? parent : records.get(origin.subclassKey)!;
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
    const feature = createFeatureEntry(record, revision, {
      editorId: id, sourceName, userAdded: false,
    });
    if (grant.level !== undefined && feature.featureEntity) {
      feature.acquiredAtLevel = grant.level;
      feature.featureEntity.level = grant.level;
    }
    put('features', record.name, ['features', id], feature);
    const selection = state.classes.find(entry => entry.selectionId === grant.selectionId)!;
    addOwner(grant.selectionId, record, selection.level, sourceName,
      castingMetadata(records.get(selection.classKey)).ability ?? '', spellLevels.get(grant.selectionId) ?? 0);
  }
  const optional = deriveOptionalSlots(state.classes, index, state.answers);
  if (state.options['features'] !== false) warnings.push(...optional.diagnostics);
  for (const slot of optional.slots) {
    const owner = records.get(slot.ownerKey)!;
    const candidates = [...records.values()].filter(record => record.kind === 'optionalfeature'
      && characterOption(record).featureTypes.some(type => slot.featureTypes.includes(type))
      && (!sourceBooks.length || sourceBooks.includes(record.publication)));
    choices.push({ scope: 'features', ownerKey: owner.key, id: slot.id, label: `${owner.name}: optional features`, count: slot.count,
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
      choices.push(...species.choices.map(choice => ({ scope: 'species' as const, ownerKey: record.key, id: choice.id, label: `${record.name}: ${choice.label}`,
        count: choice.count, searchable: false,
        candidates: choice.candidates.map(value => ({ value, label: choice.label === 'size' ? sizeName(value) : capitalizeFirst(value) })) })));
      if (state.options['species'] !== false) { warnings.push(...species.diagnostics); warnings.push(...species.warnings); }
      put('species', `${record.name} species`, ['species'], { editorId: wizardEditorId('species', revision.sourceIdentity, record.key), name: record.name, source: record.publication,
        userAdded: false, contentReference: reference(record), entity: speciesSnapshot(record), notes: [], uses: [] });
      for (const contribution of species.generated) {
        const value = object(contribution.value);
        if (contribution.field === 'sense') put('species', `${value!['sense']} sense`, ['character', 'senses', capitalizeFirst(String(value!['sense']))], value!['range']);
        if (contribution.field === 'resist' && typeof contribution.value === 'string') put('species', `${contribution.value} resistance`, ['resistances', capitalizeFirst(contribution.value)], capitalizeFirst(contribution.value));
      }
      const speedEntries = speciesSpeedEntries(speciesDefinition(record));
      for (const speed of speedEntries) put('species', `${speed.type} speed`, ['speeds', speed.id], speed);
      const movement = speciesDefinition(record).movement;
      if (movement.kind === 'defined' && movement.choice) {
        for (const contribution of species.generated.filter(value => value.field === 'speed')) {
          const value = object(contribution.value)!;
          const type = movement.choice.from.find(mode => mode === value['mode']);
          if (type && movement.choice.feet === value['number'] && !speedEntries.some(speed => speed.type === type)) {
            put('species', `${type} speed`, ['speeds', type], { id: type, type, value: { kind: 'fixed', feet: movement.choice.feet } });
          }
        }
      }
      // Species already have their own feature section; only spell grants need a source.
      if (declaresSpellcasting(record)) {
        const name = source(wizardEditorId('species-source', revision.sourceIdentity, record.key), `${record.name} (${record.publication})`, {
          isGeneralFeatureSource: false, isSpellcastingSource: true, ...sourceAbilityFlags(record) }, 'species');
        addOwner('wizard-species', record, state.classes.reduce((sum, entry) => sum + entry.level, 0), name, '', 9);
      }
      if (state.options['species'] !== false && speciesDefinition(record).abilities.length) warnings.push('Species ability-score options remain editable on Ability Scores; this prefill preserves your current scores.');
    }
  }
  // 3. Rule handlers expose candidates and validate answers before producing sheet entries.
  const backgroundKey = state.backgroundKey;
  const proficiencyRecords = new Map(records);
  const proficiencies = deriveProficiencyGrants(state.classes, { ...index, records: proficiencyRecords }, state.answers, state.speciesKey, [], {}, sourceBooks, backgroundKey);
  if (state.options['proficiencies'] !== false) warnings.push(...proficiencies.diagnostics.filter(message => !message.startsWith('Select ')));
  choices.push(...proficiencies.choices.map(choice => ({ scope: 'proficiencies' as const, ownerKey: choice.ownerKey, id: choice.id, label: `${proficiencyRecords.get(choice.ownerKey)?.name ?? 'Character'}: ${choice.kind} proficiencies`, count: choice.count, searchable: false,
    candidates: choice.candidates.map(value => ({ value, label: records.has(value) ? `${records.get(value)!.name} (${records.get(value)!.publication})` : value })) })));
  choices.push(...proficiencies.packages.map(choice => ({ scope: 'proficiencies' as const, ownerKey: choice.ownerKey, id: choice.id, label: `${proficiencyRecords.get(choice.ownerKey)?.name ?? 'Character'}: ${choice.kind} options`, count: 1, searchable: false,
    candidates: choice.options.map(option => ({ value: option.value, label: `Option ${Number(option.value) + 1}: ${Object.keys(option.data).join(', ')}` })) })));
  for (const entry of proficiencies.generated) {
    const ownerKey = proficiencies.owners.get(entry.origin);
    const owner = ownerKey ? records.get(ownerKey) : undefined;
    const origin = owner ? `${owner.name} (${owner.publication})` : undefined;
    const proficiency = (label: string, path: string[], value: unknown) => put('proficiencies', label, path, value, origin);
    if (entry.kind === 'save') proficiency(`${entry.target.toUpperCase()} saving throw`, ['saves', entry.target.toUpperCase()], entry.target.toUpperCase());
    else if (entry.kind === 'skill') proficiency(`${entry.target} proficiency`, ['character', 'proficiencies', 'skills', entry.target.toUpperCase().replace(/\s+/g, '_')], entry.rank === 2 ? 'EXPERTISE' : entry.rank === .5 ? 'HALF' : 'PROFICIENT');
    else if (entry.kind === 'weapon' && ['simple', 'martial'].includes(entry.target)) proficiency(`${entry.target} weapons`, ['character', 'proficiencies', `${entry.target}Weapons`], true);
    else if (entry.kind === 'language') proficiency(`${entry.target} language`, ['languages', capitalizeFirst(entry.target)], capitalizeFirst(entry.target));
    else if (entry.kind === 'tool') {
      const record = records.get(entry.target);
      const label = record ? `${record.name} (${record.publication})` : capitalizeFirst(entry.target);
      proficiency(`${label} tool`, ['character', 'proficiencies', 'tools', label], record ? {
        contentKey: record.key, sourceIdentity: revision.sourceIdentity, revisionId: revision.id, snapshot: structuredClone(record),
      } : true);
    } else {
      const label = records.get(entry.target)?.name ?? capitalizeFirst(entry.kind === 'weapon' ? entry.target : `${entry.target} ${entry.kind}`);
      proficiency(label, ['custom', label], label);
    }
  }
  const modifiers = Object.fromEntries(DEFENSE_ABILITIES.map(({ key }) =>
    [key.slice(0, 3), Math.floor(((sheet.character?.abilityScores?.[key] ?? 10) - 10) / 2)]));
  for (const { owner, label, source: sourceName } of owners) {
    const result = deriveSpellGrants([owner], index, [], state.answers);
    if (state.options['spells'] !== false) warnings.push(...result.diagnostics.filter(message => !message.includes('Select ') && !message.includes('Choose additionalSpells'))
      .map(message => `${label}: ${message}`));
    choices.push(...result.choices.map(choice => ({ scope: 'spells' as const, ownerKey: owner.ownerKey, id: choice.id, label: `${label}: spells`, count: choice.count,
      candidates: choice.candidates.map(value => ({ value, label: `${records.get(value)?.name} (${records.get(value)?.publication})` })) })));
    for (const expanded of result.expanded) addSpell(records.get(expanded.contentKey)!, sourceName);
    for (const instance of result.instances) {
      const uses = spellUseTrackers(instance.grants, modifiers);
      addSpell(instance.snapshot, sourceName);
      // Explicit additionalSpells grants are usable spells, including known cantrips such
      // as Arcane Trickster's Mage Hand. Expanded lists above only provide eligibility.
      addSpell(instance.snapshot, sourceName, 'PREPARED', uses);
    }
  }
  for (const [id, entry] of spells) put('spells', `${entry.name}: ${entry.listType?.toLowerCase()}`, ['spells', id], entry);
  const uniqueChoices = [...new Map(choices.filter(choice => !choice.scope || state.options[choice.scope] !== false).map(choice => [choice.id, choice])).values()];
  const unresolved = uniqueChoices.filter(choice => {
    const answer = state.answers[choice.id] ?? [];
    return !isCompleteSelection(answer, choice.count, choice.candidates.map(candidate => candidate.value));
  });
  // 4. Reconcile with the last baseline. Manual changes and annotations take precedence.
  const proposal = mergeWizardPrefill(sheet, state, values, overrideSections);
  const background = backgroundKey ? records.get(backgroundKey) : undefined;
  if (backgroundKey && background?.kind !== 'background') errors.push('The selected background is missing from this import.');
  const nextBackground = background?.kind === 'background'
    ? { name: background.name, source: background.publication, entity: characterOptionSourceData(background), contentReference: reference(background) }
    : state.customBackgroundName?.trim() ? { name: state.customBackgroundName.trim() } : undefined;
  if (JSON.stringify(sheet.background) !== JSON.stringify(nextBackground)) proposal.changes.push({ path: ['background'], label: 'Background', action: nextBackground ? sheet.background ? 'Update' : 'Fill' : 'Remove' });
  if (nextBackground) proposal.sheet.background = nextBackground; else delete proposal.sheet.background;
  const classRows = [...(sheet.classes ?? []).filter(entry => entry.custom).map(entry => structuredClone(entry)), ...state.classes.flatMap(selection => {
    const record = records.get(selection.classKey); if (!record) return [];
    const subclass = selection.subclassKey ? records.get(selection.subclassKey) : undefined;
    return [{ name: record.name, subclass: subclass?.name, level: selection.level, classKey: record.key, subclassKey: subclass?.key }];
  })];
  if (JSON.stringify(sheet.classes) !== JSON.stringify(classRows)) proposal.changes.push({ path: ['classes'], label: 'Displayed classes and levels', action: sheet.classes?.length ? 'Update' : 'Fill' });
  proposal.sheet.classes = classRows;
  if (classRows.length) {
    const level = classRows.reduce((total, entry) => total + entry.level, 0);
    proposal.sheet.character!.level = level;
    // Identity rows determine the final level even when an older standalone level was manual.
    // Review the actual result rather than reporting an edit as kept and then replacing it.
    proposal.changes = proposal.changes.filter(change => change.path[0] !== 'character' || change.path[1] !== 'level');
    if (sheet.character?.level !== level) proposal.changes.push({ path: ['character', 'level'], label: 'Character level', action: sheet.character?.level == null ? 'Fill' : 'Update' });
  }
  // Notes follow the species that was actually applied, not a manually retained different species.
  if (state.options['species'] !== false && state.speciesKey
    && proposal.sheet.species?.contentReference?.key === state.speciesKey) {
    updateSpeciesChoiceNotes(proposal.sheet.species,
      uniqueChoices.filter(choice => choice.ownerKey === state.speciesKey), state.answers);
  }
  return { ...proposal, values, hpContributions, errors: [...new Set(errors)], warnings: [...new Set(warnings)], choices: uniqueChoices, unresolved,
    summary: { level: proposal.sheet.character?.level ?? state.classes.reduce((sum, entry) => sum + entry.level, 0), maxHp: Math.max(0, maxHp),
      features: values.filter(entry => entry.path[0] === 'features').length, spells: spells.size } };
}
