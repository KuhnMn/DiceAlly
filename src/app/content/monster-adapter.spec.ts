import 'fake-indexeddb/auto';
import { mapContent } from './content-adapter';
import { assertMonsterDefinition, canonicalMonsterRecord, monsterSourceData, projectMonsterData } from './monster-adapter';
import { ADAPTER_VERSION, DEFAULT_CONTENT_SOURCE, ImportRevision, sourceIdentity } from './content.model';
import { CONTENT_SCHEMA_ID } from './generated/schema-version';
import { IndexedDbContentCache } from './content-cache';
import { finalizeContentImport } from './content-finalizer';
import { createMonsterEntry, setMonsterMaxHp } from '../editor/monster-selection';
import { emptyBasicCharacter } from '../editor/basic-info';
import { newCharacter, projectSheet } from '../editor/editor-document';
import { LocalCharacterRepository } from '../editor/local-character-repository';
import { encodeCloudCharacter, decodeCloudCharacter } from '../characters/sync/character-cloud';
import { previewContentUpdate } from '../rules/document-operations';

function fixture() {
  const rows = mapContent({ monster: [{ name: 'Watcher', source: 'TEST', size: ['M'], type: { type: 'undead', tags: ['shapechanger'] },
    alignment: ['N'], hp: { average: 15, formula: '2d8+6' }, ac: [{ ac: 14, from: ['natural armor'], condition: 'while awake' }],
    speed: { walk: 30, fly: { number: 40, condition: 'at night' }, canHover: true }, str: 14, dex: 12, con: 16,
    int: { special: 'Varies' }, wis: 14, cha: null, passive: null, senses: ['darkvision 60 ft.'], languages: ['Common'], cr: { cr: '1', lair: '2' },
    resist: [{ resist: ['cold'], note: 'at night' }], action: [{ name: 'Watch', entries: ['Action text'] }],
    save: { wis: '+4' }, spellcasting: [{ name: 'Magic', headerEntries: ['Spellcasting text'], will: ['Light|TEST'] }] }],
    class: [{ name: 'Fighter', source: 'TEST', hd: { number: 1, faces: 10 }, classFeatures: [] }],
  }, 'synthetic.json').records;
  const monster = rows.find(r => r.kind === 'monster')!;
  const revision: ImportRevision = { id: crypto.randomUUID(), namespace: 'monster-contract-tests', source: DEFAULT_CONTENT_SOURCE,
    sourceIdentity: sourceIdentity(DEFAULT_CONTENT_SOURCE), commit: 'a'.repeat(40), adapterVersion: ADAPTER_VERSION, schemaSnapshot: CONTENT_SCHEMA_ID,
    createdAt: new Date().toISOString(), status: 'ready', files: [], diagnostics: [], metrics: { bytes: 0, records: rows.length, mappedBytes: 0, elapsedMs: 0 } };
  return { rows, monster, revision };
}

