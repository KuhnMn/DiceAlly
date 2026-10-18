import 'fake-indexeddb/auto';
import { TestBed } from '@angular/core/testing';
import magnolie from '../../../docs/Magnolie_export_old.json';
import { ContentRecord, DEFAULT_CONTENT_SOURCE, ImportRevision, JsonObject, entityKey, sourceIdentity } from '../content/content.model';
import { IndexedDbContentCache } from '../content/content-cache';
import { ExportedCharacter } from '../models/character.model';
import { previewClassWizard } from '../editor/class-wizard-preview';
import { migrateLegacyCharacter, isLegacyCharacterExport } from './legacy-character-import';
import { CharacterLibraryService } from './character-library.service';

const original = () => structuredClone(magnolie) as unknown as ExportedCharacter;
const revision: ImportRevision = { id: 'legacy-import-fixture', namespace: 'development-local', source: DEFAULT_CONTENT_SOURCE,
  sourceIdentity: sourceIdentity(DEFAULT_CONTENT_SOURCE), commit: 'fixture', adapterVersion: 1,
  createdAt: '2026-10-18T00:00:00Z', status: 'ready', files: [], diagnostics: [],
  metrics: { bytes: 0, records: 0, elapsedMs: 0, mappedBytes: 0 } };
function record(kind: string, data: unknown): ContentRecord {
  const json = structuredClone(data) as JsonObject;
  return { kind, key: entityKey(kind, json), name: String(json['name']), publication: String(json['source']),
    file: 'legacy-fixture.json', data: json, links: [] };
}
function installedRecords() {
  const sheet = original();
  const records = new Map<string, ContentRecord>();
  const put = (kind: string, data: unknown) => { const entry = record(kind, data); records.set(entry.key, entry); };
  for (const feature of sheet.features!) put(feature.featEntity ? 'feat' : feature.optionalFeatureEntity ? 'optionalfeature'
    : feature.featureEntity?.subclassShortName ? 'subclassFeature' : 'classFeature', feature.featureEntity ?? feature.featEntity ?? feature.optionalFeatureEntity);
  for (const spell of sheet.spells!) put('spell', spell.entity);
  for (const item of sheet.inventory!) if (!item.source?.startsWith('CUSTOM')) put('item', item.entity!.item);
  for (const monster of sheet.monsters!) put('monster', monster.entity);
  put('species', sheet.species!.entity);
  const classFeatures = sheet.features!.flatMap(feature => feature.featureEntity && !feature.featureEntity.subclassShortName
    ? [`${feature.name}|Wizard|XPHB|${feature.featureEntity.level}|${feature.source}`] : []);
  put('class', { name: 'Wizard', source: 'XPHB', hd: { number: 1, faces: 6 }, casterProgression: 'full', spellcastingAbility: 'int', classFeatures });
  put('subclass', { name: 'Transmuter', shortName: 'Transmuter', source: 'XUA2025ArcaneUpdates', className: 'Wizard', classSource: 'XPHB',
    subclassFeatures: sheet.features!.flatMap(feature => feature.featureEntity?.subclassSource === 'XUA2025ArcaneUpdates'
      ? [`${feature.name}|Wizard|XPHB|Transmuter|XUA2025ArcaneUpdates|${feature.featureEntity.level}|${feature.source}`] : []) });
  return [...records.values()];
}

