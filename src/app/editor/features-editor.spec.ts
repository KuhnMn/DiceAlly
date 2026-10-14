import 'fake-indexeddb/auto';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { FeaturesEditorComponent } from './features-editor.component';
import { BasicInfoRepository } from './basic-info-repository';
import { emptyBasicCharacter } from './basic-info';
import { IndexedDbContentCache } from '../content/content-cache';
import { mapContent } from '../content/content-adapter';
import { DEFAULT_CONTENT_SOURCE, ImportRevision, sourceIdentity } from '../content/content.model';
import { RestService } from '../services/rest.service';
import { EntryRendererComponent } from '../entries/entry-renderer.component';

async function catalog() {
  const source = { ...DEFAULT_CONTENT_SOURCE, owner: 'feature-editor-test' };
  const revision: ImportRevision = { id: crypto.randomUUID(), namespace: 'development-local', source,
    sourceIdentity: sourceIdentity(source), commit: 'a'.repeat(40), adapterVersion: 6, status: 'staging',
    createdAt: new Date().toISOString(), files: [], diagnostics: [], metrics: { bytes: 0, records: 48, elapsedMs: 0, mappedBytes: 0 } };
  const records = mapContent({
    classFeature: ['Fighter', 'Rogue'].map(className => ({ name: 'Training', source: 'PHB', className, classSource: 'PHB', level: 1, entries: ['Selected description'] })),
    subclassFeature: [{ name: 'Improved Training', source: 'PHB', className: 'Fighter', classSource: 'PHB', subclassShortName: 'Champion', subclassSource: 'PHB', level: 3, entries: ['Subclass text'] }],
    feat: Array.from({ length: 45 }, (_, i) => ({ name: `Feat ${String(i).padStart(2, '0')}`, source: 'TEST', entries: ['Feat text'] })),
    optionalfeature: [{ name: 'Style', source: 'TEST', featureType: ['FS'], entries: ['Style text'] }],
  }, 'synthetic.json').records;
  const cache = new IndexedDbContentCache(); await cache.stage(revision); await cache.put(revision.id, records); await cache.activate(revision);
  await cache.saveSource('development-local', source);
  return { cache, revision, records };
}

