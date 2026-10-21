import { projectSpellData } from '../content/spell-adapter';
import { characterOptionSourceData } from '../content/character-option-adapter';
import { projectClassFeatureData } from '../content/class-adapter';
import { ContentRecord, ImportRevision } from '../content/content.model';
import { CharacterDocument } from '../rules/character-document';
import { ContentRulesIndex } from '../rules/feature-rules';
import { ExportedCharacter, FeatureEntity, FeatEntity, OptionalFeatureEntity, SpellEntity, Speeds } from '../models/character.model';
import { projectSpeciesEntity } from '../content/species-compatibility';

export function bindingFor(revision: ImportRevision): CharacterDocument['contentBindings'][number] {
  return { sourceIdentity: revision.sourceIdentity, revisionId: revision.id, commit: revision.commit,
    adapterVersion: revision.adapterVersion, enabledPublications: [] };
}

export function newCharacter(revision: ImportRevision): CharacterDocument {
  return {
    format: 'ally-character', schemaVersion: 1, id: crypto.randomUUID(), rulesVersion: 'android-v1', restPolicy: 'android-v1',
    identity: { name: '', description: '' },
    creation: { classes: { selections: [] }, levels: { manualMaxHp: 1, applyHp: true, applyHitDice: true, manualPools: [] },
      abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
      stats: { armor: [], calculateAc: true, manualAc: 10 }, applyProficiencies: true, applySpeciesAbilities: false, manualProficiencies: [], manualSpeciesContributions: [],
      manualResources: [], manualSources: [], actions: [], pacts: [] },
    overrides: { pools: [], sources: [] }, contentBindings: [bindingFor(revision)],
    instances: { features: [], spells: [], pools: [], sources: [], actions: [] }, derived: null,
    session: { currentHp: 0, tempHp: 0, deathSaves: { successes: 0, failures: 0 }, resources: {}, annotations: {} },
    presentation: {}, snapshots: [], compatibility: {}, extensions: {},
  };
}

export function snapshotIndex(document: CharacterDocument): ContentRulesIndex {
  const binding = document.contentBindings[0];
  const records: ContentRecord[] = [...document.snapshots, ...document.instances.features.map(f => f.snapshot),
    ...document.instances.spells.map(s => s.snapshot), ...(document.instances.species ? [document.instances.species.snapshot] : [])];
  return { sourceIdentity: binding.sourceIdentity, revisionId: binding.revisionId, records: new Map(records.map(r => [r.key, r])) };
}

