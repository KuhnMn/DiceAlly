import 'fake-indexeddb/auto';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ContentRecord, ImportRevision, DEFAULT_CONTENT_SOURCE, ADAPTER_VERSION, sourceIdentity } from '../content/content.model';
import { CharacterLibraryService } from '../characters/character-library.service';
import { RestService } from '../services/rest.service';
import { emptyBasicCharacter } from './basic-info';
import { createInventoryEntry } from './item-selection';
import { ItemsEditorComponent } from './items-editor.component';
import { ItemCatalogComponent } from './item-catalog.component';
import { EquipmentPageComponent } from '../sheet/equipment-page.component';
import { CharacterStore } from '../stores/character.store';
import { By } from '@angular/platform-browser';

const revision: ImportRevision = { id: 'items-test', namespace: 'development-local', source: DEFAULT_CONTENT_SOURCE,
  sourceIdentity: sourceIdentity(DEFAULT_CONTENT_SOURCE), commit: 'a'.repeat(40), adapterVersion: ADAPTER_VERSION,
  status: 'ready', createdAt: new Date().toISOString(), files: [], diagnostics: [], metrics: { bytes: 0, records: 1, mappedBytes: 0, elapsedMs: 0 } };
const record: ContentRecord = { key: 'item-test', kind: 'item', name: 'Magic Sword', publication: 'TEST', file: 'test.json',
  data: { name: 'Magic Sword', source: 'TEST', entries: ['Sword description'], bonusWeapon: '+1' },
  links: [{ role: 'item-property', target: 'property-test' }] };

