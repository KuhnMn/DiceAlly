import 'fake-indexeddb/auto';
import { mapContent } from './content-adapter';
import { assertCharacterOption, canonicalCharacterOption, characterOptionSourceData, isCharacterOptionKind } from './character-option-adapter';
import { ADAPTER_VERSION, DEFAULT_CONTENT_SOURCE, ImportRevision, sourceIdentity } from './content.model';
import { CONTENT_SCHEMA_ID } from './generated/schema-version';
import { deriveOptionalFeatures } from '../rules/optional-feature-rules';
import { deriveProficiencyGrants } from '../rules/proficiency-rules';
import { newCharacter, projectSheet } from '../editor/editor-document';
import { parseCharacterDocument } from '../rules/character-document';
import { createFeatureEntry, featureRecordCategories, featureRecordMetadata } from '../editor/feature-selection';
import { IndexedDbContentCache } from './content-cache';
import { finalizeContentImport } from './content-finalizer';

function fixture() {
  const raw = mapContent({
    class: [{ name: 'Fighter', source: 'TEST', hd: { number: 1, faces: 10 }, classFeatures: [] }],
    feat: [{ name: 'Skilled', source: 'TEST', category: 'G', entries: ['A feat'], ability: [{ str: 1 }],
      prerequisite: [{ level: { level: 4, class: { name: 'Fighter', source: 'TEST' } }, ability: [{ str: 13 }, { dex: 13 }] }] }],
    optionalfeature: [{ name: 'Invocation', source: 'TEST', featureType: ['EI'], entries: ['An option'], prerequisite: [{ ability: [{ str: 13 }, { dex: 13 }] }] }],
    background: [{ name: 'Scholar', source: 'TEST', entries: ['A background'],
      skillProficiencies: [{ arcana: true, choose: { from: ['history', 'religion'], count: 1 } }], languageProficiencies: [{ common: true }] }],
  }, 'synthetic.json').records;
  const records = raw.map(r => isCharacterOptionKind(r.kind) ? canonicalCharacterOption(r) : r);
  const parent = records.find(r => r.kind === 'class')!;
  const optional = records.find(r => r.kind === 'optionalfeature')!;
  const background = records.find(r => r.kind === 'background')!;
  const feat = records.find(r => r.kind === 'feat')!;
  const revision: ImportRevision = { id: crypto.randomUUID(), namespace: 'character-option-tests', source: DEFAULT_CONTENT_SOURCE,
    sourceIdentity: sourceIdentity(DEFAULT_CONTENT_SOURCE), commit: 'a'.repeat(40), adapterVersion: ADAPTER_VERSION,
    schemaSnapshot: CONTENT_SCHEMA_ID, createdAt: new Date().toISOString(), status: 'ready', files: [], diagnostics: [],
    metrics: { bytes: 0, records: records.length, mappedBytes: 0, elapsedMs: 0 } };
  const index = { sourceIdentity: revision.sourceIdentity, revisionId: revision.id, records: new Map(records.map(r => [r.key, r])) };
  return { raw, records, parent, optional, background, feat, revision, index };
}

