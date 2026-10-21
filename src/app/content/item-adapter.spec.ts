import 'fake-indexeddb/auto';
import { mapContent } from './content-adapter';
import { assertItemDefinition, canonicalItemRecord, itemDefinition, itemSourceData } from './item-adapter';
import { itemTypeCode } from './item.model';
import { ADAPTER_VERSION, DEFAULT_CONTENT_SOURCE, ImportRevision, sourceIdentity } from './content.model';
import { CONTENT_SCHEMA_ID } from './generated/schema-version';
import { IndexedDbContentCache } from './content-cache';
import { finalizeContentImport } from './content-finalizer';
import { createInventoryEntry } from '../editor/item-selection';
import { emptyBasicCharacter } from '../editor/basic-info';
import { newCharacter, projectSheet, syncInventoryArmor } from '../editor/editor-document';
import { LocalCharacterRepository } from '../editor/local-character-repository';
import { encodeCloudCharacter, decodeCloudCharacter } from '../characters/sync/character-cloud';
import { previewContentUpdate } from '../rules/document-operations';

function fixture() {
  const rows = mapContent({
    itemType: [{ name: 'Medium Armor', abbreviation: 'MA', source: 'TEST', page: 1, entries: [] }],
    itemProperty: [{ name: 'Special', abbreviation: 'S', source: 'TEST', page: 1, entries: ['First property paragraph', 'Second property paragraph'] }],
    itemMastery: [{ name: 'Push', source: 'TEST', page: 1, entries: ['Mastery text'] }],
    class: [{ name: 'Fighter', source: 'TEST', hd: { number: 1, faces: 10 }, classFeatures: [] }],
    item: [{ name: 'Magic Armor', source: 'TEST', type: 'MA|TEST', ac: 14, bonusAc: '+1', weight: 20, value: 500,
      dexterityMax: null, strength: null, stealth: false, reqAttune: true,
      property: [{ uid: 'S|TEST', note: 'When worn' }], mastery: [{ uid: 'Push|TEST', note: 'Retained note' }], entries: ['Armor description'] }],
  }, 'synthetic.json').records;
  const item = rows.find(r => r.kind === 'item')!;
  item.links = [{ role: 'item-type', target: rows.find(r => r.kind === 'itemType')!.key },
    { role: 'item-property', target: rows.find(r => r.kind === 'itemProperty')!.key },
    { role: 'item-mastery', target: rows.find(r => r.kind === 'itemMastery')!.key }];
  const revision: ImportRevision = { id: crypto.randomUUID(), namespace: 'item-contract-tests', source: DEFAULT_CONTENT_SOURCE,
    sourceIdentity: sourceIdentity(DEFAULT_CONTENT_SOURCE), commit: 'a'.repeat(40), adapterVersion: ADAPTER_VERSION, schemaSnapshot: CONTENT_SCHEMA_ID,
    createdAt: new Date().toISOString(), status: 'ready', files: [], diagnostics: [], metrics: { bytes: 0, records: rows.length, mappedBytes: 0, elapsedMs: 0 } };
  return { rows, item, revision };
}

