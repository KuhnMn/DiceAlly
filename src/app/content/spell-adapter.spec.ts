import 'fake-indexeddb/auto';
import { mapContent } from './content-adapter';
import { assertSpellDefinition, canonicalSpellRecord, projectSpellData, spellDefinition, spellRecordClasses, spellSourceData } from './spell-adapter';
import { ADAPTER_VERSION, DEFAULT_CONTENT_SOURCE, ImportRevision, sourceIdentity } from './content.model';
import { CONTENT_SCHEMA_ID } from './generated/schema-version';
import { filterSpells } from '../rules/spell-filters';
import { spellSnapshot, matchesSpell } from '../editor/spell-selection';
import { newCharacter, projectSheet, snapshotIndex } from '../editor/editor-document';
import { parseCharacterDocument } from '../rules/character-document';
import { acceptDocumentPreview, previewContentUpdate, previewDocument } from '../rules/document-operations';
import { castDocumentSpell } from '../rules/casting-rules';
import { LocalCharacterRepository } from '../editor/local-character-repository';
import { IndexedDbContentCache } from './content-cache';
import { finalizeContentImport } from './content-finalizer';
import { encodeCloudCharacter, decodeCloudCharacter } from '../characters/sync/character-cloud';
import { prepareSpellDetails } from '../sheet/spell-presentation';

function fixture() {
  const records = mapContent({
    class: [{ name: 'Mage', source: 'TEST', hd: { number: 1, faces: 6 }, classFeatures: [], casterProgression: 'full', spellcastingAbility: 'int',
      additionalSpells: [{ ability: 'int', prepared: { '1': ['Ward|TEST'] } }] }],
    spell: [{ name: 'Ward', source: 'TEST', level: 1, school: 'A', time: [{ number: 1, unit: 'action' }, { number: 1, unit: 'minute', condition: 'as a ritual' }],
      range: { type: 'point', distance: { type: 'feet', amount: 30, typeSecondary: 'miles', amountSecondary: 1 } },
      components: { v: true, s: true, m: { text: 'A gem', cost: 100, consume: 'optional' }, r: true },
      duration: [{ type: 'timed', duration: { type: 'minute', amount: 1 }, concentration: true }],
      meta: { ritual: true, technomagic: true }, spellAttack: ['R'], entries: ['A spell description'],
      entriesHigherLevel: [{ type: 'entries', name: 'At Higher Levels', entries: ['Preserved text'] }],
      classes: { fromClassList: [{ name: 'Mage', source: 'TEST' }], fromSubclass: [{ class: { name: 'Mage', source: 'TEST' },
        subclass: { name: 'Scholar', shortName: 'Scholar', source: 'TEST' } }] } }],
  }, 'synthetic.json').records;
  const spell = records.find(r => r.kind === 'spell')!; const parent = records.find(r => r.kind === 'class')!;
  const revision: ImportRevision = { id: crypto.randomUUID(), namespace: 'spell-contract-tests', source: DEFAULT_CONTENT_SOURCE,
    sourceIdentity: sourceIdentity(DEFAULT_CONTENT_SOURCE), commit: 'a'.repeat(40), adapterVersion: ADAPTER_VERSION, schemaSnapshot: CONTENT_SCHEMA_ID,
    createdAt: new Date().toISOString(), status: 'ready', files: [], diagnostics: [], metrics: { bytes: 0, records: records.length, mappedBytes: 0, elapsedMs: 0 } };
  return { records, spell, parent, revision };
}

