import { Component, inject, input } from '@angular/core';
import { SpellEntity } from '../models/character.model';
import { CharacterHelpersService } from './character-helpers.service';
import { EntryRendererComponent } from '../entries/entry-renderer.component';
import { HorizontalRowDirective } from './horizontal-row.directive';

@Component({
  selector: 'app-spell-summary',
  host: { class: 'block w-full min-w-0 max-w-full' },
  imports: [EntryRendererComponent, HorizontalRowDirective],
  template: `
    @if (spell(); as value) {
      <div appHorizontalRow class="mt-1.5 grid gap-3 sm:mt-3 text-sm sm:grid-cols-2 lg:grid-cols-4 max-sm:items-center max-sm:gap-3 max-sm:[&>div+div]:border-l max-sm:[&>div+div]:border-outline-variant max-sm:[&>div+div]:pl-3" aria-label="Spell basic information">
        @if (value.time?.length) {
          <div><span class="sr-only sm:not-sr-only">Time: </span><app-entry-renderer class="inline-block" [entry]="{text: helpers.spellTimeLabel(value.time ?? [])}" [compact]="true" /></div>
        }
        @if (value.range) {
          <div><span class="sr-only sm:not-sr-only">Range: </span>{{ helpers.spellRangeLabel(value.range) }}</div>
        }
        @if (value.components) {
          <div><span class="sr-only sm:not-sr-only">Components: </span>{{ helpers.spellComponentsLabel(value.components) }}</div>
        }
        @if (value.duration?.length) {
          <div>
            <span class="hidden sm:inline">Duration: {{ helpers.spellDurationLabel(value.duration ?? []) }}</span>
            <span class="sm:hidden" [attr.aria-label]="'Duration: ' + helpers.spellDurationLabel(value.duration ?? [])">{{ helpers.compactSpellDurationLabel(value.duration ?? []) }}</span>
          </div>
        }
      </div>
    }
  `,
})
export class SpellSummaryComponent {
  readonly spell = input<Partial<SpellEntity> | null | undefined>();
  readonly helpers = inject(CharacterHelpersService);
}
