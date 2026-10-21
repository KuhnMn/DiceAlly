import 'fake-indexeddb/auto';
import { canonicalReferenceRecord, referenceSourceData } from './reference-record-adapter';
import { coreDocumentFixture, homebrewDocumentFixture } from './content-fixtures.testing';
import { mapContent } from './content-adapter';
import { ContentReferenceIndex, linkContent } from './content-linker';
import { validateCoreDocument, validateHomebrewDocument } from './content-schema';
import { ContentRecord, JsonObject, ADAPTER_VERSION, DEFAULT_CONTENT_SOURCE, sourceIdentity, ImportRevision } from './content.model';
import { IndexedDbContentCache } from './content-cache';
import { finalizeContentImport } from './content-finalizer';
import { CONTENT_SCHEMA_ID } from './generated/schema-version';
import { importHomebrew } from './homebrew-importer';
import { readHomebrewFile } from './homebrew-package';

const categories = [
  ['object', 'objects.json'], ['condition', 'conditionsdiseases.json'], ['status', 'conditionsdiseases.json'], ['sense', 'senses.json'],
  ['skill', 'skills.json'], ['action', 'actions.json'], ['facility', 'bastions.json'],
  ['variantrule', 'variantrules.json'], ['disease', 'conditionsdiseases.json'], ['vehicle', 'vehicles.json'],
] as const;

function sourceRecord(kind: string, file: string): ContentRecord {
  return mapContent(coreDocumentFixture(file), file).records.find(record => record.kind === kind)!;
}

describe('Typed reference import storage', () => {
  beforeAll(async () => {
    await validateCoreDocument(coreDocumentFixture('senses.json'), 'senses.json');
    await validateHomebrewDocument(homebrewDocumentFixture({}), 'homebrew/warmup.json');
  }, 30000);

  it('preserves detached homebrew status metadata and validates stored descriptions', async () => {
    const raw = mapContent({ status: [{ name: 'Synthetic Status', source: 'TESTBREW', color: 'ff00ff', entries: ['Reference text'] }] }, 'homebrew/status.json').records[0];
    const canonical = await canonicalReferenceRecord(raw);
    expect(canonical.referenceDefinition).toMatchObject({ kind: 'status', version: 1, color: 'ff00ff', entries: ['Reference text'] });
    expect(canonical.data).toEqual({});
    expect(referenceSourceData(canonical)).toEqual(raw.data);
    const corrupt = structuredClone(canonical);
    (corrupt.referenceDefinition as unknown as JsonObject)['entries'] = 5;
    await expect(canonicalReferenceRecord(corrupt)).rejects.toThrow('Content validation failed');
    expect(raw.data['entries']).toEqual(['Reference text']);
  });

  it('stores each definition once, preserves site metadata and links restored descriptions', async () => {
    const records: ContentRecord[] = [];
    for (const [kind, file] of categories) {
      const raw = sourceRecord(kind, file);
      if (kind === 'skill') raw.data['srd'] = true;
      if (kind === 'object') raw.data['actionEntries'] = ['{@condition conditionsdiseases.json|TEST}'];
      const before = structuredClone(raw);
      const canonical = await canonicalReferenceRecord(raw);
      expect(canonical.referenceDefinition).toMatchObject({ kind, version: 1, name: raw.name, source: 'TEST' });
      expect(canonical.data).toEqual({});
      expect(referenceSourceData(canonical)).toMatchObject(before.data);
      expect(raw).toEqual(before);
      expect(await canonicalReferenceRecord(canonical)).toEqual(canonical);
      records.push(canonical);
    }
    const index = new ContentReferenceIndex(); records.forEach(record => index.add(record));
    const object = records.find(record => record.kind === 'object')!;
    expect(linkContent(object, index).links).toContainEqual(expect.objectContaining({
      role: 'entry-condition', path: 'actionEntries[0]', status: 'resolved',
    }));
    expect(records.find(record => record.kind === 'skill')!.referenceDefinition).toHaveProperty('srd', true);
  });

  it('rejects corrupt stored definitions and duplicate raw payloads', async () => {
    const record = await canonicalReferenceRecord(sourceRecord('object', 'objects.json'));
    const invalid = structuredClone(record);
    (invalid.referenceDefinition as unknown as JsonObject)['hp'] = 'corrupt';
    await expect(canonicalReferenceRecord(invalid)).rejects.toThrow('Content validation failed');
    await expect(canonicalReferenceRecord({ ...record, data: { entries: [] } })).rejects.toThrow('duplicate source payload');
    const version = structuredClone(record);
    (version.referenceDefinition as unknown as JsonObject)['version'] = 2;
    await expect(canonicalReferenceRecord(version)).rejects.toThrow('version or category');
  });

  it('copies installed canonical objects and skills when appending homebrew, preserving source profiles', async () => {
    const cache = new IndexedDbContentCache();
    const base: ImportRevision = {
      id: crypto.randomUUID(), namespace: crypto.randomUUID(), source: DEFAULT_CONTENT_SOURCE,
      sourceIdentity: sourceIdentity(DEFAULT_CONTENT_SOURCE), commit: 'a'.repeat(40), adapterVersion: ADAPTER_VERSION,
      schemaSnapshot: CONTENT_SCHEMA_ID, createdAt: new Date().toISOString(), status: 'staging',
      files: ['objects.json', 'skills.json'], diagnostics: [], metrics: { bytes: 0, records: 2, elapsedMs: 0, mappedBytes: 0 },
    };
    const object = sourceRecord('object', 'objects.json'); object.data['srd'] = true;
    const skill = sourceRecord('skill', 'skills.json'); skill.data['srd52'] = true;
    await cache.stage(base); await cache.put(base.id, [object, skill]);
    await finalizeContentImport(cache, base, { bytes: 0, started: performance.now() });
    expect((await cache.get(base.id, object.key))!.data).toEqual({});
    const file = await readHomebrewFile(homebrewDocumentFixture({
      object: [{ name: 'Copied Object', source: 'TESTBREW', _copy: { name: object.name, source: 'TEST' } }],
      skill: [{ name: 'Copied Skill', source: 'TESTBREW', _copy: { name: skill.name, source: 'TEST' } }],
    }), 'copies.json');
    const revision = await importHomebrew(cache, { namespace: base.namespace, source: base.source, base, file, bytes: 1 });
    const copiedObject = (await cache.category(revision.id, 'object')).find(row => row.name === 'Copied Object')!;
    const copiedSkill = (await cache.category(revision.id, 'skill')).find(row => row.name === 'Copied Skill')!;
    expect(copiedObject.referenceDefinition).toMatchObject({ kind: 'object', hp: 10, objectType: 'GEN' });
    expect(copiedSkill.referenceDefinition).toMatchObject({ kind: 'skill', ability: 'wis' });
    expect(copiedObject.data['_copy']).toBeUndefined();
    expect((await new IndexedDbContentCache().get(revision.id, copiedObject.key))!.referenceDefinition).toEqual(copiedObject.referenceDefinition);
    expect((await cache.active(base.namespace, base.source))!.id).toBe(revision.id);
    expect((await cache.get(base.id, object.key))!.referenceDefinition).toHaveProperty('srd', true);
  });
});
