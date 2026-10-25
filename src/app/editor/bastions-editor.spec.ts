import 'fake-indexeddb/auto';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { vi } from 'vitest';
import { mapContent } from '../content/content-adapter';
import { adaptBastionDefinition } from '../content/reference-content-adapter';
import type { BastionSource } from '../content/bastion.model';
import { ADAPTER_VERSION, DEFAULT_CONTENT_SOURCE, ImportRevision, sourceIdentity } from '../content/content.model';
import { IndexedDbContentCache } from '../content/content-cache';
import { IndexedDbCharacterRepository } from '../characters/indexeddb-character-repository';
import { encodeCloudCharacter, decodeCloudCharacter } from '../characters/sync/character-cloud';
import { portableCharacter } from '../characters/portable-character';
import { emptyBasicCharacter } from './basic-info';
import { BastionsEditorComponent } from './bastions-editor.component';
import { EntryAnnotationsComponent } from './entry-annotations.component';
import { SourceBookFilterService } from './source-book-filter.service';
import { createFacilityEntry } from './facility-selection';
import { refreshCharacterDescriptions } from './refresh-character-content';

const revision: ImportRevision = { id: 'bastions-test', namespace: 'development-local', source: DEFAULT_CONTENT_SOURCE,
  sourceIdentity: sourceIdentity(DEFAULT_CONTENT_SOURCE), commit: 'a'.repeat(40), adapterVersion: ADAPTER_VERSION,
  status: 'ready', createdAt: new Date().toISOString(), files: [], diagnostics: [], metrics: { bytes: 0, records: 1, mappedBytes: 0, elapsedMs: 0 } };
function record(name = 'Arcane Study', book = 'XDMG', level = 5) {
  const source: BastionSource = { name, source: book, facilityType: 'special', level,
    prerequisite: [{ spellcasting: true }], entries: ['Study spells in your bastion.'] };
  return { ...mapContent({ facility: [source] }, 'bastions.json').records[0], data: {}, referenceDefinition: { ...adaptBastionDefinition(source), kind: 'facility' as const } };
}

