import { TestBed } from '@angular/core/testing';
import { CharacterHelpersService } from './character-helpers.service';
import { EntryRendererComponent } from '../entries/entry-renderer.component';

describe('Spell casting times', () => {
  it('renders bonus actions and tagged casting conditions as readable text', async () => {
    const helpers = new CharacterHelpersService();
    const label = helpers.spellTimeLabel([{
      number: 1,
      unit: 'bonus',
      condition: 'which you take immediately after hitting a target with a Melee weapon or an {@variantrule Unarmed Strike|XPHB}',
    }]);
    const fixture = TestBed.createComponent(EntryRendererComponent);
    fixture.componentRef.setInput('entry', { text: `Time: ${label}` });
    await fixture.whenStable();
    expect(fixture.nativeElement.textContent.trim()).toBe(
      'Time: 1 bonus action, which you take immediately after hitting a target with a Melee weapon or an Unarmed Strike',
    );
  });

  it('preserves reaction conditions and alternative casting times', () => {
    const helpers = new CharacterHelpersService();
    expect(helpers.spellTimeLabel([
      { number: 1, unit: 'reaction', condition: 'when you are hit' },
      { number: 1, unit: 'action' },
    ])).toBe('1 reaction, when you are hit or 1 action');
  });
});
