import { CombatSourceReviewComponent } from '../sheet/combat-source-review.component';
import { Component, inject, input, output } from '@angular/core';
import { CombatAction, ExportedCharacter } from '../models/character.model';
import { AppDialogService } from '../services/app-dialog.service';
import { CombatActionDialogComponent } from './combat-action-dialog.component';
import { COMBAT_TYPES, resolveCombatResource } from './combat-actions';
import { newEditorId } from './editor-identity';
import { UiIconComponent } from '../ui-icon.component';

@Component({
  selector: 'app-editor-combat',
  imports: [CombatSourceReviewComponent, CombatActionDialogComponent, UiIconComponent],
  styleUrl: './editor.css',
  template: `
    <section class="editor-card">
      <div class="flex flex-wrap items-center justify-between gap-2 mb-3"><div><h2 class="!mb-0">Combat</h2><p class="text-xs text-on-surface-variant mt-1">Quick references on the sheet. Bookmark features, spells, items, or monsters to prefill an entry.</p></div><button type="button" class="action-button" (click)="create()"><app-ui-icon name="plus" /> Add Custom Entry</button></div>
      <app-combat-source-review [sheet]="sheet()" (edited)="edited.emit()" />
      @for (type of types; track type.value) {
        @let group = entries(type.value);
        @if (group.length) {
          <section class="mt-3 rounded-lg bg-surface-container p-2.5">
            <h3 class="text-xs font-bold uppercase text-on-surface-variant mb-2">{{ type.label }}</h3>
            <div class="space-y-2">@for (action of group; track action; let i = $index) {
              <article class="rounded-lg bg-surface border border-outline-variant p-2.5">
                <div class="flex flex-wrap items-center gap-2"><div class="flex-1 min-w-32"><p class="font-semibold text-sm">{{ action.name }}</p><p class="text-xs text-on-surface-variant">{{ action.hitOrDc }} @if (action.range) { · {{ action.range }} }</p></div>
                  <button type="button" class="secondary-button compact-button icon-button" [disabled]="i === 0" [attr.aria-label]="'Move ' + action.name + ' up'" (click)="move(action, -1)"><app-ui-icon name="up" /></button>
                  <button type="button" class="secondary-button compact-button icon-button" [disabled]="i === group.length - 1" [attr.aria-label]="'Move ' + action.name + ' down'" (click)="move(action, 1)"><app-ui-icon name="down" /></button>
                  <button type="button" class="secondary-button compact-button" (click)="edit(action)">Edit</button>
                  <button type="button" class="secondary-button compact-button icon-button" [attr.aria-label]="'Remove ' + action.name" (click)="remove(action)"><app-ui-icon name="close" /></button>
                </div>
                <p class="text-sm mt-1 whitespace-pre-line break-words">{{ action.damageOrHeal }}</p>
                @if (action.linkedResource) { <p class="text-xs text-on-surface-variant mt-2">Source: {{ action.linkedResource.name }} @if (!linked(action)) { (No Longer on This Character) } <button type="button" class="underline ml-2" (click)="unlink(action)">Unlink</button></p> }
              </article>
            }</div>
          </section>
        }
      }
      @if (!sheet().combatActions?.length) { <p class="text-sm text-on-surface-variant py-3">No combat entries yet.</p> }
    </section>
    @if (draft; as action) { <app-combat-action-dialog [entry]="action" (saved)="save($event)" (cancelled)="draft = undefined" /> }
  `,
})
export class CombatEditorComponent {
  readonly sheet = input.required<ExportedCharacter>();
  readonly edited = output<void>();
  readonly types = COMBAT_TYPES;
  private readonly dialogs = inject(AppDialogService);
  draft?: CombatAction;
  private original?: CombatAction;
  entries(type: string) {
    return (this.sheet().combatActions ?? []).filter(action => (this.types.some(value => value.value === action.actionType) ? action.actionType : 'OTHER') === type)
      .slice().sort((a, b) => (a.orderIndex ?? 1) - (b.orderIndex ?? 1));
  }
  linked(action: CombatAction) { return resolveCombatResource(this.sheet(), action); }
  create() { this.original = undefined; this.draft = { editorId: newEditorId(), name: '', actionType: 'ACTION' }; }
  edit(action: CombatAction) { this.original = action; this.draft = structuredClone(action); }
  save(action: CombatAction) {
    if (this.original) Object.assign(this.original, action);
    else { const actions = this.sheet().combatActions ??= []; action.orderIndex = Math.max(-1, ...actions.map(value => value.orderIndex ?? 0)) + 1; actions.push(action); }
    this.draft = undefined; this.edited.emit();
  }
  move(action: CombatAction, direction: number) {
    const group = this.entries(action.actionType ?? 'OTHER');
    const index = group.indexOf(action), target = index + direction;
    if (target < 0 || target >= group.length) return;
    [group[index], group[target]] = [group[target], group[index]];
    group.forEach((entry, order) => entry.orderIndex = order);
    this.edited.emit();
  }
  unlink(action: CombatAction) { delete action.linkedResource; delete action.linkedResourceType; this.edited.emit(); }
  async remove(action: CombatAction) {
    if (!await this.dialogs.confirm(`Remove "${action.name}" from Combat? The original entry will be kept.`, 'Remove Combat Entry', 'Remove')) return;
    const actions = this.sheet().combatActions ?? [], index = actions.indexOf(action);
    if (index >= 0) { actions.splice(index, 1); this.edited.emit(); }
  }
}
