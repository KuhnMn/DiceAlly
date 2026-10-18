import { Component, inject, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CombatAction, ExportedCharacter } from '../models/character.model';
import { CatalogDialogComponent } from '../editor/catalog-dialog.component';
import { COMBAT_SNAPSHOT_FIELDS, combatSourceChanged, combatSourceSuggestion, resolveCombatResource } from '../editor/combat-actions';
import { CharacterHelpersService } from './character-helpers.service';

@Component({
  selector: 'app-combat-source-review',
  imports: [FormsModule, CatalogDialogComponent],
  template: `
    @if (linkedActions().length) {
      <details class="mb-3 rounded-lg border border-outline-variant p-3" [open]="changedCount() > 0">
        <summary class="cursor-pointer text-sm font-semibold">Combat references: {{ changedCount() }} need review</summary>
        <p class="my-2 text-xs text-on-surface-variant">Linked values are saved suggestions. Review after character changes; custom text is kept unless selected for replacement.</p>
        @for (action of linkedActions(); track action) {
          <div class="flex flex-wrap items-center justify-between gap-2 py-1 text-sm">
            <span>{{ action.name }} @if (changed(action)) { — Source may have changed } @if (!linked(action)) { — Source missing }</span>
            @if (suggestion(action)) { <button type="button" class="min-h-11 rounded bg-secondary-container px-3 text-on-secondary-container" (click)="open(action)">Refresh from Source</button> }
            @else if (linked(action)) { <span class="text-xs">Re-bookmark to choose the source ability.</span> }
          </div>
        }
      </details>
    }
    @if (active; as action) {
      <app-catalog-dialog title="Refresh Combat Reference" subtitle="Choose which fields to replace. Unchecked fields keep your text." (closed)="active = undefined">
        <div class="space-y-3">
          @for (row of rows; track row.key) {
            <label class="block rounded border border-outline-variant p-3 text-sm">
              <span class="flex min-h-11 items-center gap-2 font-semibold"><input type="checkbox" [(ngModel)]="row.selected" /> {{ row.label }} @if (row.custom) { (Customized / unverified) }</span>
              <span class="block whitespace-pre-wrap break-words">Current: {{ row.current || '(empty)' }}</span>
              <span class="block whitespace-pre-wrap break-words">Suggested: {{ row.next || '(empty)' }}</span>
            </label>
          }
          <p class="text-xs">Suggestions cover supported source fields only. Review formulas and house rules yourself.</p>
          <div class="flex flex-wrap justify-end gap-2"><button type="button" class="min-h-11 rounded px-3" (click)="active = undefined">Cancel</button><button type="button" class="min-h-11 rounded bg-primary px-3 text-on-primary" (click)="apply()">Apply Selected Fields</button></div>
        </div>
      </app-catalog-dialog>
    }
  `,
})
export class CombatSourceReviewComponent {
  readonly sheet = input.required<ExportedCharacter>();
  readonly edited = output<void>();
  private readonly helpers = inject(CharacterHelpersService);
  active?: CombatAction;
  private proposed?: CombatAction;
  rows: { key: typeof COMBAT_SNAPSHOT_FIELDS[number]['key']; label: string; current: string; next: string; custom: boolean; selected: boolean }[] = [];
  linkedActions() { return (this.sheet().combatActions ?? []).filter(action => action.linkedResource); }
  linked(action: CombatAction) { return resolveCombatResource(this.sheet(), action); }
  suggestion(action: CombatAction) { return combatSourceSuggestion(this.sheet(), action, this.helpers); }
  changed(action: CombatAction) { return combatSourceChanged(this.sheet(), action, this.helpers); }
  changedCount() { return this.linkedActions().filter(action => !this.linked(action) || this.changed(action)).length; }
  open(action: CombatAction) {
    const proposed = this.suggestion(action);
    if (!proposed) return;
    this.active = action; this.proposed = proposed;
    this.rows = COMBAT_SNAPSHOT_FIELDS.map(({ key, label }) => {
      const custom = !action.sourceSnapshot || (action[key] ?? '') !== (action.sourceSnapshot[key] ?? '');
      return { key, label, current: action[key] ?? '', next: proposed[key] ?? '', custom, selected: !custom };
    });
  }
  apply() {
    if (!this.active || !this.proposed) return;
    for (const row of this.rows) if (row.selected) this.active[row.key] = row.next;
    this.active.sourceSnapshot = this.proposed.sourceSnapshot;
    this.active = undefined; this.edited.emit();
  }
}