describe('Character option migration', () => {
  it('moves existing selection fields without duplicating them or changing ability metadata and descriptions', () => {
    const f = fixture(); const source = f.raw.find(r => r.kind === 'feat')!;
    expect(f.feat.characterOption).toMatchObject({ version: 1, kind: 'feat', category: 'G', prerequisites: source.data['prerequisite'] });
    expect(f.feat.data['prerequisite']).toBeUndefined(); expect(f.feat.data['category']).toBeUndefined();
    expect(f.feat.data['ability']).toEqual([{ str: 1 }]); expect(f.feat.data['entries']).toEqual(['A feat']);
    expect(characterOptionSourceData(f.feat)).toEqual(source.data);
    expect(canonicalCharacterOption(f.feat)).toEqual(f.feat);
    expect(source.data['prerequisite']).toBeDefined();
    expect(featureRecordCategories(f.feat)).toEqual(['G']); expect(featureRecordCategories(f.optional)).toEqual(['EI']);
    expect(featureRecordMetadata(f.feat)).toEqual({ classes: ['Fighter'], levels: [4] });
  });

  it('keeps prerequisite behavior and optional instance identities unchanged', () => {
    const f = fixture(); const slot = { id: 'slot', selectionId: 'selection', ownerKey: f.parent.key, count: 1, featureTypes: ['EI'], selectedKeys: [f.optional.key] };
    const context = { totalLevel: 4, classes: [{ name: 'Fighter', publication: 'TEST', level: 4 }], abilities: { str: 10, dex: 14 },
      spells: new Set<string>(), optionalFeatures: new Set<string>(), pacts: new Set<string>() };
    const first = deriveOptionalFeatures([slot], f.index, [], [], context);
    expect(first.canAccept).toBe(true); expect(first.instances[0].snapshot.characterOption?.kind).toBe('optionalfeature');
    const repeated = deriveOptionalFeatures([slot], f.index, first.instances, [], context);
    expect(repeated.instances).toEqual(first.instances);
    const denied = deriveOptionalFeatures([slot], f.index, first.instances, [], { ...context, abilities: { str: 10, dex: 10 } });
    expect(denied.canAccept).toBe(false); expect(denied.instances).toEqual(first.instances);
  });

  it('preserves background proficiency choice IDs and conventional exported snapshots', () => {
    const f = fixture();
    const canonical = deriveProficiencyGrants([], f.index, {}, undefined, [], {}, [], f.background.key);
    const legacy = deriveProficiencyGrants([], { ...f.index, records: new Map(f.raw.map(r => [r.key, r])) }, {}, undefined, [], {}, [], f.background.key);
    expect(canonical.choices).toEqual(legacy.choices);
    const selected = deriveProficiencyGrants([], f.index, { [canonical.choices[0].id]: ['history'] }, undefined, [], {}, [], f.background.key);
    expect(selected.canAccept).toBe(true);
    expect(selected.generated.map(g => g.target)).toEqual(expect.arrayContaining(['arcana', 'history', 'common']));
    expect(createFeatureEntry(f.feat, f.revision).featEntity).toEqual(f.raw.find(r => r.kind === 'feat')!.data);
    expect(createFeatureEntry(f.optional, f.revision).optionalFeatureEntity).toEqual(f.raw.find(r => r.kind === 'optionalfeature')!.data);
  });

  it('migrates native feature snapshots without changing manual scores, IDs, notes, or customization', () => {
    const f = fixture(); const document = newCharacter(f.revision);
    document.creation.classes.selections = [{ selectionId: 'class', classKey: f.parent.key, level: 1 }];
    document.snapshots = f.raw;
    document.instances.features = [{ id: 'authored-feature', contentKey: f.feat.key, sourceIdentity: f.revision.sourceIdentity, revisionId: f.revision.id,
      manual: true, grants: [], snapshot: f.raw.find(r => r.kind === 'feat')!, customization: { keep: true } }];
    document.session.annotations['authored-feature'] = ['Retain this note'];
    const next = parseCharacterDocument(JSON.stringify(document));
    expect(next.instances.features[0].snapshot.characterOption?.category).toBe('G');
    expect(next.instances.features[0].id).toBe('authored-feature'); expect(next.instances.features[0].customization).toEqual({ keep: true });
    const sheet = projectSheet(next);
    expect(sheet.character?.abilityScores?.strength).toBe(10);
    expect(sheet.features?.[0].featEntity?.prerequisite).toEqual(f.raw.find(r => r.kind === 'feat')!.data['prerequisite']);
    expect(sheet.features?.[0].notes?.[0].notes).toEqual(['Retain this note']);
    expect(() => assertCharacterOption({ ...f.feat.characterOption, version: 2 })).toThrow('Invalid character option');
    expect(() => assertCharacterOption({ ...f.feat.characterOption, prerequisites: null })).toThrow('Invalid character option');
    expect(() => canonicalCharacterOption({ ...f.feat, data: { category: 'G' } })).toThrow('duplicate');
    expect(() => canonicalCharacterOption({ ...f.feat, characterOption: f.background.characterOption })).toThrow('kind');
  });

  it('retains proficiency packages when homebrew copies an installed canonical background', async () => {
    const f = fixture(); const cache = new IndexedDbContentCache(); const revision = { ...f.revision, status: 'staging' as const };
    await cache.stage(revision); await cache.put(revision.id, f.records);
    const child = mapContent({ background: [{ name: 'Copied Scholar', source: 'BREW', _copy: { name: 'Scholar', source: 'TEST' } }] }, 'homebrew/copy.json').records[0];
    await cache.put(revision.id, [child]);
    await finalizeContentImport(cache, revision, { bytes: 0, started: performance.now(), shouldProcess: r => r.file.startsWith('homebrew/') });
    const copied = (await cache.get(revision.id, child.key))!;
    expect(copied.characterOption?.proficiencies).toEqual(f.background.characterOption?.proficiencies);
    expect(copied.data['_copy']).toBeUndefined();
  });
});
