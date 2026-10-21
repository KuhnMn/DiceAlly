import 'fake-indexeddb/auto';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { vi } from 'vitest';
import { IndexedDbContentCache } from '../content/content-cache';
import { ADAPTER_VERSION, ContentRecord, DEFAULT_CONTENT_SOURCE, ImportRevision, JsonObject, entityKey, sourceIdentity } from '../content/content.model';
import { CONTENT_SCHEMA_ID } from '../content/generated/schema-version';
import { ExportedCharacter } from '../models/character.model';
import { IndexedDbCharacterRepository } from '../characters/indexeddb-character-repository';
import { emptyBasicCharacter } from './basic-info';
import { contentReference } from './editor-content-helpers';
import { LocalEditorComponent } from './local-editor.component';
import { refreshCharacterDescriptions } from './refresh-character-content';

function record(kind: string, name: string, data: JsonObject = {}): ContentRecord {
  const fields = { name, source: 'TEST', ...data };
  return { kind, name, publication: 'TEST', key: entityKey(kind, fields), file: 'refresh-test.json', data: fields, links: [] };
}

function fixtureData() {
  const revision: ImportRevision = { id: crypto.randomUUID(), namespace: 'development-local',
    source: DEFAULT_CONTENT_SOURCE, sourceIdentity: sourceIdentity(DEFAULT_CONTENT_SOURCE), commit: 'b'.repeat(40),
    status: 'staging', adapterVersion: ADAPTER_VERSION, schemaSnapshot: CONTENT_SCHEMA_ID,
    createdAt: new Date().toISOString(), files: [], diagnostics: [], metrics: { bytes: 0, records: 0, mappedBytes: 0, elapsedMs: 0 } };
  const spell = record('spell', 'Ward', { level: 1, school: 'A', time: [{ number: 1, unit: 'action' }],
    components: { m: { text: 'A gem', cost: 100, consume: true } }, duration: [{ type: 'instant' }], entries: ['Updated spell'],
    entriesHigherLevel: ['Updated scaling'] });
  const property = record('itemProperty', 'Finesse', { entries: ['Updated property'] });
  const item = record('item', 'Sword', { entries: ['Updated item'], bonusWeapon: '+2', dmg1: '1d8' });
  item.links = [{ role: 'item-property', target: property.key }];
  const feature = record('classFeature', 'Training', { className: 'Fighter', classSource: 'TEST', level: 1, entries: ['Updated class feature'] });
  const feat = record('feat', 'Alert', { entries: ['Updated feat'] });
  const optional = record('optionalfeature', 'Maneuver', { featureType: ['MV'], entries: ['Updated option'] });
  const species = record('species', 'Elf', { entries: ['Updated species'], speed: 30, size: ['M'] });
  const background = record('background', 'Sage', { entries: ['Updated background'] });
  const monster = record('monster', 'Wolf', { entries: ['Updated wolf'], hp: { average: 12, formula: '2d8+3' }, action: [{ name: 'Bite', entries: ['Updated bite'] }] });
  const reference = (value: ContentRecord) => ({ ...contentReference(value, revision), revisionId: 'old', commit: 'a'.repeat(40) });
  const notes = [{ tag: 'Player note', notes: ['Keep this'], isEditable: true }];
  const uses = [{ tag: 'Charges', totalFreeUses: 3, usedFreeUses: 2 }];
  const sheet: ExportedCharacter = { ...emptyBasicCharacter(),
    spells: ['KNOWN', 'PREPARED'].map(listType => ({ name: spell.name, source: 'TEST', editorId: listType, listType,
      castingSourceName: 'Wizard', contentReference: reference(spell), notes, uses })),
    features: [
      { name: feature.name, contentReference: reference(feature), featureSourceName: 'Fighter', notes, uses },
      { name: feat.name, contentReference: reference(feat), featureType: 'FEAT', notes, uses },
      { name: optional.name, contentReference: reference(optional), featureType: 'OPTIONAL_FEATURE', notes, uses },
    ],
    inventory: [{ name: item.name, editorId: 'sword', source: 'TEST', contentReference: reference(item), count: 4,
      isEquipped: true, isAttuned: true, allowMultiples: true, notes, uses }],
    species: { name: species.name, contentReference: reference(species), notes, uses },
    background: { name: background.name, contentReference: reference(background), entity: { entries: ['Old background'] } },
    monsters: [{ name: monster.name, contentReference: reference(monster), hpEnabled: true, monsterCurrentHP: 4,
      monsterMaxHP: 20, monsterMaxHpOverride: 22, monsterTempHP: 3, notes, uses }],
    combatActions: [{ name: 'My custom attack', hitOrDc: '+8', damageOrHeal: 'Custom damage' }],
  };
  const records = [spell, property, item, feature, feat, optional, species, background, monster];
  return { revision, sheet, records, spell, item };
}