describe('Canonical monster migration', () => {
  it('preserves stat alternatives once and keeps the existing self-contained presentation projection', () => {
    const f = fixture(); const before = structuredClone(f.monster); const canonical = canonicalMonsterRecord(f.monster);
    expect(canonical.monsterDefinition).toMatchObject({ hp: { average: 15, formula: '2d8+6' }, int: { special: 'Varies' }, cha: null,
      speed: { fly: { number: 40, condition: 'at night' }, canHover: true }, cr: { cr: '1', lair: '2' } });
    expect(canonical.data['hp']).toBeUndefined(); expect(canonical.data['speed']).toBeUndefined();
    expect(canonical.data['action']).toEqual(before.data['action']); expect(canonical.data['save']).toEqual(before.data['save']);
    expect(monsterSourceData(canonical)).toEqual(before.data); expect(canonicalMonsterRecord(canonical)).toEqual(canonical);
    const projected = projectMonsterData(canonical);
    expect(projected['speed']).toEqual({ walk: 30, fly: 40 }); expect(projected['type']).toEqual(before.data['type']);
    expect(projected['spellcasting']).toEqual(before.data['spellcasting']); expect(f.monster).toEqual(before);
    const special = canonicalMonsterRecord({ ...f.monster, data: { type: 'beast', hp: { special: 'Depends on level' }, speed: 'Varies' } });
    expect(projectMonsterData(special)).toMatchObject({ type: { type: 'beast' }, hp: { special: 'Depends on level' }, speed: 'Varies' });
  });

  it('rejects corrupted/duplicated stats and includes canonical HP changes in content update previews', () => {
    const f = fixture(); const canonical = canonicalMonsterRecord(f.monster);
    expect(() => assertMonsterDefinition({ ...canonical.monsterDefinition, version: 2 })).toThrow('Invalid canonical monster');
    expect(() => assertMonsterDefinition({ ...canonical.monsterDefinition, str: '14' })).toThrow();
    expect(() => canonicalMonsterRecord({ ...canonical, data: { hp: { special: 'Duplicate' } } })).toThrow('duplicate');
    const document = newCharacter(f.revision); const parent = f.rows.find(r => r.kind === 'class')!;
    document.creation.classes.selections = [{ selectionId: 'fighter', classKey: parent.key, level: 1 }]; document.snapshots = [parent, canonical];
    const updated = canonicalMonsterRecord(canonical); updated.monsterDefinition.hp = { average: 20, formula: '3d8+6' };
    const index = { sourceIdentity: f.revision.sourceIdentity, revisionId: 'next', records: new Map([[parent.key, parent], [updated.key, updated]]) };
    const preview = previewContentUpdate(document, index, { ...document.contentBindings[0], revisionId: 'next' });
    expect(preview.changes).toContainEqual({ key: canonical.key, kind: 'changed', fields: ['hp'] });
  });

  it('restores source fields when a homebrew copy applies an existing template to an installed monster', async () => {
    const f = fixture(); const cache = new IndexedDbContentCache(); const revision = { ...f.revision, status: 'staging' as const };
    const template = mapContent({ monsterTemplate: [{ name: 'Large', source: 'TEST', apply: { _root: { size: ['L'] } } }] }, 'synthetic-template.json').records[0];
    const child = mapContent({ monster: [{ name: 'Large Watcher', source: 'BREW', _copy: { name: 'Watcher', source: 'TEST', _templates: [{ name: 'Large', source: 'TEST' }] } }] }, 'homebrew/copy.json').records[0];
    await cache.stage(revision); await cache.put(revision.id, [canonicalMonsterRecord(f.monster), template, child]);
    await finalizeContentImport(cache, revision, { bytes: 0, started: performance.now(), shouldProcess: r => r.file.startsWith('homebrew/') });
    const copied = (await cache.get(revision.id, child.key))!;
    expect(copied.monsterDefinition?.size).toEqual(['L']); expect(copied.monsterDefinition?.hp).toEqual(f.monster.data['hp']);
    expect(copied.data['action']).toEqual(f.monster.data['action']); expect(copied.data['_copy']).toBeUndefined();
  });

  it('retains detached stat blocks, HP trackers, notes and uses through offline native and portable saves', async () => {
    const f = fixture(); const monster = createMonsterEntry(canonicalMonsterRecord(f.monster), f.revision);
    expect(monster.hpEnabled).toBe(false); expect(monster.monsterMaxHP).toBeUndefined();
    setMonsterMaxHp(monster, 25); monster.monsterCurrentHP = 7; monster.monsterTempHP = 3;
    monster.notes = [{ tag: 'Notes', notes: ['Retain note'] }];
    monster.uses = [{ tag: 'Uses', totalFreeUses: 3, usedFreeUses: 2, freeUsesRegainCondition: 'LONG_REST' }];
    const sheet = emptyBasicCharacter(); sheet.monsters = [monster];
    const document = newCharacter(f.revision); const parent = f.rows.find(r => r.kind === 'class')!;
    document.creation.classes.selections = [{ selectionId: 'fighter', classKey: parent.key, level: 1 }];
    document.snapshots = f.rows; document.presentation['sheet'] = sheet;
    const network = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Offline'));
    try {
      await new LocalCharacterRepository().save(document, 0);
      const reopened = (await new LocalCharacterRepository().list()).find(r => r.id === document.id)!.document;
      expect(reopened.snapshots.find(r => r.kind === 'monster')?.monsterDefinition?.hp).toEqual(f.monster.data['hp']);
      const projected = projectSheet(reopened); expect(projected.monsters).toEqual(sheet.monsters);
      const encoded = await encodeCloudCharacter({ id: document.id, sheet: projected, version: 1, updatedAt: new Date().toISOString() }, 1);
      expect((await decodeCloudCharacter(document.id, encoded)).sheet.monsters).toEqual(sheet.monsters);
      expect(network).not.toHaveBeenCalled();
    } finally { network.mockRestore(); }
  });
});
