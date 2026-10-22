import 'fake-indexeddb/auto';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { mapContent } from '../content/content-adapter';
import { adaptObjectDefinition } from '../content/reference-content-adapter';
import type { ObjectSource } from '../content/object.model';
import { ADAPTER_VERSION, DEFAULT_CONTENT_SOURCE, ImportRevision, sourceIdentity } from '../content/content.model';
import { emptyBasicCharacter, validateBasicInfo } from './basic-info';
import { createObjectEntry } from './object-selection';
import { MonstersEditorComponent } from './monsters-editor.component';
import { MonstersPageComponent } from '../sheet/monsters-page.component';
import { ObjectStatBlockComponent } from '../sheet/object-stat-block.component';
import { CharacterLibraryService } from '../characters/character-library.service';
import { encodeCloudCharacter, decodeCloudCharacter } from '../characters/sync/character-cloud';
import { portableCharacter } from '../characters/portable-character';
import { RestService } from '../services/rest.service';
import { summarizeRest } from '../services/rest-report';
import { refreshCharacterDescriptions } from './refresh-character-content';
import { prefillCombatAction, resolveCombatResource, combatSourceSuggestion } from './combat-actions';
import { CharacterHelpersService } from '../sheet/character-helpers.service';
import { CharacterStore } from '../stores/character.store';

const revision: ImportRevision = { id: 'object-companions', namespace: 'development-local', source: DEFAULT_CONTENT_SOURCE,
  sourceIdentity: sourceIdentity(DEFAULT_CONTENT_SOURCE), commit: 'a'.repeat(40), adapterVersion: ADAPTER_VERSION,
  status: 'ready', createdAt: new Date().toISOString(), files: [], diagnostics: [], metrics: { bytes: 0, records: 1, mappedBytes: 0, elapsedMs: 0 } };
function record(hp = 50) {
  const source: ObjectSource = { name: 'Ballista', source: 'XDMG', page: 96, size: ['L'], objectType: 'SW', ac: 15, hp,
    entries: ['Loading and aiming require the Utilize action.'],
    actionEntries: [{ type: 'entries', name: 'Ballista Bolt (Requires Load and Aim)', entries: ['{@atkr r} {@hit 6}, range 120/480 ft. {@h}16 ({@damage 3d10}) Piercing damage.'] }],
  };
  return { ...mapContent({ object: [source] }, 'objects.json').records[0], data: {}, referenceDefinition: { ...adaptObjectDefinition(source), kind: 'object' as const } };
}