describe('Canonical spell migration', () => {
  it('prepares details from a detached portable snapshot without a library lookup or extra stored fields', () => {
    const snapshot = spellSnapshot(canonicalSpellRecord(fixture().spell));
    const json = JSON.stringify(snapshot);
    const restored = JSON.parse(json) as typeof snapshot;
    expect(prepareSpellDetails(restored)).toMatchObject({
      castingTimes: [{ durationText: '1 action' }, { durationText: '1 minute', conditionText: 'as a ritual' }],
      components: { material: { descriptionText: 'A gem', costInCopperPieces: 100, consumption: 'optional' }, requiresRoyalty: true },
      durations: [{ durationText: 'Up to 1 minute', requiresConcentration: true }], hasRitualCastingOption: true,
    });
    expect(JSON.stringify(restored)).toBe(json);
    expect(restored).not.toHaveProperty('details');
  });
  it('preserves real schema alternatives, removes duplicate fields, and exports conventional spell entities', () => {
    const f = fixture(); const original = structuredClone(f.spell); const canonical = canonicalSpellRecord(f.spell);
    expect(canonical.data['level']).toBeUndefined(); expect(canonical.data['classes']).toBeUndefined();
    expect(canonical.spellDefinition).toMatchObject({ version: 1, level: 1, meta: { ritual: true, technomagic: true },
      time: [{ unit: 'action' }, { unit: 'minute' }], components: { m: { cost: 100, consume: 'optional' }, r: true },
      range: { distance: { typeSecondary: 'miles', amountSecondary: 1 } } });
    expect(canonical.data['entriesHigherLevel']).toEqual(original.data['entriesHigherLevel']);
    expect(spellSnapshot(canonical)).toMatchObject({ level: 1, school: 'A', classes: [{ name: 'Mage', source: 'TEST' }], entries: ['A spell description'] });
    expect(canonicalSpellRecord(canonical)).toEqual(canonical); expect(f.spell).toEqual(original);
    for (const material of [true, false, 'A feather']) {
      const raw = { ...f.spell, data: { ...f.spell.data, components: { m: material } } };
      expect(projectSpellData(canonicalSpellRecord(raw))['components']).toEqual({ m: material });
    }
  });

  it('merges exact inline and overlay profiles, retaining variant and subclass metadata once', () => {
    const f = fixture(); const canonical = canonicalSpellRecord(f.spell, {
      class: [{ name: 'Bard', source: 'TEST' }, { name: 'Mage', source: 'TEST' }],
      classVariant: [{ name: 'Mage', source: 'TEST', definedInSource: 'BOOK' }],
    });
    expect(canonical.spellDefinition.memberships.fromClassList).toHaveLength(2);
    expect(canonical.spellDefinition.memberships.fromClassListVariant[0].definedInSource).toBe('BOOK');
    expect(canonical.spellDefinition.memberships.fromSubclass).toEqual((f.spell.data['classes'] as Record<string, unknown>)['fromSubclass']);
    expect(spellRecordClasses(canonical).map(c => c.name)).toEqual(['Mage', 'Bard']);
    const legacy = { ...f.spell, data: { ...f.spell.data, classes: [{ name: 'Mage', source: 'TEST' }] } };
    expect(spellRecordClasses(canonicalSpellRecord(legacy))).toEqual([{ name: 'Mage', source: 'TEST' }]);
    expect(spellSourceData(canonical)['classes']).toEqual(canonical.spellDefinition.memberships);
  });

  it('uses canonical fields for existing filters and rejects corrupted snapshots without inventing defaults', () => {
    const f = fixture(); const canonical = canonicalSpellRecord(f.spell);
    const index = new Map([[canonical.key, canonical]]);
    expect(filterSpells('level=1|class=Mage|school=A|spell attack=R|components & miscellaneous=ritual', index)).toEqual([canonical]);
    expect(matchesSpell(canonical, { search: 'Ward', classes: ['Mage'], levels: [1] })).toBe(true);
    expect(() => assertSpellDefinition({ ...canonical.spellDefinition, version: 2 })).toThrow('Invalid canonical spell');
    expect(() => assertSpellDefinition({ ...canonical.spellDefinition, range: { type: 'point', distance: { type: 'feet', amount: '30' } } })).toThrow();
    expect(() => canonicalSpellRecord({ ...canonical, data: { level: 2 } })).toThrow('duplicate');
    expect(() => canonicalSpellRecord({ ...f.spell, data: { level: null } })).toThrow();
    expect(() => canonicalSpellRecord({ ...f.spell, data: { level: 1, classes: { class: [{ name: 'Mage', source: 'TEST' }] } } })).toThrow('Unknown inline');
  });

  it('keeps copied spell mechanics and memberships when copying an installed canonical definition', async () => {
    const f = fixture(); const cache = new IndexedDbContentCache(); const revision = { ...f.revision, status: 'staging' as const };
    await cache.stage(revision); await cache.put(revision.id, [canonicalSpellRecord(f.spell)]);
    const child = mapContent({ spell: [{ name: 'Copied Ward', source: 'BREW', _copy: { name: 'Ward', source: 'TEST' } }] }, 'homebrew/copy.json').records[0];
    await cache.put(revision.id, [child]);
    await finalizeContentImport(cache, revision, { bytes: 0, started: performance.now(), shouldProcess: r => r.file.startsWith('homebrew/') });
    const copied = (await cache.get(revision.id, child.key))!;
    expect(copied.spellDefinition).toEqual(spellDefinition(f.spell)); expect(copied.data['_copy']).toBeUndefined();
  });

  it('migrates, saves, reopens, casts and exports offline while retaining IDs, notes and spent slots', async () => {
    const f = fixture(); const document = newCharacter(f.revision);
    document.creation.classes.selections = [{ selectionId: 'mage', classKey: f.parent.key, level: 3 }];
    document.snapshots = f.records;
    const migrated = parseCharacterDocument(JSON.stringify(document));
    expect(migrated.snapshots.find(r => r.kind === 'spell')?.spellDefinition?.level).toBe(1);
    const preview = previewDocument(migrated, snapshotIndex(migrated)); expect(preview.diagnostics).toEqual([]);
    const accepted = acceptDocumentPreview(migrated, preview); const spell = accepted.instances.spells[0];
    spell.customization = { retained: true }; accepted.session.annotations[spell.id] = ['Keep note'];
    const pool = accepted.instances.pools.find(p => p.kind === 'spell-slots')!; accepted.session.resources[pool.id].used = 1;
    const network = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Offline'));
    try {
      const repository = new LocalCharacterRepository(); await repository.save(accepted, 0);
      const reopened = (await new LocalCharacterRepository().list()).find(r => r.id === accepted.id)!.document;
      expect(reopened.instances.spells[0].id).toBe(spell.id); expect(reopened.instances.spells[0].customization).toEqual(spell.customization);
      expect(reopened.session.resources[pool.id].used).toBe(1);
      const cast = castDocumentSpell(reopened, { spellId: spell.id, mode: 'slot', poolId: pool.id });
      expect(cast.document.session.resources[pool.id].used).toBe(2); expect(reopened.session.resources[pool.id].used).toBe(1);
      const sheet = projectSheet(reopened);
      expect(sheet.spells?.[0].entity?.classes).toEqual([{ name: 'Mage', source: 'TEST' }]);
      expect(sheet.spells?.[0].notes?.[0].notes).toEqual(['Keep note']);
      const cloud = await encodeCloudCharacter({ id: reopened.id, sheet, version: 1, updatedAt: new Date().toISOString() }, 1);
      expect((await decodeCloudCharacter(reopened.id, cloud)).sheet.spells).toEqual(sheet.spells);
      const updatedSpell = canonicalSpellRecord(f.spell); updatedSpell.spellDefinition.level = 2;
      const updateIndex = { ...snapshotIndex(reopened), revisionId: 'next', records: new Map(snapshotIndex(reopened).records).set(updatedSpell.key, updatedSpell) };
      const update = previewContentUpdate(reopened, updateIndex, { ...reopened.contentBindings[0], revisionId: 'next' });
      expect(update.changes).toContainEqual({ key: spell.contentKey, kind: 'changed', fields: ['level'] });
      expect(network).not.toHaveBeenCalled();
    } finally { network.mockRestore(); }
  });
});
