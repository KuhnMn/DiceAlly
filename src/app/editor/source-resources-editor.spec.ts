import 'fake-indexeddb/auto';
import { IndexedDbCharacterRepository } from '../characters/indexeddb-character-repository';
import { encodeCloudCharacter, decodeCloudCharacter } from '../characters/sync/character-cloud';
import { TestBed } from '@angular/core/testing';
import { SourceResourcesEditorComponent } from './source-resources-editor.component';
import { ResourceLinksEditorComponent } from './resource-links-editor.component';
import { SourceResourcesComponent } from '../sheet/source-resources.component';
import { ResourceUseComponent } from '../sheet/resource-use.component';
import { CharacterStore } from '../stores/character.store';
import { emptyBasicCharacter } from './basic-info';
describe('Resource editing and tracking', () => {
  it('prefills placement from the selected source and lets both colored options be changed independently', async () => {
    for (const [features,spells] of [[true,false],[false,true],[true,true],[false,false]]) {
      const sheet=emptyBasicCharacter();
      sheet.character!.featureSources=[{editorId:'source',name:'Source',isGeneralFeatureSource:features,isSpellcastingSource:spells},
        {editorId:'other',name:'Other',isGeneralFeatureSource:!features,isSpellcastingSource:!spells}];
      const fixture=TestBed.createComponent(SourceResourcesEditorComponent);
      fixture.componentRef.setInput('sheet',sheet);fixture.componentInstance.add();await fixture.whenStable();
      const resource=sheet.resources![0];
      expect(resource).toMatchObject({features,spells});
      const checkboxes=[...fixture.nativeElement.querySelectorAll('.source-option input')] as HTMLInputElement[];
      expect(checkboxes.map(input=>input.checked)).toEqual([features,spells]);
      checkboxes[0].click();await fixture.whenStable();
      expect(resource).toMatchObject({features:!features,spells});
      checkboxes[1].click();await fixture.whenStable();
      expect(resource).toMatchObject({features:!features,spells:!spells});
      expect(sheet.character!.featureSources[0]).toMatchObject({isGeneralFeatureSource:features,isSpellcastingSource:spells});
      const source=fixture.nativeElement.querySelector('select') as HTMLSelectElement;
      source.value='other';source.dispatchEvent(new Event('change'));await fixture.whenStable();
      expect(resource).toMatchObject({sourceId:'other',features:!features,spells:!spells});
      fixture.destroy();
    }
  });
  it('round-trips resource definitions, play counters and spell costs through local and cloud storage', async () => {
    const sheet=emptyBasicCharacter();sheet.character!.name='Resources';sheet.character!.featureSources=[{editorId:'source',name:'Mage'}];
    const fixture=TestBed.createComponent(SourceResourcesEditorComponent);fixture.componentRef.setInput('sheet',sheet);fixture.componentInstance.add();
    const pool=sheet.resources![0];pool.total=10;pool.used=4;
    sheet.spells=[{editorId:'spell',name:'Spell',resourceLinks:[{resourceId:pool.id,amount:3}]}];
    const repository=new IndexedDbCharacterRepository('resource-round-trip-'+crypto.randomUUID());
    await repository.save(sheet,0);const saved=(await repository.get(sheet.character!.characterUuid!))!;
    const cloud=await encodeCloudCharacter(saved,1), restored=await decodeCloudCharacter(saved.id,cloud);
    expect(restored.sheet.resources).toEqual(sheet.resources);expect(restored.sheet.spells![0].resourceLinks).toEqual(sheet.spells[0].resourceLinks);
    fixture.destroy();
  });
  it('creates source pools, displays reminders without counters, and cleans up links on removal', async () => {
    const sheet = emptyBasicCharacter();
    sheet.character!.featureSources = [{ name: 'Rogue', isGeneralFeatureSource: true }];
    const fixture = TestBed.createComponent(SourceResourcesEditorComponent);
    fixture.componentRef.setInput('sheet', sheet);
    fixture.detectChanges();
    fixture.nativeElement.querySelector('button').click();
    await fixture.whenStable();
    const resource = sheet.resources![0];
    expect(resource.sourceId).toBe(sheet.character!.featureSources[0].editorId);
    resource.name = 'Sneak Attack';
    const mode = [...fixture.nativeElement.querySelectorAll('select')].find((select: any) => select.querySelector('option[value="note"]')) as HTMLSelectElement;
    mode.value = 'note'; mode.dispatchEvent(new Event('change')); await fixture.whenStable();
    resource.note = '3d6'; fixture.changeDetectorRef.markForCheck(); await fixture.whenStable();
    const view = TestBed.createComponent(SourceResourcesComponent);
    view.componentRef.setInput('sheet', sheet);
    view.componentRef.setInput('page', 'features');
    view.detectChanges();
    expect(view.nativeElement.textContent).toContain('3d6');
    expect(view.nativeElement.querySelector('input')).toBeNull();
    expect(view.nativeElement.querySelector('button')).toBeNull();
    view.destroy();
    sheet.features = [{ name: 'Strike', resourceLinks: [{ resourceId: resource.id, amount: 1 }] }];
    const remove = [...fixture.nativeElement.querySelectorAll('button')].find((button: any) => button.textContent.includes('Remove Reminder')) as HTMLButtonElement;
    remove.click(); await fixture.whenStable();
    expect(sheet.resources).toEqual([]);
    expect(sheet.features[0].resourceLinks).toEqual([]);
    fixture.destroy();
  });
  it('hides the add-link button when every counted resource is linked and restores it after unlinking', () => {
    const sheet = emptyBasicCharacter();
    sheet.resources = [
      { id: 'one', sourceId: 'source', name: 'One', mode: 'counter', total: 2, used: 0, note: '', recovery: 'NONE', features: true, spells: true },
      { id: 'two', sourceId: 'source', name: 'Two', mode: 'both', total: 3, used: 0, note: 'D6', recovery: 'NONE', features: true, spells: true },
      { id: 'note', sourceId: 'source', name: 'Reminder', mode: 'note', total: 0, used: 0, note: 'D8', recovery: 'NONE', features: true, spells: true },
    ];
    const entry = { resourceLinks: [{ resourceId: 'removed', amount: 2 }] };
    const fixture = TestBed.createComponent(ResourceLinksEditorComponent);
    fixture.componentRef.setInput('sheet', sheet); fixture.componentRef.setInput('entry', entry); fixture.detectChanges();
    const add = () => [...fixture.nativeElement.querySelectorAll('button')].find(button => (button as HTMLButtonElement).textContent?.includes('Link Resource')) as HTMLButtonElement | undefined;
    add()!.click(); fixture.detectChanges();
    expect(entry.resourceLinks.map(link => link.resourceId)).toEqual(['removed', 'one']);
    expect(add()).toBeDefined();
    add()!.click(); fixture.detectChanges();
    expect(entry.resourceLinks.map(link => link.resourceId)).toEqual(['removed', 'one', 'two']);
    expect(add()).toBeUndefined();
    fixture.componentInstance.add();
    expect(entry.resourceLinks).toHaveLength(3);
    (fixture.nativeElement.querySelectorAll('button[aria-label="Remove resource link"]')[1] as HTMLButtonElement).click(); fixture.detectChanges();
    expect(add()).toBeDefined();
    add()!.click(); fixture.detectChanges();
    expect(entry.resourceLinks.map(link => link.resourceId)).toEqual(['removed', 'two', 'one']);
    expect(add()).toBeUndefined();
    fixture.componentRef.setInput('sheet', { ...sheet, resources: [sheet.resources[2]] }); fixture.detectChanges();
    expect(add()).toBeUndefined();
    expect(fixture.nativeElement.textContent).toContain('Add a resource with uses');
    fixture.destroy();
  });
  it('links a specific cost and spends from the same pool, refusing further use when exhausted', () => {
    const sheet = emptyBasicCharacter();
    sheet.character!.featureSources = [{ editorId: 'source', name: 'Fighter' }];
    const editor = TestBed.createComponent(SourceResourcesEditorComponent);
    editor.componentRef.setInput('sheet', sheet);
    editor.componentInstance.add();
    const resource = sheet.resources![0];
    resource.total = 6;
    const entry = { resourceLinks: [] as import('../models/source-resources').ResourceCost[] };
    const links = TestBed.createComponent(ResourceLinksEditorComponent);
    links.componentRef.setInput('sheet', sheet);
    links.componentRef.setInput('entry', entry);
    links.componentInstance.add();
    links.componentInstance.cost(entry.resourceLinks[0], 4);
    const store = TestBed.inject(CharacterStore);
    store.setCharacter(sheet);
    const view = TestBed.createComponent(ResourceUseComponent);
    view.componentRef.setInput('sheet', sheet);
    view.componentRef.setInput('links', entry.resourceLinks);
    view.detectChanges();
    view.nativeElement.querySelector('button').click();
    view.detectChanges();
    expect(store.characterData()!.resources![0].used).toBe(4);
    expect(view.nativeElement.querySelector('button').disabled).toBe(true);
    view.componentInstance.use(entry.resourceLinks[0]);
    expect(store.characterData()!.resources![0].used).toBe(4);
    const other = emptyBasicCharacter(); store.setCharacter(other);
    expect(view.componentInstance.available(entry.resourceLinks[0])).toBe(false);
    view.componentInstance.use(entry.resourceLinks[0]);
    expect(store.characterData()).toBe(other);
    editor.destroy();
    links.destroy();
    view.destroy();
  });
});