describe('Object companions', () => {
  beforeEach(() => TestBed.configureTestingModule({ providers: [provideRouter([])] }));

  it('adds independent typed object snapshots, keeps monster selections separate, saves offline and confirms annotated removal', async () => {
    const fixture = TestBed.createComponent(MonstersEditorComponent), sheet = emptyBasicCharacter();
    sheet.monsters = [{ editorId: 'wolf', name: 'Wolf', source: 'Custom', entity: { name: 'Wolf' } }];
    const monsters = structuredClone(sheet.monsters);
    fixture.componentRef.setInput('sheet', sheet); await fixture.whenStable();
    const editor = fixture.componentInstance;
    editor.setType('object'); await editor.refreshContent(); editor.catalog.revision.set(revision);
    const source = record(); editor.add(source); editor.add(source);
    expect(editor.hasExisting(source)).toBe(true);
    expect(sheet.objects).toHaveLength(2);
    const [object, second] = sheet.objects!;
    expect(object.editorId).not.toBe(second.editorId);
    expect(object.hitPoints).toEqual({ enabled: false });
    editor.setMaxHp(object, 60); object.hitPoints.current = 44; object.hitPoints.temporary = 8;
    object.notes = [{ tag: 'Crew', notes: ['Load, aim, fire'], isEditable: true }];
    object.uses = [{ tag: 'Bolts', totalFreeUses: 4, usedFreeUses: 1, freeUsesRegainCondition: 'MANUAL' }];
    object.entity!.entries.push('Private annotation test');
    expect(second.entity!.entries).not.toContain('Private annotation test');
    expect(second.notes).toEqual([]); expect(second.uses).toEqual([]);
    expect(second.hitPoints).toEqual({ enabled: false });
    validateBasicInfo(sheet);
    const library = TestBed.inject(CharacterLibraryService);
    await library.save(sheet, 0);
    const saved = (await library.get(sheet.character!.characterUuid!))!;
    expect(saved.sheet.objects).toEqual(sheet.objects);
    const cloud = await encodeCloudCharacter(saved, 1), decoded = await decodeCloudCharacter(saved.id, cloud);
    expect(decoded.sheet.objects).toEqual(sheet.objects);
    expect(portableCharacter(JSON.parse(JSON.stringify(sheet))).objects).toEqual(sheet.objects);
    expect(sheet.monsters).toEqual(monsters);
    editor.remove(object); expect(editor.pendingRemoval).toBe(object);
    editor.confirmRemoval(); expect(sheet.objects).toEqual([second]);
    editor.selectedType = 'monster'; expect(editor.monsters).toEqual(monsters);
  });

  it('refreshes only the definition, preserves tracking and uses the existing rest recovery settings', async () => {
    const sheet = emptyBasicCharacter(), object = createObjectEntry(record(), revision);
    sheet.objects = [object]; object.hitPoints = { enabled: true, maximum: 60, maximumOverride: 70, current: 41, temporary: 5 };
    object.notes = [{ tag: 'Crew', notes: ['Two operators'] }];
    object.uses = ['SHORT_REST', 'SHORT_REST_ONE', 'LONG_REST', 'MANUAL'].map(freeUsesRegainCondition => ({ tag: freeUsesRegainCondition, totalFreeUses: 5, usedFreeUses: 3, freeUsesRegainCondition }));
    const fresh = record(80), before = structuredClone(sheet);
    const refreshed = (await refreshCharacterDescriptions(sheet, { get: async (_revision, key) => key === fresh.key ? fresh : undefined }, revision)).sheet.objects![0];
    expect(refreshed.entity!.hp).toBe(80);
    expect(refreshed.hitPoints).toEqual(object.hitPoints); expect(refreshed.notes).toEqual(object.notes); expect(refreshed.uses).toEqual(object.uses);
    const rest = TestBed.inject(RestService); rest.performShortRest(sheet);
    expect(object.uses.map(use => use.usedFreeUses)).toEqual([0, 2, 3, 3]);
    expect(summarizeRest(before, sheet)).toContain('Ballista (SHORT_REST_ONE) uses: 1 restored');
    rest.performLongRest(sheet); expect(object.uses.map(use => use.usedFreeUses)).toEqual([0, 1, 0, 3]);
    expect(object.hitPoints).toEqual(before.objects![0].hitPoints);
    object.hitPoints.current = -1;
    expect(() => portableCharacter(sheet)).toThrow('current HP');
  });

  it('reuses the viewer controls for HP, temporary HP, overrides, notes, and source/type tags', () => {
    const fixture = TestBed.createComponent(MonstersPageComponent), sheet = emptyBasicCharacter();
    const object = createObjectEntry(record(), revision);
    object.hitPoints = { enabled: true, maximum: 50, current: 40, temporary: 8 };
    sheet.objects = [object]; sheet.monsters = [{ name: 'Wolf', editorId: 'wolf', entity: { name: 'Wolf', hp: { average: 11 } } }];
    fixture.componentRef.setInput('characterData', sheet); fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('article')?.textContent).toContain('Wolf');
    const objectView = [...fixture.nativeElement.querySelectorAll('nav[aria-label="Companion views"] button')] as HTMLButtonElement[];
    objectView.find(button => button.textContent?.trim() === 'Objects')!.click(); fixture.detectChanges();
    const article = fixture.nativeElement.querySelector('article') as HTMLElement;
    expect(article.textContent).toContain('Ballista'); expect(article.textContent).not.toContain('Wolf');
    expect(article.textContent).toContain('Siege Weapon'); expect(article.textContent).toContain('XDMG');
    const hp = article.querySelector('input[aria-label="Ballista current HP"]') as HTMLInputElement;
    hp.value = '35'; hp.dispatchEvent(new Event('input')); fixture.detectChanges();
    expect(object.hitPoints.current).toBe(35);
    article.querySelector<HTMLButtonElement>('button[aria-label="Clear temporary HP for Ballista"]')!.click(); fixture.detectChanges();
    expect(object.hitPoints.temporary).toBe(0);
    article.querySelector<HTMLButtonElement>('h3 button')!.click(); fixture.detectChanges();
    const dialog = article.querySelector('dialog')!;
    expect(dialog.textContent).toContain('Ballista Bolt');
    expect(dialog.textContent).toContain('Siege Weapon'); expect(dialog.textContent).toContain('XDMG');
    expect(dialog.textContent).not.toContain('Initiative'); expect(dialog.textContent).not.toContain('CR');
    const page = fixture.componentInstance;
    page.onMonsterMaxHpOverrideInput(object, '20'); page.commitMonsterMaxHpOverride(object);
    expect(object.hitPoints.current).toBe(20); expect(page.getEffectiveMonsterMaxHP(object)).toBe(20);
    page.clearMonsterMaxHpOverride(object); expect(page.getEffectiveMonsterMaxHP(object)).toBe(50);
    page.setCompanionType('monster'); fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('article')?.textContent).toContain('Wolf');
  });

  it('renders supplied special statistics, conditional speeds, defenses and abilities without inventing absent values', () => {
    const fixture = TestBed.createComponent(ObjectStatBlockComponent), object = createObjectEntry(record(), revision);
    Object.assign(object.entity!, { hp: { special: 'Five times your level' }, ac: { special: 'Your spell save DC' },
      speed: { walk: 30, fly: { number: 20, condition: 'While powered' }, canHover: true },
      str: 14, immune: ['poison'], conditionImmune: ['charmed'], senses: ['Darkvision 60 ft.'] });
    fixture.componentRef.setInput('value', object); fixture.detectChanges();
    const text = fixture.nativeElement.textContent;
    for (const expected of ['Five times your level', 'Your spell save DC', 'While powered', 'can hover', '14', '+2', 'poison', 'charmed', 'Darkvision 60 ft.']) expect(text).toContain(expected);
    expect(fixture.componentInstance.abilities().map(ability => ability.name)).toEqual(['str']);
    expect(fixture.nativeElement.querySelectorAll('.border-l-4.border-secondary').length).toBe(2);
    expect(fixture.nativeElement.querySelector('.border-l-4.border-tertiary')?.textContent).toContain('Condition Immunities:');
  });

  it('keeps special HP badges short and renders the full Eldritch Cannon rules in its details', () => {
    const source = record();
    source.referenceDefinition.hp = { special: '5 × your artificer level (casting {@spell Mending|XPHB} on the cannon restores {@dice 2d6} hit points to it)' };
    source.referenceDefinition.entries = ['{@note Created by the {@subclassFeature Eldritch Cannon|Artificer|EFA|Artillerist|EFA|3} subclass feature.}'];
    source.referenceDefinition.immune = ['poison', 'psychic'];
    const editor = TestBed.createComponent(MonstersEditorComponent);
    editor.componentRef.setInput('sheet', emptyBasicCharacter());
    expect(editor.componentInstance.catalogHp(source)).toBe('Special');
    const fixture = TestBed.createComponent(ObjectStatBlockComponent), object = createObjectEntry(source, revision);
    const before = structuredClone(object);
    fixture.componentRef.setInput('value', object); fixture.detectChanges();
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('casting Mending on the cannon restores 2d6 hit points');
    expect(text).toContain('Created by the Eldritch Cannon subclass feature.');
    expect(text).not.toMatch(/\{@|\}|\|XPHB/);
    expect(fixture.nativeElement.querySelector('.border-l-4.border-secondary')?.textContent).toContain('poison, psychic');
    expect(object).toEqual(before);
  });

  it('links object actions to combat and switches to the object view when navigating to the bookmark', () => {
    const sheet = emptyBasicCharacter(), object = createObjectEntry(record(), revision);
    sheet.objects = [object];
    const helpers = TestBed.inject(CharacterHelpersService), action = prefillCombatAction(sheet, object, 'OBJECT', helpers);
    sheet.combatActions = [action];
    expect(action.name).toContain('Ballista Bolt'); expect(action.hitOrDc).toContain('+6');
    expect(resolveCombatResource(sheet, action)).toBe(object);
    expect(combatSourceSuggestion(sheet, action, helpers)?.name).toBe(action.name);
    const fixture = TestBed.createComponent(MonstersPageComponent);
    fixture.componentRef.setInput('characterData', sheet); fixture.detectChanges();
    TestBed.inject(CharacterStore).setFeatureScrollTarget(`object-${object.editorId}`); fixture.detectChanges();
    expect(fixture.componentInstance.companionType()).toBe('object');
    expect(fixture.componentInstance.isExpanded(`object-${object.editorId}`)).toBe(true);
  });
});
