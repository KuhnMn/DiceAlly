import { TestBed } from '@angular/core/testing';
import { MonsterStatBlockComponent } from './monster-stat-block.component';
import { MonsterPresentation } from './monster-presentation';
import { MonsterEntity } from '../models/character.model';

describe('Shared monster stat block', () => {
  it('links standard sense help while preserving ranges, qualifiers and custom senses', () => {
    const fixture = TestBed.createComponent(MonsterStatBlockComponent);
    const senses = ['darkvision 120 ft. (through magical darkness)', 'Blindsight 10 ft. (blind beyond this radius)', 'Tremorsense 60 ft.', 'Custom Sense 30 ft.'];
    fixture.componentRef.setInput('value', { name: 'Test monster', hpEnabled: false, entity: { name: 'Test monster', senses } });
    fixture.componentRef.setInput('senseDescriptions', ['Darkvision', 'Blindsight', 'Tremorsense'].map(name => ({ name, source: 'XPHB', entries: [`${name} reference description`] })));
    fixture.detectChanges();
    for (const text of senses) expect(fixture.nativeElement.textContent).toContain(text);
    expect(fixture.nativeElement.querySelector('button[aria-label="About Custom Sense"]')).toBeNull();
    expect(fixture.componentInstance.senseDescription('Darkvisionary perception')).toBeUndefined();
    fixture.nativeElement.querySelector('button[aria-label="About Blindsight"]').click(); fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('dialog').textContent).toContain('Blindsight reference description');
    expect(fixture.componentInstance.value().entity?.senses).toEqual(senses);
  });

  it('renders descriptive AC, named abilities and additional action sections instead of object JSON', async () => {
    TestBed.configureTestingModule({ imports: [MonsterStatBlockComponent] });
    const fixture = TestBed.createComponent(MonsterStatBlockComponent);
    const entity = { name: 'Beast of the Land', ac: [{ special: '13 plus your Wisdom modifier' }],
      hp: { special: '5 plus five times your Ranger level' }, str: 14, dex: 14, senses: ['Darkvision 60 ft.'],
      immune: ['poison'], trait: [{ name: 'Primal Bond', entries: ['Add your Proficiency Bonus to ability checks.'] }],
      action: [{ name: "Beast's Strike", entries: ['**Melee Attack Roll:** **Bonus Equals Your Spell Attack Modifier**, reach 5 ft.'] }],
      bonus: [{ name: 'Dash', entries: ['The beast dashes.'] }], reaction: [{ name: 'Protect', entries: ['Protect an ally.'] }],
      legendary: [{ name: 'Move', entries: ['Move again.'] }], mythic: [{ name: 'Roar', entries: ['Roar loudly.'] }],
    } as unknown as MonsterEntity;
    fixture.componentRef.setInput('value', { name: entity.name, hpEnabled: false, entity });
    fixture.componentRef.setInput('compact', true); await fixture.whenStable();
    const text = fixture.nativeElement.textContent as string;
    for (const expected of ['13 plus your Wisdom modifier', '5 plus five times', 'Primal Bond', "Beast's Strike", 'Bonus Actions', 'Reactions', 'Legendary Actions', 'Mythic Actions', 'Poison']) expect(text).toContain(expected);
    expect(text).not.toContain('"entries"'); expect(text).not.toContain('**');
    expect([...fixture.nativeElement.querySelectorAll('.font-bold')].some((element: any) => element.textContent === 'Melee Attack Roll:')).toBe(true);
  });
  it('formats numeric, special and alternative AC without discarding conditions', () => {
    const presentation = new MonsterPresentation();
    expect(presentation.formatArmorClass(12)).toBe('12');
    expect(presentation.formatArmorClass({ special: '13 plus your Wisdom modifier' })).toBe('13 plus your Wisdom modifier');
    expect(presentation.formatArmorClass({ ac: 16, from: ['natural armor'], condition: 'while transformed' })).toBe('16 (natural armor) while transformed');
  });
});
