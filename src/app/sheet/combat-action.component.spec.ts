import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { CombatAction, ExportedCharacter } from '../models/character.model';
import { emptyBasicCharacter } from '../editor/basic-info';
import { CombatActionComponent } from './combat-action.component';
import { CharacterInfoPageComponent } from './character-info-page.component';
import { SpellsPageComponent } from './spells-page.component';
import { FeaturesPageComponent } from './features-page.component';
import { EquipmentPageComponent } from './equipment-page.component';
import { MonstersPageComponent } from './monsters-page.component';
import { CharacterStore } from '../stores/character.store';
import { MobileCombatPageComponent } from './mobile-combat-page.component';

function sheetWithSpell(): ExportedCharacter {
  const sheet = emptyBasicCharacter();
  sheet.spells = [{ editorId: 'flame', name: 'Flame', source: 'TEST', listType: 'PREPARED', entity: { name: 'Flame', source: 'TEST', level: 1, school: 'V',
    time: [{ number: 1, unit: 'action' }], range: { type: 'point', distance: { type: 'feet', amount: 60 } }, components: { v: true },
    duration: [{ type: 'instant' }], entries: [{ text: 'The full flame description.' }], entriesHigherLevel: [{ text: 'More flame at higher levels.' }] } }];
  sheet.combatActions = [{ name: 'Fire Attack', actionType: 'ACTION', damageOrHeal: '2d6 fire', linkedResourceType: 'SPELL', linkedResource: { editorId: 'flame' } }];
  return sheet;
}
function setup(action: CombatAction, sheet = emptyBasicCharacter()) {
  const fixture = TestBed.createComponent(CombatActionComponent);
  fixture.componentRef.setInput('sheet', sheet); fixture.componentRef.setInput('action', action); fixture.detectChanges();
  fixture.nativeElement.querySelector('button').click(); fixture.detectChanges();
  return fixture;
}

function dialogStructure(root: HTMLElement) {
  const dialog = root.querySelector('dialog')!.cloneNode(true) as HTMLElement;
  dialog.querySelectorAll('button[aria-label^="Go to source for"]').forEach(button => button.remove());
  return [...dialog.querySelectorAll('*')].map(element => ({ tag: element.tagName, classes: element.className,
    text: element.children.length ? '' : element.textContent?.replace(/\s+/g, ' ').trim() }));
}

