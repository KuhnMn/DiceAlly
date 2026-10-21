import { TestBed } from '@angular/core/testing';
import { EquipmentDetailsComponent } from './equipment-details.component';
import { prepareEquipmentDetails } from './equipment-presentation';
import { DisplayItem } from '../models/character.model';

describe('Equipment reference details', () => {
  it('renders attunement, item-specific notes, and attached spell descriptions without adding casting controls', () => {
    const entity: DisplayItem = { item: { name: 'Wand', source: 'TEST', reqAttune: 'by a {@class Wizard|XPHB}', entries: ['Item description'] },
      properties: [{ name: 'Thrown', notes: ['Only while {@condition Invisible|XPHB}'], entry: 'General thrown rule' }],
      masteries: [{ name: 'Push', notes: ['Only with both hands'], entry: 'General push rule' }],
      attachedSpells: [{ name: 'Light', source: 'XPHB', usageNotes: ['2 charges'], spell: {
        name: 'Light', source: 'XPHB', level: 0, school: 'V', time: [{ number: 1, unit: 'action' }], range: { type: 'point', distance: { type: 'touch' } },
        components: { v: true }, duration: [{ type: 'instant' }], entries: ['Spell description'],
        entriesHigherLevel: [{ type: 'entries', entries: ['Stronger light'] }],
      } }], spellcastingAbilityDescription: 'Intelligence' };
    const before = JSON.stringify(entity);
    const fixture = TestBed.createComponent(EquipmentDetailsComponent); fixture.componentRef.setInput('entity', entity); fixture.detectChanges();
    const text = fixture.nativeElement.textContent as string;
    for (const value of ['Attunement Requirement', 'Wizard', 'Only while Invisible', 'Only with both hands', 'General thrown rule', 'General push rule', '2 charges', 'Spell description', 'Stronger light', 'Intelligence']) expect(text).toContain(value);
    expect(text).not.toContain('{@');
    const summaries = fixture.nativeElement.querySelectorAll('app-rule-details summary');
    expect(summaries[0].textContent).toContain('Only while Invisible');
    expect(fixture.nativeElement.querySelector('button')).toBeNull();
    expect(JSON.stringify(entity)).toBe(before);
  });

  it('handles generic and absent attunement without claiming eligibility', () => {
    expect(prepareEquipmentDetails({ item: { name: 'Ring', source: 'TEST', reqAttune: 'by anyone' } }).attunementRequirementText).toBe('Required');
    expect(prepareEquipmentDetails({ item: { name: 'Ring', source: 'TEST', reqAttune: null } }).attunementRequirementText).toBeUndefined();
  });
});