describe('Canonical item migration', () => {
  it('moves materialized fields once and preserves wrapper notes and nullable schema alternatives', () => {
    const f = fixture(); const original = structuredClone(f.item); const item = canonicalItemRecord(f.item);
    expect(item.itemDefinition).toMatchObject({ version: 1, type: 'MA|TEST', ac: 14, bonusAc: '+1', value: 500, reqAttune: 'by anyone',
      dexterityMax: null, strength: null, property: [{ uid: 'S|TEST', note: 'When worn' }], mastery: [{ uid: 'Push|TEST', note: 'Retained note' }] });
    expect(item.data['ac']).toBeUndefined(); expect(item.data['type']).toBeUndefined(); expect(item.data['entries']).toEqual(['Armor description']);
    expect(itemTypeCode(item)).toBe('MA'); expect(canonicalItemRecord(item)).toEqual(item); expect(f.item).toEqual(original);
    expect(itemSourceData(item)['property']).toEqual(original.data['property']);
    expect(itemDefinition({ ...f.item, data: { reqAttune: false, property: [], mastery: [] } })).toMatchObject({ reqAttune: null, property: [], mastery: [] });
  });

  it('rejects conflicting or malformed canonical mechanics and reports mechanical content updates', () => {
    const f = fixture(); const item = canonicalItemRecord(f.item);
    expect(() => assertItemDefinition({ ...item.itemDefinition, version: 2 })).toThrow('Invalid canonical item');
    expect(() => assertItemDefinition({ ...item.itemDefinition, weight: '20' })).toThrow();
    expect(() => canonicalItemRecord({ ...item, data: { ac: 20 } })).toThrow('duplicate');
    const document = newCharacter(f.revision); const parent = f.rows.find(r => r.kind === 'class')!;
    document.creation.classes.selections = [{ selectionId: 'fighter', classKey: parent.key, level: 1 }];
    document.snapshots = [parent, item];
    const updated = canonicalItemRecord(item); updated.itemDefinition.value = 750;
    const index = { sourceIdentity: f.revision.sourceIdentity, revisionId: 'next', records: new Map([[parent.key, parent], [updated.key, updated]]) };
    const preview = previewContentUpdate(document, index, { ...document.contentBindings[0], revisionId: 'next' });
    expect(preview.changes).toContainEqual({ key: item.key, kind: 'changed', fields: ['value'] });
  });

  it('keeps mechanics and property/mastery resolution when copying an installed canonical item', async () => {
    const f = fixture(); const cache = new IndexedDbContentCache(); const revision = { ...f.revision, status: 'staging' as const };
    await cache.stage(revision); await cache.put(revision.id, f.rows.map(r => r.kind === 'item' ? canonicalItemRecord(r) : r));
    const child = mapContent({ item: [{ name: 'Copied Armor', source: 'BREW', _copy: { name: 'Magic Armor', source: 'TEST' } }] }, 'homebrew/copy.json').records[0];
    await cache.put(revision.id, [child]);
    await finalizeContentImport(cache, revision, { bytes: 0, started: performance.now(), shouldProcess: r => r.file.startsWith('homebrew/') });
    const copied = (await cache.get(revision.id, child.key))!;
    expect(copied.itemDefinition).toEqual(itemDefinition(f.item)); expect(copied.data['_copy']).toBeUndefined();
    const entry = await createInventoryEntry(cache, copied, revision);
    expect(entry.entity?.item.ac).toBe(14); expect(entry.entity?.item.reqAttune).toBe('by anyone');
    expect(entry.entity?.properties?.[0].entry).toEqual({ type: 'entries', entries: ['First property paragraph', 'Second property paragraph'] });
    expect(entry.entity?.masteries?.[0].name).toBe('Push');
  });

  it('saves and exports inventory offline without changing equipment flags, quantities, notes, or uses', async () => {
    const f = fixture(); const item = canonicalItemRecord(f.item); const rows = new Map(f.rows.map(r => [r.key, r]));
    const entry = await createInventoryEntry({ get: async (_revision, key) => rows.get(key) }, item, f.revision);
    entry.count = 2; entry.isEquipped = true; entry.isAttuned = true;
    entry.notes = [{ tag: 'Notes', notes: ['Keep this note'] }];
    entry.uses = [{ tag: 'Uses', totalFreeUses: 3, usedFreeUses: 2, freeUsesRegainCondition: 'LONG_REST' }];
    const sheet = emptyBasicCharacter(); sheet.inventory = [entry];
    const document = newCharacter(f.revision); const parent = f.rows.find(r => r.kind === 'class')!;
    document.creation.classes.selections = [{ selectionId: 'fighter', classKey: parent.key, level: 1 }];
    document.snapshots = [parent, f.item]; document.presentation['sheet'] = sheet;
    syncInventoryArmor(document);
    expect(document.creation.stats.armor[0]).toMatchObject({ type: 'medium', ac: 14, bonus: 1, equipped: true, attuned: true, requiresAttunement: true });
    const network = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Offline'));
    try {
      await new LocalCharacterRepository().save(document, 0);
      const reopened = (await new LocalCharacterRepository().list()).find(r => r.id === document.id)!.document;
      expect(reopened.snapshots.find(r => r.kind === 'item')?.itemDefinition?.ac).toBe(14);
      const projected = projectSheet(reopened); expect(projected.inventory).toEqual(sheet.inventory);
      const cloud = await encodeCloudCharacter({ id: document.id, sheet: projected, version: 1, updatedAt: new Date().toISOString() }, 1);
      expect((await decodeCloudCharacter(document.id, cloud)).sheet.inventory).toEqual(sheet.inventory);
      expect(network).not.toHaveBeenCalled();
    } finally { network.mockRestore(); }
  });
});