describe('Combat action descriptions', () => {
  it.each([CharacterInfoPageComponent, MobileCombatPageComponent])('reads linked descriptions in place and navigates only from an arrow in %s', component => {
    const fixture = TestBed.createComponent(component), sheet = sheetWithSpell(), before = structuredClone(sheet);
    fixture.componentRef.setInput('characterData', sheet); fixture.detectChanges();
    const navigated = vi.fn(); fixture.componentInstance.navigateToFeatures.subscribe(navigated);
    const row = fixture.nativeElement.querySelector('app-combat-action') as HTMLElement;
    row.querySelector<HTMLButtonElement>('button[aria-haspopup="dialog"]')!.click(); fixture.detectChanges();
    const dialog = row.querySelector('dialog')!;
    expect(dialog.textContent).toContain('The full flame description.'); expect(dialog.textContent).toContain('More flame at higher levels.');
    expect(navigated).not.toHaveBeenCalled();
    dialog.dispatchEvent(new Event('close')); fixture.detectChanges();
    row.querySelector<HTMLButtonElement>('button[title="Go to source"]')!.click(); fixture.detectChanges();
    expect(navigated).toHaveBeenCalledExactlyOnceWith('spell-flame');
    expect(row.querySelector('dialog')).toBeNull(); expect(sheet).toEqual(before);
    fixture.destroy();
  });

  it('reuses the spell dialog with source tags, uses and notes, without consuming a tab navigation target', () => {
    const sheet = sheetWithSpell();
    sheet.spells![0].uses = [{ totalFreeUses: 3, usedFreeUses: 1 }];
    sheet.spells![0].notes = [{ notes: ['Spell note.'], isEditable: true }];
    const store = TestBed.inject(CharacterStore);
    store.setFeatureScrollTarget('spell-unrelated');
    const fixture = setup(sheet.combatActions![0], sheet);
    expect(store.featureScrollTarget()).toBe('spell-unrelated');
    store.setFeatureScrollTarget(null);
    const source = TestBed.createComponent(SpellsPageComponent);
    source.componentRef.setInput('characterData', sheet); source.detectChanges();
    source.componentInstance.toggleExpanded(source.componentInstance.spellExpansionId(sheet.spells![0])); source.detectChanges();
    expect(dialogStructure(fixture.nativeElement)).toEqual(dialogStructure(source.nativeElement));
    expect(fixture.nativeElement.querySelector('dialog').textContent).toContain('Spell note.');
    expect(fixture.nativeElement.querySelector('[aria-label="Combat action details"]')).toBeNull();
    source.destroy(); fixture.destroy();
  });

  it('opens custom actions and shows every saved field without clipping or navigation', () => {
    const effect = 'Detailed effect. '.repeat(40) + 'Final effect instruction.';
    const fixture = setup({ name: 'Custom Maneuver', actionType: 'BONUS', range: '15 ft.', hitOrDc: 'DC 15 Strength', damageOrHeal: effect });
    const text = fixture.nativeElement.querySelector('dialog').textContent;
    expect(text).toContain('Custom Maneuver'); expect(text).toContain('Bonus Action'); expect(text).toContain('15 ft.');
    expect(text).toContain('DC 15 Strength'); expect(text).toContain('Final effect instruction.');
    expect(fixture.nativeElement.querySelector('button[title="Go to source"]')).toBeNull();
    fixture.destroy();
  });

  it('keeps missing links readable and explains why their source cannot be opened', () => {
    const fixture = setup({ name: 'Deleted Source', damageOrHeal: 'Saved effect', linkedResourceType: 'ITEM', linkedResource: { editorId: 'gone' } });
    expect(fixture.nativeElement.querySelector('dialog').textContent).toContain('Saved effect');
    expect(fixture.nativeElement.querySelector('dialog').textContent).toContain('no longer on this character');
    fixture.destroy();
  });

  it.each(['CLASS_FEATURE', 'FEAT', 'OPTIONAL_FEATURE', 'SPECIES', 'ITEM'] as const)('reads the linked %s description through the existing entry renderer', type => {
    const sheet = emptyBasicCharacter();
    const resource = { editorId: 'source', name: 'Source', source: 'TEST' };
    const entries = [{ text: `Description for ${type}.` }];
    if (type === 'CLASS_FEATURE') sheet.features = [{ ...resource, featureEntity: { name: 'Source', source: 'TEST', level: 1, className: 'Fighter', classSource: 'TEST', entries } }];
    if (type === 'FEAT') sheet.features = [{ ...resource, featEntity: { name: 'Source', source: 'TEST', entries, prerequisite: [{ level: 4 }] } }];
    if (type === 'OPTIONAL_FEATURE') sheet.features = [{ ...resource, optionalFeatureEntity: { name: 'Source', source: 'TEST', entries, featureType: ['EI'] } }];
    if (type === 'SPECIES') sheet.species = { ...resource, entity: { name: 'Source', source: 'TEST', entries } };
    if (type === 'ITEM') sheet.inventory = [{ ...resource, entity: { item: { name: resource.name, source: resource.source, entries } } }];
    const fixture = setup({ name: 'Linked Action', linkedResourceType: type, linkedResource: { editorId: resource.editorId } }, sheet);
    expect(fixture.nativeElement.querySelector('dialog').textContent).toContain(`Description for ${type}.`);
    if (type === 'FEAT') expect(fixture.nativeElement.querySelector('dialog').textContent).toContain('Level 4+');
    const source = type === 'ITEM' ? TestBed.createComponent(EquipmentPageComponent) : TestBed.createComponent(FeaturesPageComponent);
    source.componentRef.setInput('characterData', sheet); source.detectChanges();
    if (source.componentInstance instanceof EquipmentPageComponent) source.componentInstance.toggleExpanded(source.componentInstance.itemKey(sheet.inventory![0]));
    else {
      source.componentInstance.setFeatureView(type === 'FEAT' ? 'FEAT' : type === 'OPTIONAL_FEATURE' ? 'OPTIONAL_FEATURE' : 'CLASS_FEATURE');
      source.componentInstance.toggleExpanded(type === 'SPECIES' ? 'species' : source.componentInstance.featureAnchorId(sheet.features![0])!);
    }
    source.detectChanges();
    expect(dialogStructure(fixture.nativeElement)).toEqual(dialogStructure(source.nativeElement));
    expect(fixture.nativeElement.querySelector('[aria-label="Combat action details"]')).toBeNull();
    source.destroy();
    fixture.destroy();
  });

  it('opens the full companion dialog, including its other abilities, just like the source page', () => {
    const sheet = emptyBasicCharacter();
    sheet.monsters = [{ editorId: 'wolf', name: 'Wolf', entity: { name: 'Wolf', action: [
      { name: 'Growl', entries: [{ text: 'Growl description.' }] }, { name: 'Bite', entries: [{ text: 'Bite description.' }] },
    ] } }];
    const action = { name: 'Wolf Bite', linkedResourceType: 'MONSTER', linkedResource: { editorId: 'wolf' }, sourceOption: 0, sourceOptionName: 'Bite' };
    const fixture = setup(action, sheet);
    const source = TestBed.createComponent(MonstersPageComponent);
    source.componentRef.setInput('characterData', sheet); source.detectChanges();
    source.componentInstance.toggleExpanded(source.componentInstance.monsterKey(sheet.monsters![0])); source.detectChanges();
    expect(dialogStructure(fixture.nativeElement)).toEqual(dialogStructure(source.nativeElement)); source.destroy();
    expect(fixture.nativeElement.querySelector('dialog').textContent).toContain('Bite description.');
    expect(fixture.nativeElement.querySelector('dialog').textContent).toContain('Growl description.');
    fixture.componentRef.setInput('action', { ...action, sourceOptionName: 'Deleted Ability' }); fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('dialog').textContent).toContain('Bite description.');
    expect(fixture.nativeElement.querySelector('dialog').textContent).toContain('Growl description.');
    fixture.destroy();
  });

  it('opens the complete object dialog without navigating', () => {
    const sheet = emptyBasicCharacter();
    sheet.objects = [{ editorId: 'ballista', kind: 'object', name: 'Ballista', hitPoints: { enabled: false },
      entity: { version: 1, name: 'Ballista', source: 'TEST', objectType: 'SW', size: ['L'], hp: 50, entries: [], actionEntries: [
        { type: 'entries', name: 'Bolt', entries: ['Bolt description.'] },
        { type: 'entries', name: 'Load', entries: ['Load description.'] },
      ] } }];
    const fixture = setup({ name: 'Ballista Bolt', linkedResourceType: 'OBJECT', linkedResource: { editorId: 'ballista' }, sourceOption: 0, sourceOptionName: 'Bolt' }, sheet);
    expect(fixture.nativeElement.querySelector('dialog').textContent).toContain('Bolt description.');
    expect(fixture.nativeElement.querySelector('dialog').textContent).toContain('Load description.');
    fixture.destroy();
  });
});
