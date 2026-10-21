import 'fake-indexeddb/auto';
import { ContentRecord, ADAPTER_VERSION, DEFAULT_CONTENT_SOURCE, ImportRevision, entityKey, sourceIdentity } from '../content/content.model';
import { IndexedDbContentCache } from '../content/content-cache';
import { CONTENT_SCHEMA_ID } from '../content/generated/schema-version';
import { IndexedDbCharacterRepository } from '../characters/indexeddb-character-repository';
import { createInventoryEntry } from './item-selection';
import { emptyBasicCharacter } from './basic-info';
import { prepareItemAttachedSpells } from './item-attached-spells';
import { attachedSpells, visitAttachedSpells } from '../content/attached-spells';
import { refreshCharacterDescriptions } from './refresh-character-content';

function fixture() {
  const spell: ContentRecord = { kind: 'spell', key: entityKey('spell', { name: 'Light', source: 'XPHB' }), name: 'Light', publication: 'XPHB', file: 'test.json', links: [],
    data: { name: 'Light', source: 'XPHB', level: 0, school: 'V', time: [{ number: 1, unit: 'action' }], components: { v: true },
      range: { type: 'point', distance: { type: 'touch' } }, duration: [{ type: 'timed', duration: { type: 'hour', amount: 1 } }], entries: ['Saved spell description'] } };
  const item: ContentRecord = { kind: 'item', key: entityKey('item', { name: 'Test Wand', source: 'TEST' }), name: 'Test Wand', publication: 'TEST', file: 'test.json',
    links: [], data: { name: 'Test Wand', source: 'TEST', reqAttune: 'by a spellcaster', entries: ['Wand description'],
      attachedSpells: { daily: { '2e': ['Light'] }, charges: { '3': ['Light'] }, will: ['Light'], ritual: ['Light'],
        ability: { choose: ['int', 'cha'] }, resourceName: 'Focus' } } };
  visitAttachedSpells(attachedSpells(item)!, (_uid, path) => item.links.push({ role: 'spell-grant', target: spell.key, path }));
  const revision: ImportRevision = { id: crypto.randomUUID(), namespace: 'equipment-details-tests', source: DEFAULT_CONTENT_SOURCE,
    sourceIdentity: sourceIdentity(DEFAULT_CONTENT_SOURCE), commit: 'a'.repeat(40), adapterVersion: ADAPTER_VERSION, schemaSnapshot: CONTENT_SCHEMA_ID,
    status: 'staging', createdAt: new Date().toISOString(), files: [], diagnostics: [], metrics: { bytes: 0, records: 2, mappedBytes: 0, elapsedMs: 0 } };
  return { item, spell, revision };
}

describe('Attached equipment spell snapshots', () => {
  it('resolves the exact linked publication, deduplicates descriptions and retains usage alternatives offline', async () => {
    const { item, spell, revision } = fixture();
    const cache = new IndexedDbContentCache(); await cache.stage(revision); await cache.put(revision.id, [item, spell]);
    try {
      const entry = await createInventoryEntry(cache, item, revision);
      expect(entry.entity?.attachedSpells).toHaveLength(1);
      expect(entry.entity?.attachedSpells![0]).toMatchObject({ name: 'Light', source: 'XPHB',
        usageNotes: ['2/day each', '3 charges', 'At will', 'Ritual'], spell: { entries: ['Saved spell description'] } });
      expect(entry.entity?.spellcastingAbilityDescription).toBe('Choose Intelligence or Charisma');
      entry.notes = [{ notes: ['Keep my note'] }]; entry.uses = [{ totalFreeUses: 3, usedFreeUses: 2 }]; entry.isAttuned = true;
      const sheet = emptyBasicCharacter(); sheet.inventory = [entry];
      const repository = new IndexedDbCharacterRepository(); await repository.save(sheet, 0);
      const restored = (await repository.get(sheet.character!.characterUuid!))!.sheet;
      expect(restored.spells).toEqual(sheet.spells);
      expect(restored.inventory![0]).toEqual(entry);
      const changedSpell = structuredClone(spell); changedSpell.data['entries'] = ['Updated attached spell description'];
      await cache.put(revision.id, [changedSpell]);
      const refreshed = await refreshCharacterDescriptions(restored, cache, revision);
      expect(refreshed.sheet.inventory![0].entity?.attachedSpells![0].spell?.entries).toEqual(['Updated attached spell description']);
      expect(refreshed.sheet.inventory![0].notes).toEqual(entry.notes);
      expect(refreshed.sheet.inventory![0].uses).toEqual(entry.uses);
      expect(refreshed.sheet.inventory![0].isAttuned).toBe(true);
    } finally { await cache.discard(revision.id); }
  });

  it('keeps unlinked references readable and preserves limited/rest/resource metadata without inventing recharge rules', async () => {
    const { item } = fixture();
    item.links = []; item.data['attachedSpells'] = { rest: { '1': ['Ward|TEST'] }, limited: { '2e': ['Ward|TEST'] },
      resource: { '4': ['Ward|TEST'] }, resourceName: 'Focus', ability: 'wis' };
    const result = await prepareItemAttachedSpells({ get: async () => { throw new Error('No guessed lookup'); } }, item, 'revision');
    expect(result.attachedSpells).toEqual([{ name: 'Ward', source: 'TEST', usageNotes: ['1/rest', '2 uses each; see item description', 'Focus cost: 4'] }]);
    expect(result.spellcastingAbilityDescription).toBe('Wisdom');
    item.data['attachedSpells'] = ['Ward|TEST'];
    expect((await prepareItemAttachedSpells({ get: async () => undefined }, item, 'revision')).attachedSpells![0].usageNotes).toEqual([]);
  });

  it('reports a missing linked spell rather than silently substituting another publication', async () => {
    const { item } = fixture();
    await expect(prepareItemAttachedSpells({ get: async () => undefined }, item, 'revision')).rejects.toThrow('Missing attached spell');
  });
});
