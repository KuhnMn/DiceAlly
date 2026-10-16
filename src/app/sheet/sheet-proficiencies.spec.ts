import { TestBed } from '@angular/core/testing';
import { proficiencyGroups } from './sheet-proficiencies.component';
import { MobileCharacterInfoPageComponent } from './mobile-character-info-page.component';

describe('Grouped sheet proficiencies', () => {
  it('groups armor under Other while separating languages, weapons and tools', () => {
    const groups = proficiencyGroups({ simpleWeapons: true, tools: { "Thieves’ Tools (XPHB)": 1 },
      languages: ['Common'], custom: ["Thieves' tools", 'Light', 'Medium', 'Shield', 'Common', 'Herbalism Kit', 'Special training'] });
    expect(groups).toEqual([
      { name: 'Weapons', entries: ['Simple Weapons'] },
      { name: 'Tools', entries: ['Thieves’ Tools (XPHB)', 'Herbalism Kit'] },
      { name: 'Languages', entries: ['Common'] },
      { name: 'Other', entries: ['Light', 'Medium', 'Shield', 'Special training'] },
    ]);
  });

  it('keeps the stored data intact while grouping tagged legacy entries', () => {
    const custom = ['{@item Light Armor|XPHB}', 'Unusual proficiency'];
    const proficiencies = { custom };
    expect(proficiencyGroups(proficiencies)[0].name).toBe('Other');
    expect(proficiencies.custom).toEqual(custom);
    expect(proficiencyGroups()).toEqual([]);
  });

  it('recognizes legacy custom languages and merges equivalent armor labels', () => {
    expect(proficiencyGroups({ custom: ['Light', 'Light armor', 'Shield', 'Shield armor', 'Common', 'Draconic', 'Gnomish'] })).toEqual([
      { name: 'Languages', entries: ['Common', 'Draconic', 'Gnomish'] },
      { name: 'Other', entries: ['Light', 'Shield'] },
    ]);
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