describe('Old app JSON migration', () => {
  it('migrates the complete Magnolie export, preserving character state and custom content', () => {
    const input = original();
    const migrated = migrateLegacyCharacter(input, installedRecords(), revision);
    expect(input).toEqual(original());
    expect(migrated.character!.proficiencies!.languages).toEqual(['Common', 'Elvish', 'Halfling']);
    expect(migrated.character!.proficiencies!.custom).toEqual([]);
    expect(migrated.character!.proficiencies!.tools!["Woodcarver's Tools (XPHB)"]).toMatchObject({ contentKey: expect.any(String), revisionId: revision.id });
    expect(migrated.character!.featureSources).toHaveLength(3);
    expect(migrated.character!.featureSources!.find(source => source.name === 'Wizard (XPHB)')).toMatchObject({
      isGeneralFeatureSource: true, isSpellcastingSource: true, useSpellbook: true, usesIntelligence: true,
    });
    expect(migrated.spells!.some(spell => spell.castingSourceName?.endsWith(' - S'))).toBe(false);
    expect(migrated.character!.spellSlots!['Wizard (XPHB)']).toEqual(input.character!.spellSlots!['Wizard (XPHB) - S']);
    for (const field of ['features', 'spells', 'inventory', 'monsters'] as const) {
      expect(migrated[field]).toHaveLength(input[field]!.length);
      migrated[field]!.forEach((entry, index) => {
        expect(entry.editorId).toBeTruthy();
        expect(entry.notes).toEqual(input[field]![index].notes);
        expect(entry.uses).toEqual(input[field]![index].uses);
      });
    }
    expect(migrated.spells!.every(spell => !!spell.contentReference)).toBe(true);
    expect(migrated.inventory!.find(item => item.source === 'CUSTOM')!.contentReference).toBeUndefined();
    expect(migrated.combatActions).toEqual(expect.arrayContaining(input.combatActions!.map(action => expect.objectContaining(action))));
    expect(migrated.notes).toEqual(input.notes);
    expect(migrated.portaitUrl).toBe(input.portaitUrl);
    expect(migrated.character!.currentHp).toBe(input.character!.currentHp);
    expect(migrated.creatorWizard!.classes[0]).toMatchObject({ level: 4, useSpellbook: true,
      classKey: entityKey('class', { name: 'Wizard', source: 'XPHB' }), subclassKey: expect.any(String) });
    expect(migrated.creatorWizard!.baseline.length).toBeGreaterThan(5);
    expect(isLegacyCharacterExport(migrated)).toBe(false);
    expect(migrateLegacyCharacter(migrated, installedRecords(), revision)).toBe(migrated);
  });

  it('lets the wizard update generated class features and slots without duplicating imported entries', () => {
    const records = installedRecords();
    const migrated = migrateLegacyCharacter(original(), records, revision);
    const state = structuredClone(migrated.creatorWizard!);
    state.classes[0].level = 5;
    const preview = previewClassWizard(migrated, state, revision, new Map(records.map(entry => [entry.key, entry])));
    expect(preview.errors).toEqual([]);
    expect(preview.sheet.features).toHaveLength(migrated.features!.length);
    expect(preview.sheet.spells).toHaveLength(migrated.spells!.length);
    expect(preview.sheet.character!.featureSources).toHaveLength(migrated.character!.featureSources!.length);
    expect(preview.sheet.character!.spellSlots!['Wizard (XPHB)'].map(slot => slot.level)).toEqual([1, 2, 3]);
    expect(preview.sheet.character!.spellSlots!['Wizard (XPHB)'][0].used).toBe(1);
    expect(preview.sheet.features!.find(feature => feature.name === "Transmuter's Stone")!.notes).toEqual(
      migrated.features!.find(feature => feature.name === "Transmuter's Stone")!.notes);
  });

  it('converts structure offline and retains unmatched definitions and descriptions', () => {
    const input = original();
    const migrated = migrateLegacyCharacter(input);
    expect(migrated.spells!.map(spell => spell.entity)).toEqual(input.spells!.map(spell => spell.entity));
    expect(migrated.features!.map(feature => feature.featureEntity)).toEqual(input.features!.map(feature => feature.featureEntity));
    expect(migrated.character!.proficiencies!.languages).toEqual(['Common', 'Elvish', 'Halfling']);
    expect(migrated.creatorWizard).toBeUndefined();
  });

  it('maps recognizable proficiencies and keeps unknown text, existing expertise and ambiguous library matches', () => {
    const input = original();
    input.character!.proficiencies!.custom = ['Common', 'Simple Weapons', 'Martial Weapons', 'Initiative', 'Arcana', 'Dexterity Saving Throws', 'Campaign-specific permission'];
    input.character!.proficiencies!.languages = ['Common'];
    const records = installedRecords();
    const message = records.find(entry => entry.kind === 'spell' && entry.name === 'Message')!;
    records.push({ ...message, key: message.key + ':variant', homebrewVariant: { originalKey: message.key, number: 2 } });
    const migrated = migrateLegacyCharacter(input, records, revision);
    expect(migrated.spells!.filter(spell => spell.name === 'Message').every(spell => !spell.contentReference)).toBe(true);
    expect(migrated.character!.proficiencies).toMatchObject({ languages: ['Common'], simpleWeapons: true,
      martialWeapons: true, initiative: true, skills: { ARCANA: 'EXPERTISE' }, savingThrows: ['INT', 'WIS', 'DEX'], custom: ['Campaign-specific permission'] });
  });

  it('does not merge conflicting source overrides or guess multiclass levels', () => {
    const input = original();
    input.character!.featureSources![1].customDc = 12;
    input.character!.featureSources![2].customDc = 14;
    const records = installedRecords();
    records.push(record('class', { name: 'Fighter', source: 'XPHB' }));
    input.character!.featureSources!.push({ name: 'Fighter (XPHB)', isGeneralFeatureSource: true });
    const migrated = migrateLegacyCharacter(input, records, revision);
    expect(migrated.character!.featureSources!.find(source => source.name === 'Wizard (XPHB) - S')?.customDc).toBe(14);
    expect(migrated.creatorWizard).toBeUndefined();
  });

  it('preserves custom casting bonuses and lineage ability choices when the wizard advances levels', () => {
    const input = original();
    input.character!.featureSources![1].customDc = 17;
    const records = installedRecords();
    const migrated = migrateLegacyCharacter(input, records, revision);
    const state = structuredClone(migrated.creatorWizard!); state.classes[0].level = 5;
    const preview = previewClassWizard(migrated, state, revision, new Map(records.map(entry => [entry.key, entry])));
    expect(preview.sheet.character!.featureSources!.find(source => source.name === 'Wizard (XPHB)')!.customDc).toBe(17);
    expect(preview.sheet.character!.featureSources!.find(source => source.name === 'Elf (Lorwyn)')!.usesIntelligence).toBe(true);
    expect(preview.sheet.character!.spellSlots!['Wizard (XPHB)'].map(slot => slot.level)).toEqual([1, 2, 3]);
  });

  it('migrates only through the dedicated old-export import and leaves normal imports unchanged', async () => {
    const cache = new IndexedDbContentCache();
    await cache.stage(revision); await cache.put(revision.id, installedRecords()); await cache.activate(revision);
    await cache.saveSource('development-local', DEFAULT_CONTENT_SOURCE);
    const library = TestBed.inject(CharacterLibraryService);
    const normalInput = original(); normalInput.character!.characterUuid = crypto.randomUUID();
    const normal = await library.importCharacterFromJson(JSON.stringify(normalInput));
    expect(normal.success).toBe(true);
    const normalSaved = (await library.get(normal.characterId!))!.sheet;
    expect(normalSaved.character!.featureSources).toHaveLength(5);
    expect(normalSaved.character!.proficiencies!.languages).toBeUndefined();
    expect(normalSaved.spells![0].contentReference).toBeUndefined();
    const result = await library.importLegacyCharacterFromJson(JSON.stringify(original()));
    expect(result.success).toBe(true);
    const saved = (await library.get(result.characterId!))!.sheet;
    expect(saved.character!.proficiencies!.languages).toEqual(['Common', 'Elvish', 'Halfling']);
    expect(saved.character!.featureSources).toHaveLength(3);
    expect(saved.spells![0].contentReference?.revisionId).toBe(revision.id);
    expect(saved.creatorWizard!.classes[0].level).toBe(4);
    expect((await library.importLegacyCharacterFromJson(JSON.stringify(original()))).error?.code).toBe('IMPORT_CONFLICT');
  });
});
