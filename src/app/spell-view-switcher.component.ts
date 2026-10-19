import { Component, computed, input, model } from '@angular/core';
import { SpellList, spellListLabel } from './editor/spell-selection';
import { UiIconComponent } from './ui-icon.component';

/** Spell membership is a view; switching never changes preparation or filters. */
@Component({
  selector: 'app-spell-view-switcher',
  imports: [UiIconComponent],
  host: { class: 'mb-2 flex min-w-0 flex-wrap items-center gap-2' },
  template: `
    @if (view() !== 'PREPARED') {
      <button type="button" (click)="view.set('PREPARED')" aria-label="View prepared spells" title="View prepared spells"
        class="flex h-10 w-9 shrink-0 items-center justify-center rounded-lg border border-outline-variant text-on-surface-variant hover:bg-surface-container focus-visible:outline-2 focus-visible:outline-primary"><app-ui-icon name="left" /></button>
    }
    <h3 class="min-w-0 flex-1 text-lg font-bold [overflow-wrap:anywhere]" [class.text-teal]="view() === 'KNOWN'" [class.text-purple]="view() === 'SPELLBOOK'">{{ heading() }}</h3>
    <div role="group" aria-label="Spell views" class="flex shrink-0 gap-1">
      <button type="button" aria-label="Spelllist view" [attr.aria-pressed]="view() === 'KNOWN'" title="Spelllist — prepare spells"
        (click)="toggleView('KNOWN')" [class.bg-teal]="view() === 'KNOWN'" [class.text-on-teal]="view() === 'KNOWN'" [class.bg-surface-container]="view() !== 'KNOWN'" [class.text-teal]="view() !== 'KNOWN'"
        class="flex h-10 w-10 items-center justify-center rounded-lg border-2 border-teal text-2xl hover:brightness-110 focus-visible:outline-2 focus-visible:outline-primary"><app-ui-icon name="list" /></button>
      @if (showSpellbook()) {
        <button type="button" aria-label="Spellbook view" [attr.aria-pressed]="view() === 'SPELLBOOK'" title="Spellbook — prepare spells"
          (click)="toggleView('SPELLBOOK')" [class.bg-purple]="view() === 'SPELLBOOK'" [class.text-on-purple]="view() === 'SPELLBOOK'" [class.bg-surface-container]="view() !== 'SPELLBOOK'" [class.text-purple]="view() !== 'SPELLBOOK'"
          class="flex h-10 w-10 items-center justify-center rounded-lg border-2 border-purple text-2xl hover:brightness-110 focus-visible:outline-2 focus-visible:outline-primary"><app-ui-icon name="book" /></button>
      }
    </div>
  `,
})
export class SpellViewSwitcherComponent {
  readonly view = model<SpellList>('PREPARED');
  readonly showSpellbook = input(false);
  readonly preparedHeading = input('Prepared Spells');
  readonly heading = computed(() => this.view() === 'PREPARED' ? this.preparedHeading() : spellListLabel(this.view()));
  toggleView(view: SpellList) { this.view.set(this.view() === view ? 'PREPARED' : view); }
}
