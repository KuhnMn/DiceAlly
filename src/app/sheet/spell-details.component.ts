import { Component, inject, input } from '@angular/core';
import { SpellEntity } from '../models/character.model';
import { CharacterHelpersService } from './character-helpers.service';
import { EntryRendererComponent } from '../entries/entry-renderer.component';

/** Reference information wraps freely in the detail dialog, including material components. */
@Component({
  selector: 'app-spell-details',
  imports: [EntryRendererComponent],
  template: `
    @if (spell(); as value) {
      <dl class="grid gap-3 rounded-lg bg-surface-container p-3 text-sm sm:grid-cols-2">
        @if (value.time?.length) { <div><dt class="font-semibold text-on-surface-variant">Casting Time</dt><dd><app-entry-renderer [entry]="{text: helpers.spellTimeLabel(value.time ?? [])}" [compact]="true" /></dd></div> }
        @if (value.range) { <div><dt class="font-semibold text-on-surface-variant">Range</dt><dd>{{ helpers.spellRangeLabel(value.range) }}</dd></div> }
        @if (value.components) { <div><dt class="font-semibold text-on-surface-variant">Components</dt><dd>{{ helpers.spellComponentsLabel(value.components) }}</dd></div> }
        @if (value.duration?.length) { <div><dt class="font-semibold text-on-surface-variant">Duration</dt><dd>{{ helpers.spellDurationLabel(value.duration ?? []) }}</dd></div> }
        @if (value.meta?.ritual) { <div><dt class="font-semibold text-on-surface-variant">Ritual</dt><dd>Can be cast as a ritual</dd></div> }
      </dl>
    }
  `,
})
export class SpellDetailsComponent {
  readonly spell = input<Partial<SpellEntity> | null | undefined>();
  readonly helpers = inject(CharacterHelpersService);
}
