import 'fake-indexeddb/auto';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { canonicalItemRecord } from '../content/item-adapter';
import { ContentRecord, ImportRevision, DEFAULT_CONTENT_SOURCE, ADAPTER_VERSION, sourceIdentity } from '../content/content.model';
import { itemRuleEntries, resolveItemView } from '../content/item-resolver';
import { emptyBasicCharacter } from '../editor/basic-info';
import { createInventoryEntry } from '../editor/item-selection';
import { ItemCatalogComponent } from '../editor/item-catalog.component';
import { ItemsEditorComponent } from '../editor/items-editor.component';
import { SourceBookFilterService } from '../editor/source-book-filter.service';
import { CompendiumDetailsComponent } from '../compendium/compendium-details.component';
import { EquipmentDetailsComponent } from './equipment-details.component';
import { vehicleItemStatistics } from './vehicle-item-presentation';
import { refreshCharacterDescriptions } from '../editor/refresh-character-content';

const galley = { crew: 80, vehAc: 15, vehHp: 500, vehDmgThresh: 20, vehSpeed: 4, capCargo: 150, value: 3_000_000 };
const record: ContentRecord = canonicalItemRecord({ kind: 'item', key: 'galley-xphb', name: 'Galley', publication: 'XPHB', file: 'items.json',
  data: { name: 'Galley', source: 'XPHB', type: 'SHP|XPHB', rarity: 'none', ...galley }, links: [] });
const revision: ImportRevision = { id: 'vehicle-items', namespace: 'development-local', source: DEFAULT_CONTENT_SOURCE,
  sourceIdentity: sourceIdentity(DEFAULT_CONTENT_SOURCE), commit: 'a'.repeat(40), adapterVersion: ADAPTER_VERSION, status: 'ready',
  createdAt: new Date().toISOString(), files: [], diagnostics: [], metrics: { bytes: 0, records: 1, mappedBytes: 0, elapsedMs: 0 } };
const cache = { get: async () => undefined };
const shipType: ContentRecord = { kind: 'itemType', key: 'ship-type-xphb', name: 'Vehicle (Water)', publication: 'XPHB', file: 'items-base.json', links: [],
  data: { abbreviation: 'SHP', source: 'XPHB', page: 230, entries: [
    { type: 'entries', name: 'Speed', entries: ['Synthetic sailing rules.'] },
    { type: 'entries', name: 'Crew', entries: ['Synthetic crew rules.'] },
    { type: 'entries', name: 'Passengers', entries: ['Synthetic passenger rules.'] },
    { type: 'entries', name: 'Damage Threshold', entries: ['Synthetic threshold rules.'] },
    { type: 'entries', name: 'Ship Repair', entries: ['Synthetic repair rules.'] },
  ] } };
const linkedGalley = { ...record, links: [{ role: 'item-type', target: shipType.key }] };
const shipRecords = new Map([linkedGalley, shipType].map(entry => [entry.key, entry]));
const shipCache = { get: async (_revision: string, key: string) => shipRecords.get(key) };