describe('Refresh saved character descriptions', () => {
  it('loads all stored definition families from IndexedDB while preserving character and session state', async () => {
    const { revision, sheet, records } = fixtureData();
    const cache = new IndexedDbContentCache();
    await cache.stage(revision); await cache.put(revision.id, records);
    const before = JSON.stringify(sheet);
    try {
      const result = await refreshCharacterDescriptions(sheet, cache, revision);
      expect(result.refreshed).toBe(9); expect(result.skipped).toEqual([]);
      expect(result.sheet.spells![0].entity).toMatchObject({ entries: ['Updated spell'], entriesHigherLevel: ['Updated scaling'], components: { m: { cost: 100, consume: true } } });
      expect(result.sheet.features![0].featureEntity?.entries).toEqual(['Updated class feature']);
      expect(result.sheet.features![1].featEntity?.entries).toEqual(['Updated feat']);
      expect(result.sheet.features![2].optionalFeatureEntity?.entries).toEqual(['Updated option']);
      expect(result.sheet.inventory![0].entity).toMatchObject({ item: { entries: ['Updated item'], bonusWeapon: '+2' }, properties: [{ name: 'Finesse', entry: { entries: ['Updated property'] } }] });
      expect(result.sheet.species?.entity?.entries).toEqual(['Updated species']);
      expect(result.sheet.background?.entity?.entries).toEqual(['Updated background']);
      expect(result.sheet.monsters![0].entity?.action?.[0].entries).toEqual(['Updated bite']);
      expect(result.sheet.character).toEqual(sheet.character);
      expect(result.sheet.combatActions).toEqual(sheet.combatActions);
      for (const [fresh, old] of [
        [result.sheet.spells, sheet.spells], [result.sheet.features, sheet.features],
        [result.sheet.inventory, sheet.inventory], [result.sheet.monsters, sheet.monsters],
      ] as const) {
        fresh!.forEach((entry, index) => {
          const { entity, featureEntity, featEntity, optionalFeatureEntity, contentReference: ref, ...state } = entry as Record<string, unknown>;
          const { entity: oldEntity, featureEntity: oldFeature, featEntity: oldFeat, optionalFeatureEntity: oldOptional, contentReference: oldRef, ...oldState } = old![index] as Record<string, unknown>;
          expect(state).toEqual(oldState);
          expect(ref).toMatchObject({ revisionId: revision.id });
        });
      }
      expect(JSON.stringify(sheet)).toBe(before);
      const repository = new IndexedDbCharacterRepository();
      await repository.save(result.sheet, 0);
      const restored = await repository.get(sheet.character!.characterUuid!);
      expect(restored?.sheet.spells![0].entity?.entries).toEqual(['Updated spell']);
      expect(restored?.sheet.inventory![0].uses).toEqual(sheet.inventory![0].uses);
    } finally { await cache.discard(revision.id); }
  });

  it('preserves custom, missing and foreign-library entries and requires exact legacy identities', async () => {
    const { sheet, revision, spell } = fixtureData();
    const cache = { get: vi.fn(async (_revision: string, key: string) => key === spell.key ? spell : undefined) };
    sheet.spells = [
      { name: 'Ward', source: 'TEST' },
      { name: 'Ward', source: 'OTHER' },
      { name: 'Ward' },
      { name: 'Ward', source: 'Custom', notes: [{ notes: ['Custom text'] }] },
      { name: 'Ward', source: 'TEST', contentReference: { ...contentReference(spell, revision), sourceIdentity: 'another-library' } },
      { name: 'Renamed spell', contentReference: { ...contentReference(spell, revision), key: 'missing-key' } },
    ];
    sheet.features = [{ name: 'Training', source: 'TEST' }];
    sheet.inventory = [{ name: 'Sword', isDummy: true }]; sheet.monsters = []; delete sheet.species; delete sheet.background;
    const result = await refreshCharacterDescriptions(sheet, cache, revision);
    expect(result.refreshed).toBe(1);
    expect(result.skipped).toHaveLength(7);
    expect(result.sheet.spells!.slice(1)).toEqual(sheet.spells.slice(1));
    expect(result.sheet.features).toEqual(sheet.features);
    expect(result.sheet.inventory).toEqual(sheet.inventory);
  });

  it('does not mutate the draft when a lookup or dependent item definition fails', async () => {
    const { sheet, revision, spell, item } = fixtureData();
    const before = JSON.stringify(sheet);
    const cache = { get: vi.fn(async (_revision: string, key: string) => key === spell.key ? spell : key === item.key ? item : undefined) };
    await expect(refreshCharacterDescriptions(sheet, cache, revision)).rejects.toThrow('Missing item-property');
    expect(JSON.stringify(sheet)).toBe(before);
  });

  it('provides the creator button, keeps refresh unsaved until Save, and clears busy state on failure', async () => {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    const { revision, spell } = fixtureData();
    const cache = new IndexedDbContentCache();
    await cache.stage(revision); await cache.put(revision.id, [spell]);
    const savedSource = vi.spyOn(IndexedDbContentCache.prototype, 'savedSource').mockResolvedValue(revision.source);
    const active = vi.spyOn(IndexedDbContentCache.prototype, 'active').mockResolvedValue({ ...revision, status: 'ready' });
    const fixture = TestBed.createComponent(LocalEditorComponent);
    try {
      await fixture.whenStable();
      const editor = fixture.componentInstance;
      editor.sheet.spells = [{ name: spell.name, source: 'TEST', notes: [{ notes: ['Keep note'] }] }];
      await editor.save();
      expect(editor.unsaved).toBe(false);
      expect(Array.from(fixture.nativeElement.querySelectorAll('button')).some(button => (button as HTMLButtonElement).textContent?.includes('Refresh Descriptions'))).toBe(true);
      await editor.refreshDescriptions();
      expect(editor.error()).toBe(''); expect(editor.busy()).toBe(false);
      expect(editor.unsaved).toBe(true);
      const repository = new IndexedDbCharacterRepository();
      expect((await repository.get(editor.character.characterUuid!))?.sheet.spells![0].entity).toBeUndefined();
      await editor.save();
      expect((await repository.get(editor.character.characterUuid!))?.sheet.spells![0].entity?.entries).toEqual(['Updated spell']);
      active.mockResolvedValue(undefined);
      const before = JSON.stringify(editor.sheet);
      await editor.refreshDescriptions();
      expect(editor.error()).toContain('Import a content library');
      expect(editor.busy()).toBe(false); expect(editor.refreshingDescriptions()).toBe(false);
      expect(JSON.stringify(editor.sheet)).toBe(before);
    } finally { fixture.destroy(); savedSource.mockRestore(); active.mockRestore(); await cache.discard(revision.id); }
  });

  it('rejects a completed refresh if the draft was edited while IndexedDB was being read', async () => {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    const { revision, spell } = fixtureData();
    let finishRead!: (record: ContentRecord) => void;
    let started!: () => void;
    const reading = new Promise<void>(resolve => { started = resolve; });
    const pending = new Promise<ContentRecord>(resolve => { finishRead = resolve; });
    const savedSource = vi.spyOn(IndexedDbContentCache.prototype, 'savedSource').mockResolvedValue(revision.source);
    const active = vi.spyOn(IndexedDbContentCache.prototype, 'active').mockResolvedValue({ ...revision, status: 'ready' });
    const get = vi.spyOn(IndexedDbContentCache.prototype, 'get').mockImplementation(async () => { started(); return pending; });
    const fixture = TestBed.createComponent(LocalEditorComponent);
    try {
      await fixture.whenStable();
      const editor = fixture.componentInstance;
      editor.sheet.spells = [{ name: spell.name, source: 'TEST' }];
      const refreshing = editor.refreshDescriptions();
      await reading;
      editor.character.name = 'Edited during refresh';
      finishRead(spell); await refreshing;
      expect(editor.error()).toContain('character changed during refresh');
      expect(editor.character.name).toBe('Edited during refresh');
      expect(editor.sheet.spells[0].entity).toBeUndefined();
      expect(editor.busy()).toBe(false);
    } finally { fixture.destroy(); savedSource.mockRestore(); active.mockRestore(); get.mockRestore(); }
  });
});