describe('Feature editor', () => {
  beforeEach(() => TestBed.configureTestingModule({ imports: [FeaturesEditorComponent], providers: [provideRouter([])] }));

  it('renders plain descriptions without JSON quotes and keeps separate entries under a heading', async () => {
    const renderer = TestBed.createComponent(EntryRendererComponent);
    renderer.componentRef.setInput('entries', ['Plain description']); await renderer.whenStable();
    expect(renderer.nativeElement.textContent.trim()).toBe('Plain description');
    const fixture = TestBed.createComponent(FeaturesEditorComponent); const sheet = emptyBasicCharacter();
    sheet.character!.abilityScores!.intelligence = 16;
    fixture.componentRef.setInput('sheet', sheet); await fixture.whenStable();
    const editor = fixture.componentInstance;
    expect(editor.sourceStats({ usesIntelligence: true })).toEqual([{ ability: 'INT', attack: '+5', save: 13 }]);
    expect(editor.sourceStats({ customDc: 17, customToHit: -1 })).toEqual([{ ability: 'CUSTOM', attack: '-1', save: 17 }]);
    editor.customName = 'Notes test'; editor.addCustom(); const feature = sheet.features![0]; editor.addNote(feature);
    const group = feature.notes![0]; group.tag = 'Tactics';
    editor.setNoteEntry(group, 0, 'First entry\nwith a second line'); editor.addNoteEntry(group); editor.setNoteEntry(group, 1, 'Second entry');
    expect(group.notes).toEqual(['First entry\nwith a second line', 'Second entry']);
    editor.removeNoteEntry(group, 0); expect(group.notes).toEqual(['Second entry']); expect(group.tag).toBe('Tactics');
    group.isEditable = false;
    editor.addNoteEntry(group); editor.noteDraft = 'Third entry'; editor.commitNote();
    expect(group.notes).toEqual(['Second entry', 'Third entry']); expect(group.isEditable).toBe(false);
    const repository = new BasicInfoRepository(); await repository.save(sheet, 0);
    expect((await repository.list()).find(entry => entry.id === sheet.character!.characterUuid)!.sheet.features![0].notes![0].isEditable).toBe(false);
  });

  it('separates all three types, keeps qualified class identities and bounds catalog pages', async () => {
    const data = await catalog();
    const page = await data.cache.searchCategory(data.revision.id, ['feat'], '', 30, 30);
    expect(page.total).toBe(45); expect(page.records).toHaveLength(15);
    const fighter = await data.cache.searchCategory(data.revision.id, ['classFeature', 'subclassFeature'], 'Training Fighter PHB');
    expect(fighter.total).toBe(2);
    const fixture = TestBed.createComponent(FeaturesEditorComponent); const sheet = emptyBasicCharacter();
    fixture.componentRef.setInput('sheet', sheet); await fixture.whenStable();
    const editor = fixture.componentInstance; await editor.refreshContent();
    const classes = data.records.filter(r => r.kind === 'classFeature');
    for (const record of classes) editor.add(record);
    editor.add(classes[0]); expect(sheet.features).toHaveLength(2);
    expect(sheet.features![0].contentReference!.key).not.toBe(sheet.features![1].contentReference!.key);
    editor.selectedType = 'FEAT'; editor.add(data.records.find(r => r.kind === 'feat')!);
    editor.selectedType = 'OPTIONAL_FEATURE'; editor.add(data.records.find(r => r.kind === 'optionalfeature')!);
    expect(editor.selected).toHaveLength(1); expect(editor.selected[0].optionalFeatureEntity).toBeTruthy();
    editor.selectedType = 'FEAT'; expect(editor.selected[0].featEntity).toBeTruthy();
    editor.selectedType = 'CLASS_FEATURE'; expect(editor.selected).toHaveLength(2);
  });

  it('retains snapshots, editable notes and multiple independent uses through save and missing cache', async () => {
    const data = await catalog(); const sheet = emptyBasicCharacter();
    const fixture = TestBed.createComponent(FeaturesEditorComponent); fixture.componentRef.setInput('sheet', sheet); await fixture.whenStable();
    const editor = fixture.componentInstance; await editor.refreshContent(); editor.add(data.records.find(r => r.kind === 'classFeature')!);
    const feature = sheet.features![0]; editor.addNote(feature); editor.setNoteEntry(feature.notes![0], 0, 'Remember this');
    editor.addNoteEntry(feature.notes![0]); editor.setNoteEntry(feature.notes![0], 1, 'Second note');
    for (const recovery of ['SHORT_REST', 'SHORT_REST_ONE', 'LONG_REST', 'MANUAL']) {
      editor.addUses(feature); const use = feature.uses!.at(-1)!;
      use.totalFreeUses = 3; use.usedFreeUses = 2; use.freeUsesRegainCondition = recovery;
    }
    feature.uses![0].totalFreeUses = 1;
    const repository = new BasicInfoRepository(); await repository.save(sheet, 0);
    const saved = (await repository.list()).find(entry => entry.id === sheet.character!.characterUuid)!.sheet;
    expect(saved.features![0].notes![0].notes).toEqual(['Remember this', 'Second note']);
    expect(saved.features![0].uses![0].usedFreeUses).toBe(2);
    expect(saved.features![0].featureEntity!.entries).toEqual(['Selected description']);
    editor.revision.set(null); fixture.componentRef.setInput('sheet', saved); await fixture.whenStable();
    expect(editor.selected[0].notes![0].notes[0]).toBe('Remember this');
    editor.addNote(editor.selected[0]); editor.addUses(editor.selected[0]);
    expect(saved.features![0].notes).toHaveLength(2);
  });

  it('supports custom features and feature rest recovery without requiring content', async () => {
    const fixture = TestBed.createComponent(FeaturesEditorComponent); const sheet = emptyBasicCharacter();
    sheet.character!.featureSources = [{ name: 'General', isGeneralFeatureSource: true }];
    fixture.componentRef.setInput('sheet', sheet); await fixture.whenStable();
    const editor = fixture.componentInstance; editor.selectedSource = ''; editor.selectedType = 'FEAT';
    editor.customName = 'Custom feat'; editor.customDescription = 'Private description'; editor.addCustom();
    const feature = sheet.features![0]; expect(feature.featureSourceName).toBeUndefined();
    editor.addUses(feature); feature.uses![0].totalFreeUses = 3; feature.uses![0].usedFreeUses = 3;
    feature.uses![0].freeUsesRegainCondition = 'SHORT_REST_ONE';
    TestBed.inject(RestService).performShortRest(sheet); expect(feature.uses![0].usedFreeUses).toBe(2);
    feature.uses![0].freeUsesRegainCondition = 'MANUAL';
    TestBed.inject(RestService).performLongRest(sheet); expect(feature.uses![0].usedFreeUses).toBe(2);
    expect(editor.entries(feature)).toEqual([{ text: 'Private description' }]);
  });
});
