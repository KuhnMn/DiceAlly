import { TestBed } from '@angular/core/testing';
import { mapContent } from '../content/content-adapter';
import { canonicalClassRecord } from '../content/class-adapter';
import { classProficiencies } from './class-proficiencies';
import { ClassProficienciesComponent } from './class-proficiencies.component';

function owner(data: Record<string, unknown> = {}) {
  return canonicalClassRecord(mapContent({ class: [{ name: 'Mage', source: 'XPHB', classFeatures: [], ...data }] }, 'class.json').records[0]);
}

describe('Class proficiency and multiclass reference information', () => {
  it('reads canonical proficiencies and preserves fixed grants, optional weapons and alternative choices', () => {
    const record = owner({ hd: { number: 1, faces: 6 }, primaryAbility: [{ int: true }, { wis: true, cha: true }], proficiency: ['int', 'wis'],
      startingProficiencies: {
        armor: [{ proficiency: 'light', full: 'Light armor while trained' }], weapons: ['simple', { proficiency: 'rapier|PHB', optional: true }],
        toolProficiencies: [{ choose: { from: ['anyArtisansTool', 'flute'], count: 1 } }],
        skills: [{ arcana: true, choose: { from: ['history', 'religion'], count: 1 } }, { any: 2 }],
      } });
    const before = structuredClone(record), info = classProficiencies(record);
    expect(record.data['startingProficiencies']).toBeUndefined();
    expect(info.proficiencies).toEqual([
      { label: 'Hit Die', entries: ['1d6'] },
      { label: 'Primary Ability', entries: ['Intelligence OR Wisdom AND Charisma'] },
      { label: 'Saving Throws', entries: ['Intelligence, Wisdom'] },
      { label: 'Armor', entries: ['Light armor while trained'] },
      { label: 'Weapons', entries: ['Simple Weapons, Rapier (Optional)'] },
      { label: 'Tools', entries: ["Choose 1: Any Artisan's Tools, Flute"] },
      { label: 'Skills', entries: ['(Arcana; Choose 1: History, Religion) OR (Choose 2: Any skills)'] },
    ]);
    expect(record).toEqual(before);
  });

  it('preserves cumulative and alternative multiclass requirements, special text, notes and the separate gained proficiencies', () => {
    const record = owner({ proficiency: ['int'], startingProficiencies: { weapons: ['martial'] },
      multiclassing: { requirements: { str: 13, or: [{ dex: 13 }, { int: 13 }], entries: ['Additional entry condition.'] },
        requirementsSpecial: 'Special training is required.', entries: ['Multiclass spell slot rules.'],
        proficienciesGained: { armorProficiencies: [{ light: true, shield: true }], weaponProficiencies: [{ simple: true }], skills: [{ choose: { from: ['arcana', 'history'], count: 1 } }] } } });
    const info = classProficiencies(record, true);
    expect(info.requirements[0].entries[0]).toBe('Strength 13+ AND (Dexterity 13+ OR Intelligence 13+)');
    expect(info.requirements[0].entries).toContain('Additional entry condition.');
    expect(info.requirements[1]).toEqual({ label: 'Special', entries: ['Special training is required.'] });
    expect(info.proficiencies).toEqual([
      { label: 'Armor', entries: ['Light Armor; Shields'] }, { label: 'Weapons', entries: ['Simple Weapons'] },
      { label: 'Skills', entries: ['Choose 1: Arcana, History'] },
    ]);
    expect(info.entries).toEqual(['Multiclass spell slot rules.']);
    expect(info.proficiencies.some(row => row.label === 'Saving Throws')).toBe(false);
    const fixture = TestBed.createComponent(ClassProficienciesComponent);
    fixture.componentRef.setInput('owner', record); fixture.componentRef.setInput('multiclass', true); fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Proficiencies Gained');
    expect(fixture.nativeElement.textContent).toContain('Multiclass spell slot rules.');
  });

  it('does not invent missing proficiency grants or multiclass thresholds', () => {
    const record = owner();
    expect(classProficiencies(record, true)).toEqual({ requirements: [], proficiencies: [], entries: [] });
    const fixture = TestBed.createComponent(ClassProficienciesComponent);
    fixture.componentRef.setInput('owner', record); fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('section')).toBeNull();
  });
});
