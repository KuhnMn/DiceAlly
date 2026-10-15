import { TestBed } from '@angular/core/testing';
import { CharacterInfoPageComponent } from './character-info-page.component';

describe('Character proficiency descriptions', () => {
  it('renders filter tags in conditional weapon proficiencies using the entry renderer', () => {
    const fixture = TestBed.createComponent(CharacterInfoPageComponent);
    fixture.componentRef.setInput('characterData', { character: { name: 'Rogue', proficiencies: {
      custom: ['Martial weapons that have the {@filter Finesse or Light|items|type=martial weapon|property=finesse;light} property'],
    } } });
    fixture.detectChanges();
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Finesse');
    expect(text).toContain('Light');
    expect(text).not.toContain('{@filter');
    expect(text).not.toContain('type=martial weapon');
  });
});
