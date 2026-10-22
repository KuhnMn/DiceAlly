import 'fake-indexeddb/auto';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { OtherProficienciesComponent } from './other-proficiencies.component';
import { emptyBasicCharacter } from './basic-info';
import { IndexedDbCharacterRepository } from '../characters/indexeddb-character-repository';
import { IndexedDbContentCache } from '../content/content-cache';
import { ContentRecord, DEFAULT_CONTENT_SOURCE, ImportRevision, sourceIdentity } from '../content/content.model';

describe('Other Proficiencies', () => {
  beforeEach(() => TestBed.configureTestingModule({ imports: [OtherProficienciesComponent], providers: [provideRouter([])] }));

  it('reveals custom source fields on demand and recognizes existing zero-valued overrides', async () => {
    const fixture = TestBed.createComponent(OtherProficienciesComponent);
    const sheet = emptyBasicCharacter();
    const source = { name: 'Wizard', isSpellcastingSource: true, customToHit: null as number | null, customDc: null as number | null };
    sheet.character!.featureSources = [source];
    fixture.componentRef.setInput('sheet', sheet); fixture.componentRef.setInput('panel', 'sources');
    await fixture.whenStable();
    const input = (label: string) => Array.from(fixture.nativeElement.querySelectorAll('label') as NodeListOf<HTMLLabelElement>)
      .find(element => element.textContent?.trim() === label)?.querySelector('input');
    expect(input('Custom attack bonus')).toBeUndefined();
    input('Use custom values')!.click(); await fixture.whenStable();
    expect(input('Custom attack bonus')).toBeDefined();
    source.customToHit = 0; source.customDc = 14;
    expect(fixture.componentInstance.usesCustomValues(source)).toBe(true);
    input('Use custom values')!.click(); await fixture.whenStable();
    expect(source.customToHit).toBeNull(); expect(source.customDc).toBeNull();
    expect(input('Custom save DC')).toBeUndefined();
    source.customToHit = 0;
    fixture.changeDetectorRef.markForCheck(); await fixture.whenStable();
    expect(input('Use custom values')!.checked).toBe(true);
    expect(input('Custom attack bonus')).toBeDefined();
  });

  it('edits and removes descriptive proficiencies while preserving the other proficiency settings', async () => {
    const fixture = TestBed.createComponent(OtherProficienciesComponent);
    const sheet = emptyBasicCharacter();
    sheet.character!.proficiencies = { languages: ['Common'], simpleWeapons: true,
      custom: ['Weapons with the {@filter Finesse or Light|items|type=martial weapon} property'] };
    fixture.componentRef.setInput('sheet', sheet); await fixture.whenStable();
    expect(fixture.nativeElement.textContent).not.toContain('{@filter');
    const page = fixture.componentInstance;
    page.updateCustomProficiency(0, 'Conditional weapons');
    page.customInput = 'Vehicles'; page.addCustomProficiency();
    const repository = new IndexedDbCharacterRepository(); await repository.save(sheet, 0);
    expect((await repository.get(sheet.character!.characterUuid!))!.sheet.character!.proficiencies!.custom)
      .toEqual(['Conditional weapons', 'Vehicles']);
    page.removeCustomProficiency(0);
    expect(page.customProficiencies).toEqual(['Vehicles']);
    expect(sheet.character!.proficiencies!.languages).toEqual(['Common']);
    expect(sheet.character!.proficiencies!.simpleWeapons).toBe(true);
  });

  it('saves combat flags, conditional disadvantages, languages and multi-ability sources', async () => {
    const fixture = TestBed.createComponent(OtherProficienciesComponent);
    const sheet = emptyBasicCharacter();
    sheet.character!.proficiencies = { skills: { STEALTH: 'EXPERTISE' }, custom: ['Keep legacy text'], tools: { 'Legacy tool': 42 } };
    fixture.componentRef.setInput('sheet', sheet); await fixture.whenStable();
    const page = fixture.componentInstance;
    page.setCombat('simpleWeapons', true); page.setCombat('martialWeapons', true); page.setCombat('initiative', true);
    page.addAdvantage(); Object.assign(page.advantages[0], { aType: 'saving_throw', appliesTo: 'Poison', condition: 'While conscious', isDisadvantage: true });
    page.languageInput = 'Elvish'; page.addLanguage(); page.languageInput = 'elvish'; page.addLanguage();
    page.addSource(); const source = page.sources[0];
    source.isSpellcastingSource = true; source.customDc = 17; source.customToHit = -1;
    page.cycleSourceAbility(source, 'intelligence'); page.cycleSourceAbility(source, 'wisdom');
    const repository = new IndexedDbCharacterRepository(); await repository.save(sheet, 0);
    const saved = (await repository.list()).find(entry => entry.id === sheet.character!.characterUuid)!.sheet;
    expect(saved.character!.proficiencies).toMatchObject({ languages: ['Elvish'], initiative: true, simpleWeapons: true,
      martialWeapons: true, skills: { STEALTH: 'EXPERTISE' }, tools: { 'Legacy tool': 42 }, custom: ['Keep legacy text'] });
    expect(saved.character!.advantageOn![0]).toMatchObject({ aType: 'saving_throw', isDisadvantage: true, appliesTo: 'Poison' });
    expect(saved.character!.featureSources![0]).toMatchObject({ associatedAbilities: { features: ['intelligence', 'wisdom'], spellcasting: [] }, customDc: 17, customToHit: -1 });
    page.removeLanguage(0); page.removeAdvantage(0); page.removeTool('Legacy tool'); page.removeSource(0);
    expect(page.languages).toEqual([]); expect(page.advantages).toEqual([]); expect(page.sources).toEqual([]);
  });

  it('reads only actual imported tool item categories and stores a portable selected snapshot', async () => {
    const cache = new IndexedDbContentCache();
    const revision: ImportRevision = { id: crypto.randomUUID(), namespace: 'development-local', source: DEFAULT_CONTENT_SOURCE,
      sourceIdentity: sourceIdentity(DEFAULT_CONTENT_SOURCE), commit: 'a'.repeat(40), adapterVersion: 6, status: 'staging',
      createdAt: new Date().toISOString(), files: [], diagnostics: [], metrics: { bytes: 0, records: 5, elapsedMs: 0, mappedBytes: 0 } };
    const records: ContentRecord[] = ['T', 'AT|PHB', 'GS', 'INS', 'M'].map((type, i) => ({ key: `tool-test-${i}`,
      kind: 'item', name: `Item ${i}`, publication: 'TEST', file: 'synthetic.json', links: [], data: { type } }));
    await cache.stage(revision); await cache.put(revision.id, records); await cache.activate(revision);
    await cache.saveSource('development-local', DEFAULT_CONTENT_SOURCE);
    const fixture = TestBed.createComponent(OtherProficienciesComponent); const sheet = emptyBasicCharacter();
    fixture.componentRef.setInput('sheet', sheet); await fixture.whenStable();
    const page = fixture.componentInstance; await page.loadTools();
    expect(page.tools()).toHaveLength(4);
    fixture.changeDetectorRef.markForCheck(); await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('input[type="search"]')).toBeNull();
    (fixture.nativeElement.querySelector('button[aria-haspopup="dialog"]') as HTMLButtonElement).click();
    await fixture.whenStable();
    const search = fixture.nativeElement.querySelector('input[type="search"]') as HTMLInputElement;
    expect(search).toBeTruthy(); search.value = 'Item 1'; search.dispatchEvent(new Event('input', { bubbles: true }));
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelectorAll('[role="option"]').length).toBe(1);
    (fixture.nativeElement.querySelector('[role="option"]') as HTMLButtonElement).click();
    await fixture.whenStable(); expect(fixture.nativeElement.querySelector('[role="dialog"]')).toBeNull();
    expect(sheet.character!.proficiencies!.tools!['Item 1 (TEST)']).toMatchObject({ contentKey: records[1].key,
      revisionId: revision.id, sourceIdentity: revision.sourceIdentity, snapshot: { data: { type: 'AT|PHB' } } });
  });

  it('keeps feature sources on their own panel and adds editable advantage entries', async () => {
    const fixture = TestBed.createComponent(OtherProficienciesComponent); const sheet = emptyBasicCharacter();
    fixture.componentRef.setInput('sheet', sheet); await fixture.whenStable();
    const page = fixture.componentInstance;
    expect(fixture.nativeElement.textContent).not.toContain('Feature Sources');
    page.addAdvantage(); expect(page.advantages[0].appliesTo).toBe('');
    page.advantages[0].appliesTo = 'Stealth'; page.addAdvantage();
    expect(page.advantages[0].appliesTo).toBe('Stealth'); expect(page.advantages[1].appliesTo).toBe('');
    fixture.componentRef.setInput('panel', 'sources'); await fixture.whenStable();
    expect([...fixture.nativeElement.querySelectorAll('h2')].map((heading: HTMLElement) => heading.textContent)).toEqual(['Feature Sources']);
  });

  it('renames source links together and rejects duplicate source labels', async () => {
    const fixture = TestBed.createComponent(OtherProficienciesComponent); const sheet = emptyBasicCharacter();
    fixture.componentRef.setInput('sheet', sheet); await fixture.whenStable();
    const page = fixture.componentInstance; page.addSource(); page.addSource();
    sheet.features = [{ name: 'Feature', featureSourceName: 'New Source' }];
    sheet.spells = [{ name: 'Spell', castingSourceName: 'New Source' }];
    sheet.character!.spellSlots = { 'New Source': [{ level: 1, total: 2, used: 1 }] };
    const field = document.createElement('input'); field.value = 'Wizard';
    const event = new Event('change'); Object.defineProperty(event, 'target', { value: field });
    page.renameSource(page.sources[1], event);
    expect(sheet.features[0].featureSourceName).toBe('Wizard'); expect(sheet.spells[0].castingSourceName).toBe('Wizard');
    expect(sheet.character!.spellSlots!['Wizard'][0].used).toBe(1);
    field.value = 'Wizard'; page.renameSource(page.sources[0], event);
    expect(page.sources[0].name).toBe('New Source 2'); expect(page.sourceMessage()).toMatch(/unique/);
  });
});
