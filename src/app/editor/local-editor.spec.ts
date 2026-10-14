import 'fake-indexeddb/auto';
import { mapContent } from '../content/content-adapter';
import { ADAPTER_VERSION, DEFAULT_CONTENT_SOURCE, ImportRevision, sourceIdentity } from '../content/content.model';
import { acceptDocumentPreview, previewContentUpdate, previewDocument } from '../rules/document-operations';
import { parseCharacterDocument } from '../rules/character-document';
import { bindingFor, captureSheet, newCharacter, projectSheet, syncInventoryArmor } from './editor-document';
import { LocalCharacterRepository } from './local-character-repository';

function fixture() {
  const records = mapContent({ class: [{ name: 'Fighter', source: 'TEST', hd: { number: 1, faces: 10 },
    proficiency: ['str', 'con'], classFeatures: ['Training|Fighter|TEST|1'] }],
    classFeature: [{ name: 'Training', source: 'TEST', className: 'Fighter', classSource: 'TEST', level: 1, entries: ['Training text'] }],
    feat: [{ name: 'Manual feat', source: 'TEST', entries: ['Keep'] }] }, 'test.json').records;
  const revision: ImportRevision = { id: crypto.randomUUID(), namespace: 'development-local', source: DEFAULT_CONTENT_SOURCE,
    sourceIdentity: sourceIdentity(DEFAULT_CONTENT_SOURCE), commit: 'a'.repeat(40), adapterVersion: ADAPTER_VERSION,
    status: 'ready', createdAt: new Date().toISOString(), files: [], diagnostics: [], metrics: { bytes: 0, records: 3, elapsedMs: 0, mappedBytes: 0 } };
  const document = newCharacter(revision); document.identity.name = 'Integration';
  document.creation.classes.selections = [{ selectionId: 'fighter', classKey: records[0].key, level: 3 }];
  const index = { sourceIdentity: revision.sourceIdentity, revisionId: revision.id, records: new Map(records.map(r => [r.key, r])) };
  return { document, index, revision, records };
}

describe('Local creator persistence and sheet integration', () => {
  it('creates, saves, reopens, levels and exports without losing authored data or overrides', async () => {
    const f = fixture(); const repository = new LocalCharacterRepository();
    f.document.overrides.armorClass = 17;
    f.document.session.annotations['character'] = ['Keep note'];
    f.document.presentation['sheet'] = { inventory: [{ name: 'Rope', count: 2 }], notes: [{ id: 1, title: 'Journal', body: 'Keep' }] };
    f.document.instances.features.push({ id: 'manual', sourceIdentity: f.index.sourceIdentity, revisionId: f.index.revisionId,
      contentKey: f.records[2].key, snapshot: f.records[2], manual: true, grants: [], customization: { text: 'Keep customization' } });
    let saved = acceptDocumentPreview(f.document, previewDocument(f.document, f.index));
    let version = await repository.save(saved, 0);
    const reopened = (await new LocalCharacterRepository().list()).find(e => e.id === saved.id)!;
    expect(reopened.document).toEqual(saved);
    saved = reopened.document;
    saved.creation.classes.selections[0].level = 4;
    saved = acceptDocumentPreview(saved, previewDocument(saved, f.index));
    version = await repository.save(saved, version);
    const exported = parseCharacterDocument(JSON.stringify(saved));
    expect(exported.derived?.maxHp).toBe(28);
    expect(exported.derived?.stats.ac).toBe(17);
    expect(exported.instances.features.find(f => f.id === 'manual')?.customization).toEqual({ text: 'Keep customization' });
    expect(projectSheet(exported).inventory?.[0].count).toBe(2);
    expect(exported.session.annotations['character']).toEqual(['Keep note']);
    expect(version).toBe(2);
  });

  it('recovers incomplete drafts and rejects stale writes and deletes', async () => {
    const f = fixture(); f.document.creation.classes.selections = [];
    const repository = new LocalCharacterRepository();
    const version = await repository.save(f.document, 0, true);
    const entry = (await new LocalCharacterRepository().list()).find(e => e.id === f.document.id)!;
    expect(entry.draft?.creation.classes.selections).toEqual([]);
    await expect(repository.save(f.document, 0, true)).rejects.toThrow('another tab');
    await expect(repository.remove(f.document.id, 0)).rejects.toThrow('changed');
    await repository.remove(f.document.id, version);
    expect((await repository.list()).some(e => e.id === f.document.id)).toBe(false);
  });

  it('captures sheet health, notes and hit dice by stable identity', () => {
    const f = fixture(); const saved = acceptDocumentPreview(f.document, previewDocument(f.document, f.index));
    const sheet = projectSheet(saved);
    sheet.character!.currentHp = 4; sheet.character!.tempHp = 3;
    if (Array.isArray(sheet.character!.hitDice)) sheet.character!.hitDice[0].used = 2;
    sheet.features![0].notes![0].notes = ['Session note'];
    const captured = captureSheet(saved, sheet);
    const next = acceptDocumentPreview(captured, previewDocument(captured, f.index));
    expect(next.session.currentHp).toBe(4); expect(next.session.tempHp).toBe(3);
    expect(next.session.resources[next.instances.pools[0].id].used).toBe(2);
    expect(next.session.annotations[next.instances.features[0].id]).toEqual(['Session note']);
  });

  it('normalizes equipped armor without duplicating inputs and updates content explicitly', () => {
    const f = fixture(); f.document.creation.abilities.dex = 14;
    f.document.presentation['sheet'] = { inventory: [{ name: 'Mail', isEquipped: true, entity: { item: { name: 'Mail', source: 'TEST', type: 'MA', ac: 14 } } }] };
    syncInventoryArmor(f.document); syncInventoryArmor(f.document);
    expect(f.document.creation.stats.armor).toHaveLength(1);
    const saved = acceptDocumentPreview(f.document, previewDocument(f.document, f.index));
    expect(saved.derived?.stats.ac).toBe(16);
    const target = { ...f.revision, id: crypto.randomUUID(), commit: 'b'.repeat(40) };
    const records = f.records.map(r => ({ ...r, data: { ...r.data, entries: ['Updated text'] } }));
    const index = { ...f.index, revisionId: target.id, records: new Map(records.map(r => [r.key, r])) };
    const update = previewContentUpdate(saved, index, bindingFor(target));
    expect(update.changes.length).toBeGreaterThan(0);
    const updated = acceptDocumentPreview(saved, update);
    expect(updated.contentBindings[0].commit).toBe(target.commit);
    expect(updated.presentation).toEqual(saved.presentation);
    expect(updated.session).toEqual(saved.session);
  });
});
