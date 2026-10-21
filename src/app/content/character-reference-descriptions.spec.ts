import 'fake-indexeddb/auto';
import { prepareCharacterReferenceDescriptions } from './character-reference-descriptions';
import { ContentRecord, DEFAULT_CONTENT_SOURCE, ImportRevision, entityKey, sourceIdentity } from './content.model';
import { IndexedDbContentCache } from './content-cache';
import { TestBed } from '@angular/core/testing';
import { CharacterLibraryService } from '../characters/character-library.service';
import { emptyBasicCharacter } from '../editor/basic-info';
import { IndexedDbCharacterRepository } from '../characters/indexeddb-character-repository';
import { encodeCloudCharacter, decodeCloudCharacter } from '../characters/sync/character-cloud';
import { referenceDescription } from '../models/character-references';
import { refreshCharacterDescriptions } from '../editor/refresh-character-content';

const revision: ImportRevision = { id: 'reference-revision', namespace: 'development-local', source: DEFAULT_CONTENT_SOURCE,
  sourceIdentity: sourceIdentity(DEFAULT_CONTENT_SOURCE), commit: 'a'.repeat(40), adapterVersion: 22, status: 'ready',
  createdAt: new Date().toISOString(), files: [], diagnostics: [], metrics: { bytes: 0, records: 0, elapsedMs: 0, mappedBytes: 0 } };
function record(kind: 'skill' | 'sense' | 'condition', name: string, source = 'XPHB', text = `${name} rules`): ContentRecord {
  return { kind, name, publication: source, key: entityKey(kind, { name, source }), file: 'reference.json', data: {}, links: [],
    referenceDefinition: { kind, version: 1, name, source, entries: [text] } };
}
function cacheFor(records: ContentRecord[]) {
  return { get: vi.fn(async (_revision: string, key: string) => records.find(record => record.key === key)) };
}

describe('Character reference snapshots', () => {
  it('fills existing and newly saved characters from the installed library and reopens them without that library', async () => {
    const cache = new IndexedDbContentCache();
    const installed = { ...revision, id: crypto.randomUUID() };
    await cache.stage(installed); await cache.put(installed.id, [record('skill', 'Arcana'), record('sense', 'Darkvision'), record('condition', 'Blinded')]);
    await cache.activate(installed); await cache.saveSource('development-local', installed.source);
    const sheet = emptyBasicCharacter(); sheet.character!.name = 'Offline references';
    const library = TestBed.inject(CharacterLibraryService);
    const repository = new IndexedDbCharacterRepository();
    await repository.save(sheet, 0);
    const opened = (await library.get(sheet.character!.characterUuid!))!;
    expect(referenceDescription(opened.sheet, 'conditions', 'BLINDED')?.entries).toEqual(['Blinded rules']);
    const savedVersion = await library.save(opened.sheet, opened.version);
    expect(savedVersion).toBe(2);
    const fresh = emptyBasicCharacter(); fresh.character!.name = 'Fresh snapshot';
    await library.save(fresh, 0);
    expect((await repository.get(fresh.character!.characterUuid!))?.sheet.referenceDescriptions?.skills[0].name).toBe('Arcana');
    const unavailable = vi.spyOn(IndexedDbContentCache.prototype, 'active').mockResolvedValue(undefined);
    try {
      const offline = (await library.get(sheet.character!.characterUuid!))!;
      expect(offline.sheet.referenceDescriptions).toEqual(opened.sheet.referenceDescriptions);
    } finally { unavailable.mockRestore(); }
  });

  it('prefers XPHB definitions, falls back explicitly, and persists detached definitions offline', async () => {
    const old = record('skill', 'Arcana', 'PHB', 'Old Arcana');
    const current = record('skill', 'Arcana');
    const cache = cacheFor([old, current, record('sense', 'Darkvision'), record('condition', 'Blinded', 'PHB')]);
    const sheet = emptyBasicCharacter(); sheet.conditions = ['BLINDED']; sheet.character!.senses = { Darkvision: 60 };
    const before = structuredClone(sheet.character);
    expect(await prepareCharacterReferenceDescriptions(sheet, cache, revision)).toBe(3);
    expect(referenceDescription(sheet, 'skills', 'ARCANA')?.entries).toEqual(['Arcana rules']);
    expect(referenceDescription(sheet, 'conditions', 'BLINDED')?.source).toBe('PHB');
    expect(sheet.character).toEqual(before); expect(sheet.conditions).toEqual(['BLINDED']);
    current.referenceDefinition = { kind: 'skill', version: 1, name: 'Arcana', source: 'XPHB', entries: ['Changed cache'] };
    expect(referenceDescription(sheet, 'skills', 'Arcana')?.entries).toEqual(['Arcana rules']);
    const repository = new IndexedDbCharacterRepository(`references-${crypto.randomUUID()}`);
    await repository.save(sheet, 0);
    const saved = (await repository.get(sheet.character!.characterUuid!))!;
    const cloud = await encodeCloudCharacter(saved, 1);
    const decoded = await decodeCloudCharacter(saved.id, cloud);
    expect(decoded.sheet.referenceDescriptions).toEqual(sheet.referenceDescriptions);
  });

  it('keeps saved definitions until explicit refresh and does not replace missing or foreign definitions', async () => {
    const sheet = emptyBasicCharacter(), cache = cacheFor([record('skill', 'Arcana')]);
    await prepareCharacterReferenceDescriptions(sheet, cache, revision);
    const changed = cacheFor([record('skill', 'Arcana', 'XPHB', 'New description')]);
    await prepareCharacterReferenceDescriptions(sheet, changed, revision);
    expect(referenceDescription(sheet, 'skills', 'Arcana')?.entries).toEqual(['Arcana rules']);
    const result = await refreshCharacterDescriptions(sheet, changed, revision);
    expect(result.refreshed).toBe(1);
    expect(referenceDescription(result.sheet, 'skills', 'Arcana')?.entries).toEqual(['New description']);
    expect(referenceDescription(sheet, 'skills', 'Arcana')?.entries).toEqual(['Arcana rules']);
    await prepareCharacterReferenceDescriptions(sheet, cacheFor([]), revision, true);
    expect(referenceDescription(sheet, 'skills', 'Arcana')?.entries).toEqual(['Arcana rules']);
    await prepareCharacterReferenceDescriptions(sheet, changed, { ...revision, sourceIdentity: 'other-library' }, true);
    expect(referenceDescription(sheet, 'skills', 'Arcana')?.entries).toEqual(['Arcana rules']);
  });
});
