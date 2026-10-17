import { TestBed } from '@angular/core/testing';
import { proficiencyGroups } from './sheet-proficiencies.component';
import { MobileCharacterInfoPageComponent } from './mobile-character-info-page.component';

describe('Grouped sheet proficiencies', () => {
  it('uses stored categories even when custom entries resemble languages, tools or weapons', () => {
    const custom = ['Common', "Thieves' tools", 'Herbalism Kit', 'Martial Weapons', 'Special training'];
    expect(proficiencyGroups({ simpleWeapons: true, martialWeapons: true,
      tools: { "Thieves' tools": 1 }, languages: ['Common'], custom })).toEqual([
      { name: 'Weapons', entries: ['Simple Weapons', 'Martial Weapons'] },
      { name: 'Tools', entries: ["Thieves' tools"] },
      { name: 'Languages', entries: ['Common'] },
      { name: 'Other', entries: custom },
    ]);
  });

  it('preserves custom labels, duplicates and tagged entries without changing stored data', () => {
    const custom = ['Light', 'Light armor', 'Shield', 'Shield armor', 'Common', 'Common', '{@item Light Armor|XPHB}'];
    const original = [...custom];
    expect(proficiencyGroups({ custom })).toEqual([{ name: 'Other', entries: original }]);
    expect(custom).toEqual(original);
    expect(proficiencyGroups()).toEqual([]);
  });

  it('starts expanded on mobile and can be collapsed by pressing the heading', () => {
    const fixture = TestBed.createComponent(MobileCharacterInfoPageComponent);
    fixture.componentRef.setInput('characterData', { character: { proficiencies: { languages: ['Common', 'Draconic'] } } });
    fixture.detectChanges();
    const content = fixture.nativeElement.querySelector('app-sheet-proficiencies');
    const details = content.closest('details') as HTMLDetailsElement;
    expect(details.open).toBe(true);
    expect(content.querySelectorAll('section').length).toBe(1);
    expect(content.textContent).toContain('Languages');
    details.querySelector('summary')!.click();
    expect(details.open).toBe(false);
  });

  it('also starts General Stats expanded and lets its heading collapse the section', () => {
    const fixture = TestBed.createComponent(MobileCharacterInfoPageComponent);
    fixture.componentRef.setInput('characterData', { character: { speeds: { walk: 30 } } });
    fixture.detectChanges();
    const details = fixture.nativeElement.querySelector('details[aria-label="General Stats"]') as HTMLDetailsElement;
    expect(details.open).toBe(true);
    expect(details.textContent).toContain('Walk: 30 ft.');
    details.querySelector('summary')!.click();
    expect(details.open).toBe(false);
  });
});
