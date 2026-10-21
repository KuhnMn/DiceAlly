import 'fake-indexeddb/auto';
import { mapContent, directLinks } from './content-adapter';
import { assertClassDefinition, canonicalClassRecord, classSourceData, isClassKind, projectClassFeatureData } from './class-adapter';
import { featureReference } from './class-reference';
import { ADAPTER_VERSION, DEFAULT_CONTENT_SOURCE, ImportRevision, sourceIdentity } from './content.model';
import { CONTENT_SCHEMA_ID } from './generated/schema-version';
import { deriveClassFeatures } from '../rules/feature-rules';
import { deriveOptionalSlots } from '../rules/optional-progression';
import { deriveProficiencyGrants } from '../rules/proficiency-rules';
import { previewClassRules } from '../rules/class-preview';
import { acceptDocumentPreview, previewDocument } from '../rules/document-operations';
import { newCharacter, projectSheet, snapshotIndex } from '../editor/editor-document';
import { parseCharacterDocument } from '../rules/character-document';
import { LocalCharacterRepository } from '../editor/local-character-repository';
import { createFeatureEntry, featureRecordMetadata, matchesFeatureRecord } from '../editor/feature-selection';
import { finalizeContentImport } from './content-finalizer';
import { IndexedDbContentCache } from './content-cache';
import { encodeCloudCharacter, decodeCloudCharacter } from '../characters/sync/character-cloud';

function fixture() {
  const raw = mapContent({
    class: [{ name: 'Warrior', source: 'TEST', hd: { number: 1, faces: 10 }, proficiency: ['str','con'],
      primaryAbility: [{ str: true }], classFeatures: ['Training|Warrior|TEST|1'],
      startingProficiencies: { armor: [{ proficiency: 'light', full: 'Light armor description' }], weapons: [{ proficiency: 'martial', optional: false }],
        tools: ['A descriptive tool entry'], toolProficiencies: [{ flute: true }] },
      multiclassing: { requirements: { str: 13 }, proficienciesGained: { armor: ['medium'] }, entries: ['Retain this rule'] } }],
    subclass: [{ name: 'Scholar', shortName: 'Scholar', source: 'TEST', className: 'Warrior', classSource: 'TEST',
      casterProgression: '1/3', spellcastingAbility: 'int', preparedSpells: '<$level$> + <$int_mod$>',
      subclassFeatures: [{ subclassFeature: 'Study|Warrior|TEST|Scholar|TEST|3', gainSubclassFeature: true,
        gainSubclassFeatureHasContent: true, tableDisplayName: 'Study table', extension: 'retained' }],
      additionalSpells: [{ known: { '1': ['Spark|TEST'] } }] }],
    classFeature: [{ name: 'Training', source: 'TEST', className: 'Warrior', classSource: 'TEST', level: 1, entries: ['Training text'] }],
    subclassFeature: [{ name: 'Study', source: 'TEST', className: 'Warrior', classSource: 'TEST', subclassShortName: 'Scholar', subclassSource: 'TEST', level: 3, entries: ['Study text'] }],
    spell: [{ name: 'Spark', source: 'TEST', level: 0 }],
  }, 'class/synthetic.json').records;
  const records = raw.map(record => isClassKind(record.kind) ? canonicalClassRecord(record) : record);
  const parent = records.find(r => r.kind === 'class')!; const subclass = records.find(r => r.kind === 'subclass')!;
  const selection = { selectionId: 'stable-selection', classKey: parent.key, subclassKey: subclass.key, level: 3 };
  const revision: ImportRevision = { id: crypto.randomUUID(), namespace: 'class-contract-tests', source: DEFAULT_CONTENT_SOURCE,
    sourceIdentity: sourceIdentity(DEFAULT_CONTENT_SOURCE), commit: 'a'.repeat(40), adapterVersion: ADAPTER_VERSION,
    schemaSnapshot: CONTENT_SCHEMA_ID, createdAt: new Date().toISOString(), status: 'ready', files: ['class/synthetic.json'], diagnostics: [],
    metrics: { bytes: 0, records: records.length, mappedBytes: 0, elapsedMs: 0 } };
  return { raw, records, parent, subclass, selection, revision,
    index: { sourceIdentity: revision.sourceIdentity, revisionId: revision.id, records: new Map(records.map(r => [r.key,r])) } };
}