describe('Items creator', () => {
  beforeEach(() => TestBed.configureTestingModule({ providers: [provideRouter([])] }));
  it('embeds resolved properties in viewer format without retaining mutable catalog objects', async () => {
    const property: ContentRecord = { key: 'property-test', kind: 'itemProperty', name: 'Special', publication: 'TEST', file: 'test.json',
      data: { entries: ['First paragraph', 'Second paragraph'] }, links: [] };
    const item = await createInventoryEntry({ get: async () => property }, record, revision);
    expect(item.entity!.properties![0].entry).toEqual({ type: 'entries', entries: ['First paragraph', 'Second paragraph'] });
    expect(item.contentReference!.key).toBe(record.key);
    expect(item.count).toBe(1);
    item.entity!.item.name = 'Changed';
    expect(record.data['name']).toBe('Magic Sword');
  });
  it('adds custom items, persists annotations, and requires confirmation before removing them', async () => {
    const fixture = TestBed.createComponent(ItemsEditorComponent);
    const sheet = emptyBasicCharacter();
    fixture.componentRef.setInput('sheet', sheet); await fixture.whenStable();
    const editor = fixture.componentInstance;
    const catalogFixture = TestBed.createComponent(ItemCatalogComponent);
    catalogFixture.componentRef.setInput('sheet', sheet); await catalogFixture.whenStable();
    const catalog = catalogFixture.componentInstance;
    catalog.itemTypes = [{ key: 'gear-type', kind: 'itemType', name: 'Adventuring Gear', publication: 'TEST',
      file: 'test.json', data: { abbreviation: 'G', source: 'TEST' }, links: [] }];
    catalog.customType = 'gear-type'; catalog.customValue = 250;
    catalog.customName = 'Travel Supplies'; catalog.customDescription = 'A useful kit.\n\nIncludes rope.'; catalog.addCustom();
    const item = sheet.inventory![0];
    expect(item.entity).toMatchObject({ itemType: 'Adventuring Gear', item: { type: 'G|TEST', value: 250 } });
    expect(catalog.customType).toBe(''); expect(catalog.customValue).toBeNull();
    expect(editor.description(item)).toBe('A useful kit.\n\nIncludes rope.');
    expect(item.entity!.item.entries).toEqual([{ text: 'A useful kit.' }, { text: 'Includes rope.' }]);
    editor.setDescription(item, 'Updated description');
    expect(editor.description(item)).toBe('Updated description');
    expect(item.allowMultiples).toBe(false);
    editor.setStackable(item, true);
    editor.setCount(item, 3);
    editor.setStackable(item, false);
    editor.setStackable(item, true);
    expect(item.count).toBe(3);
    editor.setCount(item, 0);
    expect(item.count).toBe(0);
    editor.setCount(item, 3);
    item.isEquipped = true;
    item.notes = [{ tag: 'Contents', notes: ['Rope', 'Chalk'], isEditable: true }];
    item.uses = [{ tag: 'Charges', totalFreeUses: 4, usedFreeUses: 2, freeUsesRegainCondition: 'SHORT_REST_ONE' }];
    const library = TestBed.inject(CharacterLibraryService);
    await library.save(sheet, 0);
    expect((await library.get(sheet.character!.characterUuid!))!.sheet.inventory).toEqual(sheet.inventory);
    TestBed.inject(RestService).performShortRest(sheet);
    expect(item.uses[0].usedFreeUses).toBe(1);
    editor.remove(item);
    expect(editor.pendingRemoval).toBe(item);
    expect(sheet.inventory).toHaveLength(1);
    editor.confirmRemoval(); expect(sheet.inventory).toHaveLength(0);
  });
  it('rejects invalid custom values and types, and preserves zero or unspecified values', async () => {
    const fixture = TestBed.createComponent(ItemCatalogComponent);
    const sheet = emptyBasicCharacter();
    fixture.componentRef.setInput('sheet', sheet); await fixture.whenStable();
    const catalog = fixture.componentInstance;
    catalog.customName = 'Keepsake';
    for (const value of [-1, 1.5, NaN, Infinity]) {
      catalog.customValue = value; catalog.addCustom();
      expect(sheet.inventory ?? []).toHaveLength(0);
    }
    catalog.customValue = 0; catalog.customType = 'missing'; catalog.addCustom();
    expect(sheet.inventory ?? []).toHaveLength(0);
    catalog.customType = ''; catalog.addCustom();
    expect(sheet.inventory![0].entity!.item.value).toBe(0);
    catalog.customName = 'Unknown value'; catalog.addCustom();
    expect(sheet.inventory![1].entity!.item.value).toBeUndefined();
    expect(sheet.inventory![1].entity!.itemType).toBeUndefined();
  });
  it('uses the shared filtered catalog in the viewer without offering annotation configuration', async () => {
    const sheet = emptyBasicCharacter();
    const store = TestBed.inject(CharacterStore); store.setCharacter(sheet);
    const fixture = TestBed.createComponent(EquipmentPageComponent);
    fixture.componentRef.setInput('characterData', sheet); await fixture.whenStable();
    fixture.componentInstance.isAddingItem.set(true); await fixture.whenStable();
    const catalog = fixture.debugElement.query(By.directive(ItemCatalogComponent)).componentInstance as ItemCatalogComponent;
    expect(fixture.nativeElement.querySelector('app-source-book-filter')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('app-entry-annotations-editor')).toBeNull();
    catalog.stackable = true; catalog.quantity = 5;
    catalog.customName = 'Arrows'; catalog.customDescription = 'A bundle of arrows'; catalog.addCustom();
    expect(store.characterData()!.inventory![0]).toMatchObject({ name: 'Arrows', allowMultiples: true, count: 5, uses: [], notes: [] });
    expect(store.characterData()).not.toBe(sheet);
    // Parent input follows the updated store in the sheet.
    fixture.componentRef.setInput('characterData', store.characterData()); await fixture.whenStable();
    catalog.catalog.revision.set(revision);
    await catalog.add({ ...record, links: [] });
    expect(store.characterData()!.inventory![1].entity!.item.bonusWeapon).toBe('+1');
    expect(store.characterData()!.inventory![1].isDummy).not.toBe(true);
  });
});