describe('Bastion facility editor', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    TestBed.inject(SourceBookFilterService).setSelection([]);
  });

  it('adds independent offline snapshots, edits notes without uses or Combat, and persists plan and instances through saves and cloud export', async () => {
    const sheet = emptyBasicCharacter(), fixture = TestBed.createComponent(BastionsEditorComponent);
    fixture.componentRef.setInput('sheet', sheet); await fixture.whenStable();
    const editor = fixture.componentInstance; editor.catalog.revision.set(revision);
    const source = record(); editor.add(source); editor.add(source);
    const [first, second] = sheet.bastion!.facilities!;
    expect(first.editorId).not.toBe(second.editorId);
    expect(first.notes).toEqual([]); expect(second.notes).toEqual([]);
    first.entity.entries.push('Private instance description');
    expect(second.entity.entries).not.toContain('Private instance description');
    expect(source.referenceDefinition.entries).not.toContain('Private instance description');
    editor.toggle(first); fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[aria-label="Uses editor"]')).toBeNull();
    expect(fixture.nativeElement.querySelector('app-combat-bookmark')).toBeNull();
    const annotations = fixture.debugElement.query(By.directive(EntryAnnotationsComponent)).componentInstance as EntryAnnotationsComponent;
    annotations.addNote(first);
    annotations.setNoteEntry(first.notes![0], 0, 'Research the old tower');
    editor.setPlan(' https://example.com/bastion.png ');
    const repo = new IndexedDbCharacterRepository('bastions-' + crypto.randomUUID());
    await repo.save(sheet, 0); const saved = (await repo.get(sheet.character!.characterUuid!))!;
    expect(saved.sheet.bastion).toEqual(sheet.bastion);
    const cloud = await encodeCloudCharacter(saved, 1), decoded = await decodeCloudCharacter(saved.id, cloud);
    expect(decoded.sheet.bastion).toEqual(sheet.bastion);
    expect(portableCharacter(JSON.parse(JSON.stringify(sheet))).bastion).toEqual(sheet.bastion);
    editor.remove(first); expect(editor.pendingRemoval).toBe(first); expect(editor.facilities).toHaveLength(2);
    editor.pendingRemoval = undefined; expect(editor.facilities).toHaveLength(2);
    editor.remove(first); editor.confirmRemoval(); expect(editor.facilities).toEqual([second]);
    editor.remove(second); expect(editor.facilities).toEqual([]);
    expect(sheet.bastion!.planUrl).toBe('https://example.com/bastion.png');
  });

  it('searches and filters the library by book, type and level, with filtering before pagination', async () => {
    const cache = new IndexedDbContentCache(), imported = { ...revision, id: crypto.randomUUID(), status: 'staging' as const };
    const rows = [record('Excluded', 'OLD', 5), record('High Study', 'XDMG', 9), record('Library', 'XDMG', 5)];
    const basic = record('Bedroom', 'XDMG', 0); basic.referenceDefinition.facilityType = 'basic'; rows.push(basic);
    await cache.stage(imported); await cache.put(imported.id, rows);
    vi.spyOn(IndexedDbContentCache.prototype, 'savedSource').mockResolvedValue(imported.source);
    vi.spyOn(IndexedDbContentCache.prototype, 'active').mockResolvedValue(imported);
    TestBed.inject(SourceBookFilterService).setSelection(['XDMG']);
    const fixture = TestBed.createComponent(BastionsEditorComponent); fixture.componentRef.setInput('sheet', emptyBasicCharacter()); await fixture.whenStable();
    const editor = fixture.componentInstance; await editor.refreshContent();
    expect(editor.catalog.total()).toBe(3); expect(editor.catalogLevels).toEqual([0, 5, 9]);
    editor.type = 'special'; editor.level = '5'; editor.searchChanged(); await new Promise(resolve => setTimeout(resolve, 250)); await fixture.whenStable();
    expect(editor.catalog.results().map(row => row.name)).toEqual(['Library']);
    editor.clearFilters(); editor.search = 'bedroom'; editor.searchChanged(); await new Promise(resolve => setTimeout(resolve, 250)); await fixture.whenStable();
    expect(editor.catalog.results().map(row => row.name)).toEqual(['Bedroom']);
  });

  it('supports custom facilities without a library and preserves authored notes and plans when descriptions refresh', async () => {
    const sheet = emptyBasicCharacter(), fixture = TestBed.createComponent(BastionsEditorComponent);
    fixture.componentRef.setInput('sheet', sheet); await fixture.whenStable();
    const editor = fixture.componentInstance;
    editor.customName = ' Hidden Workshop '; editor.customDescription = 'A quiet room.'; editor.customType = 'special'; editor.customLevel = 9; editor.addCustom();
    const custom = editor.facilities[0]; expect(custom.notes).toEqual([]); expect(custom.entity).toMatchObject({ name: 'Hidden Workshop', facilityType: 'special', level: 9, entries: ['A quiet room.'] });
    expect(custom).not.toHaveProperty('uses'); expect(custom).not.toHaveProperty('contentReference');
    const facility = createFacilityEntry(record(), revision); sheet.bastion!.facilities!.push(facility);
    facility.notes = [{tag: 'Projects', notes: ['Keep these notes']}]; editor.setPlan('https://example.com/map.png');
    const fresh = record(); fresh.referenceDefinition.entries = ['Updated source text'];
    const result = await refreshCharacterDescriptions(sheet, { get: async (_id, key) => key === fresh.key ? fresh : undefined }, revision);
    expect(result.sheet.bastion!.facilities![1].entity.entries).toEqual(['Updated source text']);
    expect(result.sheet.bastion!.facilities![1].notes).toEqual(facility.notes);
    expect(result.sheet.bastion!.facilities![1].editorId).toBe(facility.editorId);
    expect(result.sheet.bastion!.facilities![0]).toEqual(custom);
    expect(result.sheet.bastion!.planUrl).toBe(sheet.bastion!.planUrl);
    expect(facility.entity.entries).toEqual(['Study spells in your bastion.']);
  });
});