describe('Canonical class and subclass contracts', () => {
  it('moves mechanical fields once, preserves explicit wrapper metadata and leaves descriptive fields intact', () => {
    const f = fixture(); const original = structuredClone(f.raw);
    expect(f.parent.classDefinition).toMatchObject({ version: 1, hitDice: { number: 1, faces: 10 }, savingThrows: ['str','con'], primaryAbilities: [['str']] });
    expect(f.parent.data['hd']).toBeUndefined(); expect(f.parent.data['classFeatures']).toBeUndefined();
    expect(f.parent.data['multiclassing']).toEqual({ requirements: { str: 13 }, entries: ['Retain this rule'] });
    expect(f.subclass.classDefinition).toMatchObject({ parent: { key: f.parent.key }, casting: { progression: '1/3', ability: 'int' },
      features: [{ gainSubclassFeature: true, gainSubclassFeatureHasContent: true, tableDisplayName: 'Study table', extensions: { extension: 'retained' } }] });
    expect(classSourceData(f.subclass)).toMatchObject(f.raw.find(r => r.kind === 'subclass')!.data);
    expect(canonicalClassRecord(f.subclass)).toEqual(f.subclass);
    expect(f.raw).toEqual(original);
  });

  it('uses documented UID source defaults and validates canonical identity consistency', () => {
    expect(featureReference('Feature|Mage||1', 'classFeature', {}).target).toBe('["classFeature","feature","phb","mage","phb",1]');
    const f = fixture(); const invalid = structuredClone(f.subclass.classDefinition!); invalid.features[0].key = 'wrong';
    expect(() => assertClassDefinition(invalid)).toThrow('feature identity');
    const parent = structuredClone(f.subclass.classDefinition!); parent.parent!.key = 'wrong';
    expect(() => assertClassDefinition(parent)).toThrow('parent identity');
    expect(() => assertClassDefinition({ ...f.parent.classDefinition, version: 2 })).toThrow('Invalid canonical class');
    expect(() => canonicalClassRecord({ ...f.parent, data: { hd: { number: 1, faces: 6 } } })).toThrow('duplicate');
    expect(() => canonicalClassRecord({ ...f.parent, classDefinition: f.subclass.classDefinition })).toThrow('kind');
  });

  it('derives features, subclass casting, exact proficiency wrappers and stable progression from canonical fields', () => {
    const f = fixture(); const features = deriveClassFeatures([f.selection], f.index);
    expect(features.canAccept).toBe(true); expect(features.instances).toHaveLength(2);
    expect(features.classInputs[0]).toMatchObject({ hitDie: 10, caster: 'third', level: 3 });
    expect(deriveClassFeatures([f.selection], f.index, features.instances).instances).toEqual(features.instances);
    const proficiencies = deriveProficiencyGrants([f.selection], f.index);
    expect(proficiencies.canAccept).toBe(true);
    expect(proficiencies.generated.map(p => p.target)).toEqual(expect.arrayContaining(['str','con','light','martial','flute']));
    expect(proficiencies.generated.some(p => p.target === 'A descriptive tool entry')).toBe(false);
    const owner = structuredClone(f.parent); owner.classDefinition!.optionalFeatures = [{ name: 'Options', featureType: ['EI'], progression: { '1': 1, '3': 2 } }];
    const index = { ...f.index, records: new Map(f.index.records).set(owner.key, owner) };
    const lower = deriveOptionalSlots([{ ...f.selection, level: 1 }], index); const higher = deriveOptionalSlots([f.selection], index);
    expect(lower.slots[0].id).toBe(higher.slots[0].id); expect(higher.slots[0].count).toBe(2);
    const preview = previewClassRules({ selections: [f.selection], levels: { constitution: 14, manualMaxHp: 1, applyHp: true, applyHitDice: true, manualPools: [] },
      session: { currentHp: 0, resources: {}, annotations: {} } }, f.index);
    expect(preview.canAccept).toBe(true); expect(preview.proposed.spells).toHaveLength(1);
    expect(preview.proposed.spells[0].grants[0].ability).toBe('int');
  });

  it('preserves valid unsupported mechanics and blocks their automation without changing previous instances', () => {
    const f = fixture(); const missingDie = canonicalClassRecord({ ...f.raw[0], data: { ...f.raw[0].data, hd: undefined } });
    expect(missingDie.classDefinition.hitDice).toBeUndefined();
    const index = { ...f.index, records: new Map(f.index.records).set(missingDie.key, missingDie) };
    const previous = deriveClassFeatures([f.selection], f.index).instances;
    const preview = deriveClassFeatures([f.selection], index, previous);
    expect(preview.canAccept).toBe(false); expect(preview.instances).toEqual(previous);
    expect(preview.diagnostics[0].message).toContain('hit-die');
    const invalid = structuredClone(f.subclass); invalid.classDefinition!.version = 99 as 1;
    expect(deriveClassFeatures([f.selection], { ...f.index, records: new Map(f.index.records).set(invalid.key, invalid) }).canAccept).toBe(false);
  });

  it('retains wildcard timing, required options and optional weapons without guessing an automatic grant', () => {
    const f = fixture(); const owner = structuredClone(f.parent);
    owner.classDefinition!.optionalFeatures = [{ name: 'Timed', featureType: ['EI'], progression: { '*': 1 }, required: { '1': ['Required|TEST'] } }];
    owner.classDefinition!.proficiencies.starting = { weapons: [{ proficiency: 'martial', optional: true }] };
    expect(() => assertClassDefinition(owner.classDefinition)).not.toThrow();
    const index = { ...f.index, records: new Map(f.index.records).set(owner.key, owner) };
    expect(deriveOptionalSlots([f.selection], index).canAccept).toBe(false);
    const proficiencies = deriveProficiencyGrants([f.selection], index);
    expect(proficiencies.canAccept).toBe(false);
    expect(proficiencies.generated.some(p => p.target === 'martial')).toBe(false);
  });

  it('keeps feature ancestry and levels available to catalog filters and portable sheet consumers', () => {
    const f = fixture(); const record = f.records.find(r => r.kind === 'subclassFeature')!;
    expect(record.data['level']).toBeUndefined();
    expect(featureRecordMetadata(record)).toEqual({ classes: ['Warrior'], levels: [3], subclass: 'Scholar' });
    expect(matchesFeatureRecord(record, ['Warrior'], [3])).toBe(true);
    const entry = createFeatureEntry(record, f.revision);
    expect(entry.featureEntity).toMatchObject({ className: 'Warrior', classSource: 'TEST', subclassShortName: 'Scholar', level: 3, entries: ['Study text'] });
    expect(projectClassFeatureData(record)).toEqual(entry.featureEntity);
    expect(directLinks(f.subclass)).toEqual(expect.arrayContaining([expect.objectContaining({ role: 'parent-class', target: f.parent.key }),
      expect.objectContaining({ role: 'subclassFeature', target: record.key })]));
  });

  it('supports homebrew copies against an already canonical installed class without losing inherited mechanics', async () => {
    const f = fixture(); const cache = new IndexedDbContentCache(); const revision = { ...f.revision, id: crypto.randomUUID(), status: 'staging' as const };
    await cache.stage(revision); await cache.put(revision.id, f.records);
    const child = mapContent({ class: [{ name: 'Copied Warrior', source: 'BREW', _copy: { name: 'Warrior', source: 'TEST' } }] }, 'homebrew/copy.json').records[0];
    await cache.put(revision.id, [child]);
    await finalizeContentImport(cache, revision, { bytes: 0, started: performance.now(), shouldProcess: r => r.file.startsWith('homebrew/') });
    const copied = (await cache.get(revision.id, child.key))!;
    expect(copied.classDefinition?.hitDice).toEqual(f.parent.classDefinition?.hitDice);
    expect(copied.classDefinition?.proficiencies).toEqual(f.parent.classDefinition?.proficiencies);
    expect(copied.data['_copy']).toBeUndefined();
  });

  it('migrates old native snapshots, saves and reopens offline, retaining identity, notes and resource usage', async () => {
    const f = fixture(); const document = newCharacter(f.revision);
    document.creation.classes.selections = [f.selection]; document.creation.abilities.con = 14;
    document.snapshots = f.raw;
    const oldSnapshot = f.raw.find(r => r.kind === 'classFeature')!;
    document.instances.features = [{ id: 'legacy-feature-id', contentKey: oldSnapshot.key, sourceIdentity: f.revision.sourceIdentity,
      revisionId: f.revision.id, manual: false, grants: [], snapshot: oldSnapshot, customization: { legacy: 'retained' } }];
    document.session.annotations['legacy-feature-id'] = ['Legacy note'];
    const migrated = parseCharacterDocument(JSON.stringify(document));
    expect(migrated.snapshots.filter(r => isClassKind(r.kind)).every(r => r.classDefinition?.version === 1)).toBe(true);
    expect(migrated.instances.features[0].snapshot.classDefinition?.level).toBe(1);
    expect(migrated.instances.features[0].snapshot.data['level']).toBeUndefined();
    const initial = previewDocument(migrated, snapshotIndex(migrated));
    expect(initial.diagnostics).toEqual([]); expect(initial.canAccept).toBe(true);
    const accepted = acceptDocumentPreview(migrated, initial);
    const feature = accepted.instances.features[0]; expect(feature.id).toBe('legacy-feature-id');
    feature.customization['note'] = 'Authored customization';
    accepted.session.annotations[feature.id] = ['Keep this note'];
    accepted.session.resources[accepted.instances.pools[0].id].used = 1;
    const before = structuredClone(accepted.session);
    const network = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Offline'));
    try {
      const repository = new LocalCharacterRepository(); await repository.save(accepted, 0);
      const reopened = (await new LocalCharacterRepository().list()).find(r => r.id === accepted.id)!.document;
      const repeated = previewDocument(reopened, snapshotIndex(reopened));
      expect(repeated.diagnostics).toEqual([]); expect(repeated.canAccept).toBe(true);
      const next = acceptDocumentPreview(reopened, repeated);
      expect(next.session).toEqual(before); expect(next.instances.features[0].id).toBe(feature.id);
      expect(next.instances.features[0].customization).toEqual(feature.customization);
      const sheet = projectSheet(next);
      expect(sheet.features?.[0].notes?.[0].notes).toEqual(['Keep this note']);
      const cloud = await encodeCloudCharacter({ id: next.id, sheet, version: 1, updatedAt: new Date().toISOString() }, 1);
      expect((await decodeCloudCharacter(next.id, cloud)).sheet.features).toEqual(sheet.features);
      expect(network).not.toHaveBeenCalled();
    } finally { network.mockRestore(); }
  });
});
