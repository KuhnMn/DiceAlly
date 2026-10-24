import { Component, DestroyRef, ElementRef, afterEveryRender, afterNextRender, inject, input } from '@angular/core';
import { SpellEntity } from '../models/character.model';
import { CharacterHelpersService } from './character-helpers.service';
import { EntryRendererComponent } from '../entries/entry-renderer.component';
import { HorizontalRowDirective } from './horizontal-row.directive';

@Component({
  selector: 'app-spell-summary',
  host: { class: 'block w-full min-w-0 max-w-full' },
  imports: [EntryRendererComponent, HorizontalRowDirective],
  styles: [`
    .summary-field { display: flex; align-items: baseline; gap: .25rem; min-width: 0; }
    .summary-field > span:first-child { flex-shrink: 0; white-space: nowrap; }
    .summary-value { position: relative; min-width: 0; display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; overflow: hidden; overflow-wrap: anywhere; white-space: normal; }
    .summary-value.is-truncated::after { content: '...'; position: absolute; right: 0; bottom: 0; padding-left: .15em; background: var(--md-sys-color-surface-container); color: var(--md-sys-color-on-surface); font-weight: 900; letter-spacing: .04em; pointer-events: none; }
    @media (max-width: 1279px) {
      .summary-row { display: flex; flex-wrap: nowrap; width: 100%; align-items: center; overflow-x: auto; overscroll-behavior-x: contain; padding-bottom: .25rem; }
      .summary-field { flex-shrink: 0; max-width: 12rem; white-space: nowrap; }
      .summary-field + .summary-field { border-left: 1px solid var(--md-sys-color-outline-variant); padding-left: .75rem; }
      .summary-value { -webkit-line-clamp: 1; }
    }
  `],
  template: `
    @if (spell(); as value) {
      <div appHorizontalRow class="summary-row mt-1.5 grid gap-3 xl:mt-3 text-sm xl:grid-cols-4" aria-label="Spell basic information">
        @if (value.time?.length) {
          <div class="summary-field"><span class="sr-only xl:not-sr-only">Time: </span><div class="summary-value"><app-entry-renderer class="block" [entry]="{text: helpers.spellTimeLabel(value.time ?? [])}" [compact]="true" /></div></div>
        }
        @if (value.range) {
          <div class="summary-field"><span class="sr-only xl:not-sr-only">Range: </span><span class="summary-value" [title]="helpers.spellRangeLabel(value.range)">{{ helpers.spellRangeLabel(value.range) }}</span></div>
        }
        @if (value.components) {
          <div class="summary-field"><span class="sr-only xl:not-sr-only">Components: </span><div class="summary-value"><app-entry-renderer class="block" [entry]="{text: helpers.spellComponentsLabel(value.components)}" [compact]="true" /></div></div>
        }
        @if (value.duration?.length) {
          <div class="summary-field">
            <span class="sr-only xl:not-sr-only">Duration: </span>
            <div class="hidden min-w-0 xl:block"><div class="summary-value"><app-entry-renderer class="block" [entry]="{text: helpers.spellDurationLabel(value.duration ?? [])}" [compact]="true" /></div></div>
            <div class="min-w-0 xl:hidden"><div class="summary-value"><app-entry-renderer class="block" [entry]="{text: helpers.compactSpellDurationLabel(value.duration ?? [])}" [compact]="true" /></div></div>
          </div>
        }
      </div>
    }
  `,
})
export class SpellSummaryComponent {
  readonly spell = input<Partial<SpellEntity> | null | undefined>();
  readonly helpers = inject(CharacterHelpersService);
  private readonly element = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly destroyRef = inject(DestroyRef);

  constructor() {
    afterEveryRender(() => this.markTruncatedValues());
    afterNextRender(() => {
      const observer = new ResizeObserver(() => this.markTruncatedValues());
      observer.observe(this.element.nativeElement);
      this.destroyRef.onDestroy(() => observer.disconnect());
    });
  }

  private markTruncatedValues() {
    for (const value of this.element.nativeElement.querySelectorAll<HTMLElement>('.summary-value')) {
      const truncated = value.clientHeight > 0 &&
        (value.scrollHeight > value.clientHeight + 1 || value.scrollWidth > value.clientWidth + 1);
      value.classList.toggle('is-truncated', truncated);
      value.title = value.textContent?.trim() ?? '';
    }
  }
}
