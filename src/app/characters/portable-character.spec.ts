import 'fake-indexeddb/auto';
import { emptyBasicCharacter } from '../editor/basic-info';
import { normalizeCharacterEditorIdentity } from '../editor/editor-identity';
import { IndexedDbCharacterRepository } from './indexeddb-character-repository';
import { encodeCloudCharacter } from './sync/character-cloud';
import { portableCharacter } from './portable-character';
import type { ExportedCharacter } from '../models/character.model';
import { wizardFingerprint } from '../editor/wizard-fingerprint';

describe('Portable character metadata', () => {
  it('migrates old use limits for every owner without mutating input or losing consumption', async () => {
    const uses = [
      { tag: 'Fixed', totalFreeUses: 7, usedFreeUses: 3, freeUsesRegainCondition: 'SHORT_REST' },
      { tag: 'Default' },
      { totalFreeUses: 99, totalCalculation: { kind: 'proficiency-bonus' }, usedFreeUses: 2 },
      { totalFreeUses: 99, totalCalculation: { kind: 'proficiency-bonus', multiplier: 0.5 }, usedFreeUses: 1 },
      { totalFreeUses: 99, totalCalculation: { kind: 'ability-modifier', ability: 'wisdom' }, usedFreeUses: 4 },
      { totalFreeUses: 6, totalCalculation: { kind: 'fixed' }, usedFreeUses: 2 },
    ];
    const legacy = { ...emptyBasicCharacter(),
      ...Object.fromEntries(['features', 'spells', 'inventory', 'monsters'].map(kind => [kind, [{ name: 'Entry', uses }]])),
      species: { name: 'Species', uses }, objects: [{ kind: 'object', name: 'Object', hitPoints: { enabled: false }, uses }],
      resources: [{ id: 'pool', sourceId: 'source', name: 'Pool', mode: 'counter', note: '',
        total: 9, totalCalculation: { kind: 'proficiency-bonus' }, used: 3, recovery: 'NONE', features: true, spells: false }],
    };
    const before = structuredClone(legacy);
    const sheet = portableCharacter(legacy as unknown as ExportedCharacter);
    const expected = [
      { tag: 'Fixed', total: { kind: 'fixed', value: 7 }, used: 3, freeUsesRegainCondition: 'SHORT_REST' },
      { tag: 'Default', total: { kind: 'fixed', value: 1 }, used: 0 },
      { total: { kind: 'proficiency-bonus', multiplier: 1 }, used: 2 },
      { total: { kind: 'proficiency-bonus', multiplier: 0.5 }, used: 1 },
      { total: { kind: 'ability-modifier', ability: 'wisdom' }, used: 4 },
      { total: { kind: 'fixed', value: 6 }, used: 2 },
    ];
    for (const kind of ['features', 'spells', 'inventory', 'monsters', 'objects'] as const) expect(sheet[kind]![0].uses).toEqual(expected);
    expect(sheet.species!.uses).toEqual(expected);
    expect(sheet.resources![0].total).toEqual({ kind: 'proficiency-bonus', multiplier: 1 });
    expect(sheet.resources![0].used).toBe(3);
    expect(legacy).toEqual(before);
    expect(portableCharacter(sheet)).toEqual(sheet);
    const repository = new IndexedDbCharacterRepository(`uses-migration-${crypto.randomUUID()}`);
    await repository.save(sheet, 0);
    const saved = (await repository.get(sheet.character!.characterUuid!))!;
    expect(saved.sheet).toEqual(sheet);
    const cloud = await encodeCloudCharacter(saved, 1);
    expect(JSON.parse(cloud.body!)).toEqual(JSON.parse(JSON.stringify(sheet)));
    expect(cloud.body).not.toMatch(/totalFreeUses|usedFreeUses|totalCalculation/);
  });
  it('upgrades unchanged resource fingerprints and retains protection for manually changed totals', () => {
    const resource = { id: 'pool', sourceId: 'source', name: 'Pool', mode: 'counter', note: '',
      total: 4, used: 2, recovery: 'NONE', features: true, spells: false };
    const baseline = { path: ['resources', 'pool'], scope: 'resourceReminders', label: 'Pool',
      fingerprint: wizardFingerprint(resource), fieldFingerprints: { total: wizardFingerprint(4) } };
    const legacy = { ...emptyBasicCharacter(), resources: [resource], creatorWizard: { baseline: [baseline] } };
    const migrated = portableCharacter(legacy as unknown as ExportedCharacter);
    expect(migrated.creatorWizard!.baseline[0].fingerprint).toBe(wizardFingerprint(migrated.resources![0]));
    expect(migrated.creatorWizard!.baseline[0].fieldFingerprints!['total']).toBe(wizardFingerprint({ kind: 'fixed', value: 4 }));
    resource.total = 9;
    const edited = portableCharacter(legacy as unknown as ExportedCharacter);
    expect(edited.creatorWizard!.baseline[0]).toEqual(baseline);
  });
  it('rejects malformed canonical totals and unsupported legacy calculations', () => {
    for (const total of [null, 3, { kind: 'fixed' }, { kind: 'fixed', value: -1 },
      { kind: 'proficiency-bonus' }, { kind: 'proficiency-bonus', multiplier: 1.25 }, { kind: 'ability-modifier', ability: 'luck' }]) {
      const input = { features: [{ uses: [{ total, used: 0 }] }] };
      expect(() => portableCharacter(input as unknown as ExportedCharacter)).toThrow('Invalid uses total');
    }
    const legacy = { features: [{ uses: [{ totalCalculation: { kind: 'proficiency-bonus', multiplier: null } }] }] };
    expect(() => portableCharacter(legacy as unknown as ExportedCharacter)).toThrow('Invalid uses total');
  });
  it('preserves hidden entries through local persistence and cloud serialization', async () => {
    const sheet = emptyBasicCharacter();
    sheet.features = [{ editorId: 'feat', name: 'Hidden Feat', featureType: 'FEAT', hidden: true }];
    sheet.spells = [{ name: 'Hidden Spell', listType: 'PREPARED', hidden: true }];
    sheet.inventory = [{ name: 'Hidden Item', isEquipped: true, hidden: true, count: 2 }];
    sheet.monsters = [{ name: 'Hidden Companion', hidden: true, hpEnabled: true, monsterCurrentHP: 3 }];
    const repository = new IndexedDbCharacterRepository(`visibility-${crypto.randomUUID()}`);
    await repository.save(sheet, 0);
    const record = (await repository.get(sheet.character!.characterUuid!))!;
    const cloud = await encodeCloudCharacter(record, 1), saved = JSON.parse(cloud.body!);
    for (const kind of ['features', 'spells', 'inventory', 'monsters'] as const) expect(saved[kind]).toEqual(sheet[kind]);
  });
  it('ignores legacy installation identity on import, local persistence, and cloud upload', async () => {
    const sheet = Object.assign(emptyBasicCharacter(), { installationId: 'old-android-device' });
    const imported = normalizeCharacterEditorIdentity(sheet);
    expect('installationId' in imported).toBe(false);
    expect(sheet.installationId).toBe('old-android-device');
    const repository = new IndexedDbCharacterRepository(`portable-${crypto.randomUUID()}`);
    await repository.save(sheet, 0);
    const record = (await repository.get(sheet.character!.characterUuid!))!;
    expect('installationId' in record.sheet).toBe(false);
    const cloud = await encodeCloudCharacter({ ...record, sheet }, 1);
    expect(JSON.parse(cloud.body!).installationId).toBeUndefined();
    expect(JSON.parse(cloud.body!).character.characterUuid).toBe(sheet.character!.characterUuid);
  });
});