/** Presentation owns inventory, monsters, conditions and notes; rules own generated sheet fields. */
export function projectSheet(document: CharacterDocument): ExportedCharacter {
  const sheet = structuredClone(document.presentation['sheet'] ?? {}) as ExportedCharacter;
  const names = { str: 'strength', dex: 'dexterity', con: 'constitution', int: 'intelligence', wis: 'wisdom', cha: 'charisma' } as const;
  const abilities = document.creation.abilities;
  const stats = document.derived?.stats;
  const rank = (kind: string, target: string) => Math.max(0, ...(stats?.contributions ?? []).filter(p => p.kind === kind && p.target === target).map(p => p.rank));
  sheet.character = { ...sheet.character, characterUuid: document.id, name: document.identity.name,
    description: document.identity.description, level: document.creation.classes.selections.reduce((sum, s) => sum + s.level, 0),
    maxHp: document.derived?.maxHp, currentHp: document.session.currentHp, tempHp: document.session.tempHp,
    deathSavesSuccesses: document.session.deathSaves.successes, deathSavesFailures: document.session.deathSaves.failures,
    armorClass: document.derived?.stats.ac, calculateAC: false,
    initiativeOverride: document.derived?.stats.initiative,
    abilityScores: Object.fromEntries(Object.entries(abilities).map(([key, value]) => [names[key as keyof typeof names], value])),
    hitDice: document.instances.pools.filter(p => p.kind === 'hit-dice').map(p => ({ total: p.total,
      used: document.session.resources[p.id]?.used ?? 0, dieType: `d${p.rank}`, userAdded: p.manual })),
    proficiencies: { savingThrows: Object.keys(names).filter(a => rank('save', a) > 0).map(a => a.toUpperCase()),
      skills: Object.fromEntries(Object.keys(stats?.skills ?? {}).map(skill => [skill.toUpperCase().replace(/\s+/g, '_'),
        rank('skill', skill) === 2 ? 'EXPERTISE' : rank('skill', skill) === 1 ? 'PROFICIENT' : rank('skill', skill) === .5 ? 'HALF' : 'NONE'])),
      skillMiscBonuses: Object.fromEntries(Object.entries(document.creation.stats.skillBonuses ?? {}).map(([key, value]) => [key.toUpperCase().replace(/\s+/g, '_'), value])),
      saveMiscBonuses: document.creation.stats.saveBonuses, custom: (stats?.contributions ?? []).filter(p => !['save', 'skill'].includes(p.kind)).map(p => `${p.kind}: ${p.target}`) },
    spellSlots: { 'Spell slots': document.instances.pools.filter(p => p.kind === 'spell-slots').map(p => ({ level: p.rank ?? 1, total: p.total,
        used: document.session.resources[p.id]?.used ?? 0, regainCondition: p.regain, userAdded: p.manual, nativePoolId: p.id })) },
    featureSources: document.instances.sources.map(s => ({ name: s.label, isSpellcastingSource: true,
      customDc: document.derived?.casting.find(c => c.sourceId === s.id)?.dc,
      customToHit: document.derived?.casting.find(c => c.sourceId === s.id)?.toHit,
      useSpellbook: s.useSpellbook, userAdded: s.manual, ...(s.ability ? { [`uses${names[s.ability as keyof typeof names][0].toUpperCase()}${names[s.ability as keyof typeof names].slice(1)}`]: true } : {}) })),
  };
  sheet.features = document.instances.features.map(f => ({ name: f.snapshot.name, source: f.snapshot.publication,
    userAdded: f.manual, featureSourceName: 'Features',
    ...(f.snapshot.kind === 'feat' ? { featEntity: characterOptionSourceData(f.snapshot) as unknown as FeatEntity } : f.snapshot.kind === 'optionalfeature'
      ? { optionalFeatureEntity: characterOptionSourceData(f.snapshot) as unknown as OptionalFeatureEntity } : { featureEntity: projectClassFeatureData(f.snapshot) as unknown as FeatureEntity }),
    notes: [{ tag: f.id, notes: document.session.annotations[f.id] ?? [] }] }));
  sheet.features.push(...structuredClone(document.compatibility['legacyFeatures'] ?? []) as NonNullable<ExportedCharacter['features']>);
  sheet.spells = document.instances.spells.map(s => ({ name: s.snapshot.name, source: s.snapshot.publication,
    userAdded: s.manual, castingSourceName: document.instances.sources.find(source => source.id === s.castingSourceId)?.label,
    listType: s.list === 'known' && document.instances.sources.find(source => source.id === s.castingSourceId)?.useSpellbook ? 'SPELLBOOK' : s.list.toUpperCase(), entity: projectSpellData(s.snapshot) as unknown as SpellEntity,
    notes: [{ tag: s.id, notes: document.session.annotations[s.id] ?? [] }] }));
  for (const spell of sheet.spells) {
    const instance = document.instances.spells.find(s => s.id === spell.notes?.[0]?.tag)!;
    spell.uses = document.instances.pools.filter(p => p.kind === 'feature-uses' && p.origins.includes(instance.id)).map(p => ({
      tag: p.id, totalFreeUses: p.total, usedFreeUses: document.session.resources[p.id]?.used ?? 0, freeUsesRegainCondition: p.regain, userAdded: p.manual }));
  }
  sheet.spells.push(...structuredClone(document.compatibility['legacySpells'] ?? []) as NonNullable<ExportedCharacter['spells']>);
  if (document.instances.species) {
    const record = document.instances.species.snapshot;
    const same = sheet.species?.name === record.name && sheet.species?.source === record.publication;
    sheet.species = { name: document.instances.species.snapshot.name,
      ...(same ? sheet.species : {}), source: record.publication, entity: projectSpeciesEntity(record) };
  }
  const speeds: Speeds = { ...sheet.character.speeds };
  const senses: Record<string, unknown> = { ...sheet.character.senses };
  const resistances = [...sheet.character.resistances ?? []];
  for (const contribution of document.derived?.speciesContributions ?? []) {
    const value = contribution.value as Record<string, unknown>;
    if (contribution.field === 'speed' && !value['condition']) speeds[String(value['mode'])] = Number(value['number']);
    if (contribution.field === 'sense') senses[String(value['sense'])] = Number(value['range']);
    if (contribution.field === 'resist') resistances.push(typeof contribution.value === 'string' ? contribution.value : String(value['type'] ?? ''));
  }
  sheet.character.speeds = speeds; sheet.character.senses = senses; sheet.character.resistances = [...new Set(resistances)];
  return sheet;
}

