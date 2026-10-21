import 'fake-indexeddb/auto';
import { TestBed } from '@angular/core/testing';
import { createInventoryEntry } from './item-selection';
import { prepareItemCharges } from '../content/item-charges';
import { ADAPTER_VERSION, ContentRecord, DEFAULT_CONTENT_SOURCE, ImportRevision, entityKey, sourceIdentity } from '../content/content.model';
import { RestService } from '../services/rest.service';
import { emptyBasicCharacter } from './basic-info';
import { IndexedDbCharacterRepository } from '../characters/indexeddb-character-repository';
import { refreshCharacterDescriptions } from './refresh-character-content';
import { encodeCloudCharacter, decodeCloudCharacter } from '../characters/sync/character-cloud';

const revision: ImportRevision = { id: 'charge-revision', namespace: 'development-local', source: DEFAULT_CONTENT_SOURCE,
  sourceIdentity: sourceIdentity(DEFAULT_CONTENT_SOURCE), commit: 'a'.repeat(40), adapterVersion: ADAPTER_VERSION, status: 'ready',
  createdAt: new Date().toISOString(), files: [], diagnostics: [], metrics: { bytes: 0, mappedBytes: 0, records: 1, elapsedMs: 0 } };
function chargeItem(charges: number | string = 7): ContentRecord {
  const data = { name: 'Wand of Magic Missiles', source: 'XDMG', charges, recharge: 'dawn', rechargeAmount: '{@dice 1d6 + 1}', entries: ['Wand description'] };
  return { kind: 'item', key: entityKey('item', data), name: data.name, publication: data.source, data, links: [], file: 'items.json' };
}

describe('Preconfigured item charges', () => {
  it('adds independent full trackers and keeps dawn recovery manual across both rest types', async () => {
    const record = chargeItem();
    const cache = { get: async () => undefined };
    const first = await createInventoryEntry(cache, record, revision);
    const second = await createInventoryEntry(cache, record, revision);
    expect(first.uses).toEqual([{ tag: 'Charges', totalFreeUses: 7, usedFreeUses: 0, freeUsesRegainCondition: 'MANUAL', userAdded: false }]);
    first.uses![0].usedFreeUses = 4;
    const sheet = emptyBasicCharacter(); sheet.inventory = [first, second];
    const rest = TestBed.inject(RestService);
    rest.performShortRest(sheet); rest.performLongRest(sheet);
    expect(first.uses![0].usedFreeUses).toBe(4);
    expect(second.uses![0].usedFreeUses).toBe(0);
    expect(first.editorId).not.toBe(second.editorId);
    expect(first.entity?.item).toMatchObject({ charges: 7, recharge: 'dawn', rechargeAmount: '{@dice 1d6 + 1}' });
  });

  it('does not invent a numeric maximum or guess full recovery for partial/rolled recharge', async () => {
    const symbolic = await createInventoryEntry({ get: async () => undefined }, chargeItem('1d6 + 1'), revision);
    expect(symbolic.uses).toEqual([]);
    expect(prepareItemCharges(symbolic.entity!.item)?.maximumCharges).toBe('1d6 + 1');
    expect(prepareItemCharges({ charges: 7, recharge: 'restShort', rechargeAmount: 1 })?.trackerRecoveryCondition).toBe('MANUAL');
    expect(prepareItemCharges({ charges: 7, recharge: 'restLong', rechargeAmount: '{@dice 1d6 + 1}' })?.trackerRecoveryCondition).toBe('MANUAL');
    expect(prepareItemCharges({ charges: 7, recharge: 'restLong' })?.trackerRecoveryCondition).toBe('MANUAL');
    expect(prepareItemCharges({ charges: 7, recharge: 'restLong', rechargeAmount: 7 })?.trackerRecoveryCondition).toBe('LONG_REST');
    expect(prepareItemCharges({ charges: 7, recharge: 'restShort', rechargeAmount: 7 })?.trackerRecoveryCondition).toBe('SHORT_REST');
  });

  it('persists charges and refreshes only definitions, preserving spent charges and manual edits', async () => {
    const record = chargeItem(), cache = { get: async (_revision: string, key: string) => key === record.key ? record : undefined };
    const sheet = emptyBasicCharacter(); const item = await createInventoryEntry(cache, record, revision); sheet.inventory = [item];
    item.uses![0].usedFreeUses = 3; item.uses![0].totalFreeUses = 9; item.uses![0].freeUsesRegainCondition = 'SHORT_REST_ONE';
    const refreshed = await refreshCharacterDescriptions(sheet, cache, revision);
    expect(refreshed.sheet.inventory![0].uses).toEqual(item.uses);
    const repository = new IndexedDbCharacterRepository(`charge-state-${crypto.randomUUID()}`);
    await repository.save(refreshed.sheet, 0);
    const saved = (await repository.get(sheet.character!.characterUuid!))!;
    const cloud = await encodeCloudCharacter(saved, 1);
    expect((await decodeCloudCharacter(saved.id, cloud)).sheet.inventory![0].uses).toEqual(item.uses);
    item.uses = [];
    expect((await refreshCharacterDescriptions(sheet, cache, revision)).sheet.inventory![0].uses).toEqual([]);
  });
});
