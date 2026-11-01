import { TestBed } from '@angular/core/testing';
import { CharacterInfoPageComponent } from './character-info-page.component';

describe('Character proficiency descriptions', () => {
  it.each([
    'Martial weapons that have the {@filter Finesse or Light|items|type=martial weapon|property=finesse;light} property',
    'All weapons matching type=martial weapon|property=light;finesse',
  ])('renders conditional weapon proficiency descriptions readably: %s', (description) => {
    const fixture = TestBed.createComponent(CharacterInfoPageComponent);
    fixture.componentRef.setInput('characterData', { character: { name: 'Rogue', proficiencies: {
      custom: [description],
    } } });
    fixture.detectChanges();
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Finesse');
    expect(text).toContain('Light');
    expect(text).not.toContain('{@filter');
    expect(text).not.toContain('type=martial weapon');
  });
});