/** Normalize equipped armor into the existing AC policy; keep explicitly authored armor inputs. */
export function syncInventoryArmor(document: CharacterDocument): void {
  const sheet = document.presentation['sheet'] as ExportedCharacter | undefined;
  const armor = document.creation.stats.armor.filter(a => !a.id.startsWith('inventory:'));
  for (const [position, item] of (sheet?.inventory ?? []).entries()) {
    const data = { ...item.entity?.baseItem, ...item.entity?.item };
    const type = String(data.type ?? '').split('|')[0];
    const normalized = ({ LA: 'light', MA: 'medium', HA: 'heavy', S: 'shield' } as const)[type as 'LA' | 'MA' | 'HA' | 'S'];
    if (!normalized && !data.bonusAc) continue;
    armor.push({ id: `inventory:${position}`, type: normalized ?? 'other', ac: Number(data.ac ?? item.entity?.ac ?? 0),
      bonus: Number(data.bonusAc ?? 0), equipped: item.isEquipped === true, attuned: item.isAttuned === true,
      requiresAttunement: !!data.reqAttune });
  }
  document.creation.stats.armor = armor;
}

/** Bring sheet session edits back by stable tags; recalculation inputs stay authoritative. */
export function captureSheet(document: CharacterDocument, sheet: ExportedCharacter): CharacterDocument {
  const next = structuredClone(document);
  next.presentation['sheet'] = structuredClone(sheet);
  // Species projections are regenerated. Persist the authored base rather than copying derived traits.
  const authored = (document.presentation['sheet'] as ExportedCharacter | undefined)?.character;
  const stored = (next.presentation['sheet'] as ExportedCharacter).character;
  if (stored) {
    stored.speeds = structuredClone(authored?.speeds);
    stored.senses = structuredClone(authored?.senses);
    stored.resistances = structuredClone(authored?.resistances);
  }
  const character = sheet.character;
  if (character) {
    next.session.currentHp = character.currentHp ?? next.session.currentHp;
    next.session.tempHp = character.tempHp ?? next.session.tempHp;
    next.session.deathSaves = { successes: character.deathSavesSuccesses ?? 0, failures: character.deathSavesFailures ?? 0 };
    for (const pool of next.instances.pools.filter(p => p.kind === 'hit-dice')) {
      const die = Array.isArray(character.hitDice) ? character.hitDice.find(d => d.dieType === `d${pool.rank}`) : undefined;
      if (die) next.session.resources[pool.id] = { used: die.used };
    }
    for (const slot of Object.values(character.spellSlots ?? {}).flat()) {
      const id = (slot as typeof slot & { nativePoolId?: string }).nativePoolId;
      if (id && next.instances.pools.some(p => p.id === id)) next.session.resources[id] = { used: slot.used };
    }
  }
  for (const entry of [...sheet.features ?? [], ...sheet.spells ?? [], ...(sheet.species ? [sheet.species] : [])]) {
    for (const note of entry.notes ?? []) if (note.tag) next.session.annotations[note.tag] = [...note.notes];
    for (const usage of entry.uses ?? []) if (usage.tag && next.instances.pools.some(p => p.id === usage.tag)) {
      next.session.resources[usage.tag] = { used: usage.usedFreeUses ?? 0 };
    }
  }
  const featureIds = new Set(next.instances.features.map(f => f.id));
  const spellIds = new Set(next.instances.spells.map(s => s.id));
  if (next.compatibility['legacyOriginal']) {
    next.compatibility['legacyFeatures'] = structuredClone((sheet.features ?? []).filter(f => !featureIds.has(f.notes?.[0]?.tag ?? '')));
    next.compatibility['legacySpells'] = structuredClone((sheet.spells ?? []).filter(s => !spellIds.has(s.notes?.[0]?.tag ?? '')));
  }
  // The viewer can copy a known/spellbook spell to Prepared. Keep that membership editable.
  for (const entry of sheet.spells ?? []) {
    const original = document.instances.spells.find(s => s.id === entry.notes?.[0]?.tag);
    if (!original) continue;
    const list = entry.listType === 'PREPARED' ? 'prepared' : entry.listType === 'INNATE' ? 'innate' : 'known';
    if (original.list !== list && !next.instances.spells.some(s => s.contentKey === original.contentKey && s.castingSourceId === original.castingSourceId && s.list === list)) {
      next.instances.spells.push({ ...structuredClone(original), id: crypto.randomUUID(), list, manual: true, grants: [] });
    }
  }
  next.instances.spells = next.instances.spells.filter(spell => !spell.manual || (sheet.spells ?? []).some(entry =>
    entry.name === spell.snapshot.name && entry.source === spell.snapshot.publication
      && (entry.listType === 'PREPARED' ? 'prepared' : entry.listType === 'INNATE' ? 'innate' : 'known') === spell.list));
  return next;
}
