import { Component, input } from '@angular/core';
import { ExportedCharacter } from '../models/character.model';

@Component({
  selector: 'app-mobile-character-header',
  host: { class: 'block sm:hidden' },
  template: `
    @if (characterData()?.character; as c) {
      <section aria-label="Character Name">
        <h1 class="text-lg font-semibold leading-tight [overflow-wrap:anywhere]">{{ c.name || 'Unnamed Character' }}</h1>
      </section>
    }
  `,
})
export class MobileCharacterHeaderComponent {
  readonly characterData = input.required<ExportedCharacter | null>();
}
