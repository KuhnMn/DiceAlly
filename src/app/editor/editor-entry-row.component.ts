import { Component, inject, input, output } from '@angular/core';
import { EditorCombatIndex } from './editor-combat-index';
import { UiIconComponent } from '../ui-icon.component';
import { ExportedCharacter } from '../models/character.model';
import { CombatResource, combatLinksForResource } from './combat-actions';

/** Compact management row; its independent actions never toggle the editor. */
@Component({
  selector: 'app-editor-entry-row',
  imports: [UiIconComponent],
  host: { class: 'block min-w-0 border-b border-outline-variant last:border-b-0' },
  template: `
    <div class="relative flex min-w-0 items-stretch gap-1 px-2 py-1.5">
      <div class="min-w-0 flex-1">
        <div class="flex min-w-0 items-center gap-1.5">
          <p class="min-w-0 truncate text-sm font-semibold leading-6" [title]="name()">{{ name() }}</p>
          <span class="relative z-10 inline-flex shrink-0 items-center gap-1.5 text-[11px] text-on-surface-variant" (click)="detailsRequested.emit()">
            @if (usesCount()) { <span role="img" [attr.aria-label]="usesCount() + ' use trackers'" [title]="usesCount() + ' use trackers'" class="inline-flex items-center gap-0.5"><app-ui-icon name="tally" />{{ usesCount() }}</span> }
            @if (notesCount()) { <span role="img" [attr.aria-label]="notesCount() + ' note groups'" [title]="notesCount() + ' note groups'" class="inline-flex items-center gap-0.5"><app-ui-icon name="file" />{{ notesCount() }}</span> }
            @if (combatCount()) { <span role="img" [attr.aria-label]="combatCount() + ' Combat entries'" [title]="combatCount() + ' Combat entries'" class="inline-flex items-center gap-0.5 text-primary"><app-ui-icon name="swords" />{{ combatCount() }}</span> }
          </span>
        </div>
        <div class="flex min-w-0 items-center gap-1 text-[11px] leading-4">
          <ng-content select="[entry-metadata]" />
        </div>
      </div>
      <button type="button" class="details-trigger flex w-7 shrink-0 items-center justify-center rounded text-base text-primary"
        [attr.aria-label]="(expanded() ? 'Close editor for ' : 'Edit ') + name()" [title]="expanded() ? 'Close editor' : 'Edit details'" [attr.aria-expanded]="expanded()" [attr.aria-controls]="detailsId" (click)="detailsRequested.emit()">
        <app-ui-icon [name]="expanded() ? 'chevron-down' : 'chevron'" />
      </button>
      <div class="relative z-10 flex shrink-0 items-stretch gap-1"><ng-content select="[entry-actions]" /></div>
      @if (showRemove()) {
        <button type="button" class="relative z-10 flex w-7 shrink-0 items-center justify-center rounded text-on-surface-variant hover:bg-surface-container-high disabled:opacity-50"
          [disabled]="removalDisabled()" [attr.aria-label]="'Remove ' + name()" [title]="removalTitle() || 'Remove ' + name()" (click)="removeRequested.emit()"><app-ui-icon name="close" /></button>
      }
    </div>
    @if (expanded()) { <div [id]="detailsId" class="border-t border-outline-variant p-3 space-y-3"><ng-content /></div> }
  `,
  styles: [`
    .details-trigger::after { content: ''; position: absolute; inset: 0; border-radius: .375rem; cursor: pointer; }
    .details-trigger:hover::after { background: color-mix(in srgb, var(--md-sys-color-on-surface) 4%, transparent); }
    .details-trigger:focus-visible::after { outline: 2px solid var(--md-sys-color-primary); outline-offset: -2px; }
  `],
})
export class EditorEntryRowComponent {
  readonly name = input.required<string>();
  readonly expanded = input(false);
  readonly notesCount = input(0);
  readonly usesCount = input(0);
  readonly sheet = input<ExportedCharacter>();
  readonly resource = input<CombatResource>();
  private readonly combatIndex = inject(EditorCombatIndex, { optional: true });
  combatCount() {
    const sheet = this.sheet(), resource = this.resource();
    return sheet && resource ? this.combatIndex ? this.combatIndex.count(sheet, resource) : combatLinksForResource(sheet, resource).length : 0;
  }
  readonly showRemove = input(true);
  readonly removalDisabled = input(false);
  readonly removalTitle = input('');
  readonly detailsRequested = output<void>();
  readonly removeRequested = output<void>();
  readonly detailsId = `entry-editor-${crypto.randomUUID()}`;
}
