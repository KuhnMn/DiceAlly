import 'fake-indexeddb/auto';
import { TestBed } from '@angular/core/testing';
import { prepareCharacterReferenceDescriptions } from './character-reference-descriptions';
import { prepareBasicActionDescriptions } from './basic-action-descriptions';
import { IndexedDbContentCache } from './content-cache';
import { ContentRecord, DEFAULT_CONTENT_SOURCE, ImportRevision, entityKey, sourceIdentity } from './content.model';
import type { ActionDefinition } from './action.model';
import { emptyBasicCharacter } from '../editor/basic-info';
import { refreshCharacterDescriptions } from '../editor/refresh-character-content';
import { CharacterLibraryService } from '../characters/character-library.service';
import { IndexedDbCharacterRepository } from '../characters/indexeddb-character-repository';
import { encodeCloudCharacter, decodeCloudCharacter } from '../characters/sync/character-cloud';

const revision: ImportRevision = { id: 'basic-actions', namespace: 'development-local', source: DEFAULT_CONTENT_SOURCE,
  sourceIdentity: sourceIdentity(DEFAULT_CONTENT_SOURCE), commit: 'a'.repeat(40), adapterVersion: 22, status: 'ready',
  createdAt: new Date().toISOString(), files: [], diagnostics: [], metrics: { bytes: 0, records: 0, elapsedMs: 0, mappedBytes: 0 } };
function action(name: string, time: ActionDefinition['time'], source = 'XPHB', text = `${name} rules`): ContentRecord {
  return { kind: 'action', name, publication: source, key: entityKey('action', { name, source }), file: 'actions.json', data: {}, links: [],
    referenceDefinition: { kind: 'action', version: 1, name, source, page: 1, entries: [text], ...(time ? { time } : {}) } };
}
function cacheFor(records: ContentRecord[]) {
  return { get: vi.fn(async (_revision: string, key: string) => records.find(record => record.key === key)),
    category: vi.fn(async () => [...records]) };
}

describe('Basic combat action snapshots', () => {
  it('uses declared timing, supports multiple sections and prefers current rules for duplicate names', async () => {
    const records = [action('Attack', [{ number: 1, unit: 'action' }], 'PHB', 'Old attack'),
      action('Attack', [{ number: 1, unit: 'action' }]), action('Opportunity Attack', [{ number: 1, unit: 'reaction' }]),
      action('Multiple timings', [{ number: 1, unit: 'action' }, { number: 1, unit: 'bonus' }], 'XDMG'),
      action('End Concentration', ['Free']), action('Cast a Spell', ['Varies']), action('Mark', undefined, 'DMG')];
    const cache = cacheFor(records), sheet = emptyBasicCharacter();
    const before = structuredClone(sheet);
    expect(await prepareCharacterReferenceDescriptions(sheet, cache, revision)).toBe(5);
    expect(cache.category).toHaveBeenCalledWith(revision.id, 'action', 0);
    expect(sheet.basicActions?.find(entry => entry.name === 'Attack')).toMatchObject({ source: 'XPHB', entries: ['Attack rules'], actionTypes: ['ACTION'] });
    expect(sheet.basicActions?.find(entry => entry.name === 'Opportunity Attack')?.actionTypes).toEqual(['REACTION']);
    expect(sheet.basicActions?.find(entry => entry.name === 'Multiple timings')?.actionTypes).toEqual(['ACTION', 'BONUS']);
    expect(sheet.basicActions?.find(entry => entry.name === 'Mark')).toBeUndefined();
    for (const name of ['End Concentration', 'Cast a Spell']) {
      expect(sheet.basicActions?.find(entry => entry.name === name)?.actionTypes).toEqual(['OTHER']);
    }
    expect({ ...sheet, basicActions: undefined }).toEqual({ ...before, basicActions: undefined });
    const definition = records[1].referenceDefinition;
    if (definition?.kind === 'action') definition.entries[0] = 'Changed cache';
    expect(sheet.basicActions?.find(entry => entry.name === 'Attack')?.entries).toEqual(['Attack rules']);
  });

  it('keeps snapshots until refresh and retains missing or foreign references', async () => {
    const sheet = emptyBasicCharacter();
    await prepareBasicActionDescriptions(sheet, cacheFor([action('Attack', [{ number: 1, unit: 'action' }])]), revision, false);
    const changed = cacheFor([action('Attack', [{ number: 1, unit: 'action' }], 'XPHB', 'Updated attack')]);
    await prepareBasicActionDescriptions(sheet, changed, revision, false);
    expect(sheet.basicActions?.[0].entries).toEqual(['Attack rules']);
    const refreshed = await refreshCharacterDescriptions(sheet, changed, revision);
    expect(refreshed.refreshed).toBe(1);
    expect(refreshed.sheet.basicActions?.[0].entries).toEqual(['Updated attack']);
    await prepareBasicActionDescriptions(sheet, cacheFor([]), revision, true);
    await prepareBasicActionDescriptions(sheet, changed, { ...revision, sourceIdentity: 'another-library' }, true);
    expect(sheet.basicActions?.[0].entries).toEqual(['Attack rules']);
  });

  it('enriches existing characters from IndexedDB and keeps descriptions through save, export and sync', async () => {
    const cache = new IndexedDbContentCache(), installed = { ...revision, id: crypto.randomUUID() };
    await cache.stage(installed);
    await cache.put(installed.id, [action('Attack', [{ number: 1, unit: 'action' }])]);
    await cache.activate(installed); await cache.saveSource('development-local', installed.source);
    const library = TestBed.inject(CharacterLibraryService), repository = new IndexedDbCharacterRepository();
    const sheet = emptyBasicCharacter();
    await repository.save(sheet, 0);
    const opened = (await library.get(sheet.character!.characterUuid!))!;
    expect(opened.sheet.basicActions?.[0].name).toBe('Attack');
    await library.save(opened.sheet, opened.version);
    const saved = (await repository.get(opened.id))!;
    expect(JSON.parse(JSON.stringify(saved.sheet)).basicActions).toEqual(opened.sheet.basicActions);
    const decoded = await decodeCloudCharacter(saved.id, await encodeCloudCharacter(saved, 1));
    expect(decoded.sheet.basicActions).toEqual(opened.sheet.basicActions);
  });
});