describe('Vehicle equipment details', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    TestBed.inject(SourceBookFilterService).setSelection([]);
  });

  it('uses structured vehicle fields with the correct units, retaining zero values and crew ranges', () => {
    expect(vehicleItemStatistics(galley, true)).toEqual([
      { label: 'Armor Class', value: '15' }, { label: 'Hit Points', value: '500' },
      { label: 'Damage Threshold', value: '20' }, { label: 'Speed', value: '4 mph' },
      { label: 'Cargo Capacity', value: '150 tons' }, { label: 'Crew', value: '80' },
      { label: 'Cost', value: '30,000 gp' },
    ]);
    expect(vehicleItemStatistics({ crewMin: 2, crewMax: 4, capPassenger: 0, capCargo: 1, vehDmgThresh: 0 })).toEqual([
      { label: 'Damage Threshold', value: '0' }, { label: 'Passengers', value: '0' },
      { label: 'Cargo Capacity', value: '1 ton' }, { label: 'Crew', value: '2–4' },
    ]);
    expect(vehicleItemStatistics({ value: 100 })).toEqual([]);
  });

  it('retains the vehicle statistics in detached inventory entries without requiring description text or library access', async () => {
    const before = JSON.stringify(record);
    const item = await createInventoryEntry(cache, record, revision);
    expect(item.entity!.item).toMatchObject(galley);
    const fixture = TestBed.createComponent(EquipmentDetailsComponent);
    fixture.componentRef.setInput('entity', JSON.parse(JSON.stringify(item.entity))); fixture.detectChanges();
    const panel = fixture.nativeElement.querySelector('[aria-label="Vehicle statistics"]');
    for (const text of ['Armor Class', '15', 'Hit Points', '500', 'Damage Threshold', '20', '4 mph', '150 tons', 'Crew', '80']) expect(panel.textContent).toContain(text);
    expect(JSON.stringify(record)).toBe(before);
    fixture.destroy();
  });

  it('shows vehicle content when opening the empty-description Galley item from Add Items', async () => {
    const fixture = TestBed.createComponent(ItemCatalogComponent);
    fixture.componentRef.setInput('sheet', emptyBasicCharacter()); fixture.detectChanges();
    await fixture.componentInstance.refreshContent();
    fixture.componentInstance.itemTypes = [shipType];
    fixture.componentInstance.catalog.results.set([linkedGalley]); fixture.componentInstance.catalog.loading.set(false);
    fixture.detectChanges();
    fixture.nativeElement.querySelector('app-description-dialog button').click(); fixture.detectChanges();
    const panel = fixture.nativeElement.querySelector('app-description-dialog [aria-label="Vehicle statistics"]');
    expect(panel).not.toBeNull();
    expect(panel.textContent).toContain('4 mph'); expect(panel.textContent).toContain('30,000 gp');
    const dialogText = fixture.nativeElement.querySelector('app-description-dialog').textContent;
    expect(dialogText).toContain('Ship Repair'); expect(dialogText).toContain('Synthetic sailing rules.');
    fixture.destroy();
  });

  it('keeps the description control available for saved vehicle items without prose', async () => {
    const item = await createInventoryEntry(cache, record, revision);
    const fixture = TestBed.createComponent(ItemsEditorComponent);
    fixture.componentRef.setInput('sheet', { ...emptyBasicCharacter(), inventory: [item] }); fixture.detectChanges();
    fixture.nativeElement.querySelector('button[aria-label="Edit Galley"]').click(); fixture.detectChanges();
    const button = fixture.nativeElement.querySelector('app-description-dialog button');
    expect(button).not.toBeNull(); button.click(); fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('app-description-dialog [aria-label="Vehicle statistics"]').textContent).toContain('150 tons');
    fixture.destroy();
  });

  it('uses the same vehicle statistics in compendium details', async () => {
    const fixture = TestBed.createComponent(CompendiumDetailsComponent);
    fixture.componentRef.setInput('record', linkedGalley); fixture.componentRef.setInput('revision', revision);
    fixture.componentRef.setInput('itemView', await resolveItemView(shipCache, revision.id, linkedGalley)); fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[aria-label="Vehicle statistics"]').textContent).toContain('Damage Threshold');
    expect(fixture.nativeElement.textContent).toContain('4 mph');
    expect(fixture.nativeElement.textContent).toContain('Synthetic repair rules.');
    fixture.destroy();
  });

  it('saves shared type descriptions offline and adds them to previously saved ships on Refresh Descriptions', async () => {
    const before = JSON.stringify(shipType);
    const old = await createInventoryEntry(cache, record, revision);
    expect(old.entity!.typeEntries).toEqual([]);
    const refreshed = await refreshCharacterDescriptions({ ...emptyBasicCharacter(), inventory: [old] }, shipCache, revision);
    const entry = refreshed.sheet.inventory![0];
    expect(refreshed.refreshed).toBe(1);
    expect(entry.entity!.typeEntries).toEqual(shipType.data['entries']);
    const saved = JSON.parse(JSON.stringify(entry.entity));
    const fixture = TestBed.createComponent(EquipmentDetailsComponent);
    fixture.componentRef.setInput('entity', saved); fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Synthetic repair rules.');
    expect(JSON.stringify(shipType)).toBe(before);
    fixture.destroy();
  });

  it('expands nested item-type entry templates using the item while preserving the shared schema content', () => {
    const type: ContentRecord = { ...shipType, data: { entriesTemplate: [
      { type: 'entries', name: 'Crew', entries: ['Requires {{item.crew}} crew.'] },
    ] } };
    const before = JSON.stringify(type);
    expect(itemRuleEntries(type, { crew: 80 })).toEqual([
      { type: 'entries', name: 'Crew', entries: ['Requires 80 crew.'] },
    ]);
    expect(JSON.stringify(type)).toBe(before);
  });

  it('shows available cost and weight for carts that have no ship statistics or prose', async () => {
    const cart = canonicalItemRecord({ kind: 'item', key: 'cart', name: 'Cart', publication: 'XPHB', file: 'items.json',
      data: { name: 'Cart', source: 'XPHB', type: 'VEH|XPHB', value: 1500, weight: 200 }, links: [] });
    const fixture = TestBed.createComponent(ItemCatalogComponent);
    fixture.componentRef.setInput('sheet', emptyBasicCharacter()); fixture.detectChanges();
    await fixture.componentInstance.refreshContent();
    fixture.componentInstance.catalog.results.set([cart]); fixture.componentInstance.catalog.loading.set(false); fixture.detectChanges();
    fixture.nativeElement.querySelector('app-description-dialog button').click(); fixture.detectChanges();
    const panel = fixture.nativeElement.querySelector('app-description-dialog [aria-label="Item statistics"]');
    expect(panel.textContent).toContain('15 gp'); expect(panel.textContent).toContain('200 lb.');
    fixture.destroy();
  });
});
