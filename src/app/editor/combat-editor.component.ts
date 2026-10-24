import { CharacterHelpersService } from '../sheet/character-helpers.service';
import { Component, inject, input, output } from '@angular/core';
import { CombatAction, ExportedCharacter } from '../models/character.model';
import { AppDialogService } from '../services/app-dialog.service';
import { CombatActionDialogComponent } from './combat-action-dialog.component';
import { COMBAT_TYPES, COMBAT_SNAPSHOT_FIELDS, combatSourceChanged, combatSourceSuggestion, resolveCombatResource } from './combat-actions';
import { newEditorId } from './editor-identity';
import { UiIconComponent } from '../ui-icon.component';
import { InfoButtonComponent } from '../info-button.component';

@Component({
  selector: 'app-editor-combat',
  imports: [ CombatActionDialogComponent, UiIconComponent, InfoButtonComponent],
  styleUrl: './editor.css',
  template: `
    <section class="editor-card">
      <div class="flex flex-wrap items-center justify-between gap-2 mb-3"><div class="flex items-center gap-1"><h2 class="!mb-0">Combat</h2><app-info-button title="Combat reminders"><p>Bookmark features, spells, items, or monsters to prefill an editable Combat entry, or add a custom entry. These are quick references for the sheet.</p><p>Linked values are saved suggestions. After character changes, entries with updated source values show an Update button. Review the updated entry before saving. Customized text is kept unless you choose Use Source or edit it yourself.</p><p>Track rolls, effects, and resource spending manually. Removing a Combat entry keeps its original source entry.</p></app-info-button></div><button type="button" class="action-button" (click)="create()"><app-ui-icon name="plus" /> Add Custom Entry</button></div>
      @for (type of types; track type.value) {
        @let group = entries(type.value);
        @if (group.length) {
          <section class="mt-3 min-w-0 rounded-lg bg-surface-container p-2 sm:p-2.5" [attr.aria-label]="type.label">
            <div class="mb-1.5 flex items-center gap-2"><h3 class="text-xs font-bold uppercase text-on-surface-variant">{{ type.label }}</h3><span class="text-xs tabular-nums text-on-surface-variant">{{ group.length }}</span></div>
            <div class="space-y-1.5">@for (action of group; track action; let i = $index) {
              @let sourceUpdateAvailable = hasSourceUpdate(action);
              <article class="min-w-0 rounded-lg border border-outline-variant bg-surface p-2 sm:p-2.5">
                <div class="flex min-w-0 items-start gap-1">
                  <button type="button" class="min-h-10 sm:min-h-7 min-w-0 flex-1 rounded py-1 pr-1 text-left text-sm font-semibold [overflow-wrap:anywhere] hover:text-primary focus-visible:outline-2" [attr.aria-label]="'Edit ' + action.name" aria-haspopup="dialog" [title]="'Edit ' + action.name" (click)="edit(action)">
                    <span class="line-clamp-2 sm:line-clamp-none">{{ action.name }}<app-ui-icon name="edit" class="ml-1 text-xs text-on-surface-variant" /></span>
                  </button>
                  <div class="flex shrink-0 gap-0.5" role="group" [attr.aria-label]="'Manage ' + action.name">
                    <button type="button" class="secondary-button compact-button icon-button !h-10 !w-9 !min-w-9 sm:!h-8 sm:!w-8 sm:!min-w-8" [disabled]="i === 0" [attr.aria-label]="'Move ' + action.name + ' up'" title="Move up" (click)="move(action, -1)"><app-ui-icon name="up" /></button>
                    <button type="button" class="secondary-button compact-button icon-button !h-10 !w-9 !min-w-9 sm:!h-8 sm:!w-8 sm:!min-w-8" [disabled]="i === group.length - 1" [attr.aria-label]="'Move ' + action.name + ' down'" title="Move down" (click)="move(action, 1)"><app-ui-icon name="down" /></button>
                    <button type="button" class="secondary-button compact-button icon-button !h-10 !w-9 !min-w-9 sm:!h-8 sm:!w-8 sm:!min-w-8" [attr.aria-label]="'Remove ' + action.name" title="Remove entry" (click)="remove(action)"><app-ui-icon name="trash" /></button>
                  </div>
                </div>
                @if (action.range || action.hitOrDc) {
                  <p class="mt-0.5 flex flex-wrap gap-x-2 text-xs text-on-surface-variant [overflow-wrap:anywhere]">
                    @if (action.range) { <span>{{ action.range }}</span> }
                    @if (action.range && action.hitOrDc) { <span aria-hidden="true">·</span> }
                    @if (action.hitOrDc) { <span>{{ action.hitOrDc }}</span> }
                  </p>
                }
                @if (action.damageOrHeal) { <p class="mt-1 line-clamp-2 whitespace-pre-line text-xs leading-5 [overflow-wrap:anywhere] sm:line-clamp-none sm:text-sm" [title]="action.damageOrHeal">{{ action.damageOrHeal }}</p> }
                @if (action.linkedResource || sourceUpdateAvailable) {
                  <div class="mt-1 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 border-t border-outline-variant pt-1">
                    @if (action.linkedResource; as source) {
                      <div class="min-w-0 flex-1 text-xs text-on-surface-variant"><p class="truncate" [title]="source.name || 'Linked entry'">Source: {{ source.name || 'Linked entry' }}</p>@if (!linked(action)) { <p class="text-error">No Longer on This Character</p> }</div>
                      <button type="button" class="min-h-9 sm:min-h-6 shrink-0 rounded px-1 text-xs text-on-surface-variant underline" [attr.aria-label]="'Unlink ' + action.name" (click)="unlink(action)">Unlink</button>
                    }
                    @if (sourceUpdateAvailable) { <button type="button" class="action-button compact-button !min-h-9 sm:!min-h-6" [attr.aria-label]="'Update ' + action.name" (click)="update(action)"><app-ui-icon name="reset" /> Update</button> }
                  </div>
                }
              </article>
            }</div>
          </section>
        }
      }
      @if (!sheet().combatActions?.length) { <p class="text-sm text-on-surface-variant py-3">No combat entries yet.</p> }
    </section>
    @if (draft; as action) { <app-combat-action-dialog [entry]="action" [previous]="refreshOriginal" [sourceUpdate]="sourceUpdate" (saved)="save($event)" (cancelled)="cancel()" /> }
  `,
})
export class CombatEditorComponent {
  readonly sheet = input.required<ExportedCharacter>();
  readonly edited = output<void>();
  readonly types = COMBAT_TYPES;
  private readonly dialogs = inject(AppDialogService);
  private readonly helpers = inject(CharacterHelpersService);
  draft?: CombatAction;
  refreshOriginal?: CombatAction;
  sourceUpdate?: CombatAction;
  private original?: CombatAction;
  entries(type: string) {
    return (this.sheet().combatActions ?? []).filter(action => (this.types.some(value => value.value === action.actionType) ? action.actionType : 'OTHER') === type)
      .slice().sort((a, b) => (a.orderIndex ?? 1) - (b.orderIndex ?? 1));
  }
  linked(action: CombatAction) { return resolveCombatResource(this.sheet(), action); }
  create() { this.cancel(); this.original = undefined; this.draft = { editorId: newEditorId(), name: '', actionType: 'ACTION' }; }
  edit(action: CombatAction) { this.cancel(); this.original = action; this.draft = structuredClone(action); }
  hasSourceUpdate(action: CombatAction) { return combatSourceChanged(this.sheet(), action, this.helpers); }
  update(action: CombatAction) {
    const proposed = combatSourceSuggestion(this.sheet(), action, this.helpers);
    if (!proposed) return;
    this.original = action;
    this.refreshOriginal = structuredClone(action);
    this.sourceUpdate = proposed;
    this.draft = { ...structuredClone(action), sourceSnapshot: proposed.sourceSnapshot,
      sourceOption: proposed.sourceOption, sourceOptionName: proposed.sourceOptionName, linkedResource: proposed.linkedResource };
    for (const { key } of COMBAT_SNAPSHOT_FIELDS) {
      const customized = !action.sourceSnapshot || (action[key] ?? '') !== (action.sourceSnapshot[key] ?? '');
      if (!customized) this.draft[key] = proposed[key];
    }
  }
  cancel() { this.original = undefined; this.draft = undefined; this.refreshOriginal = undefined; this.sourceUpdate = undefined; }
  save(action: CombatAction) {
    if (this.original) Object.assign(this.original, action);
    else { const actions = this.sheet().combatActions ??= []; action.orderIndex = Math.max(-1, ...actions.map(value => value.orderIndex ?? 0)) + 1; actions.push(action); }
    this.cancel(); this.edited.emit();
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
