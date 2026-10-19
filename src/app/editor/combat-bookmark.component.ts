import { Component, inject, input, output } from '@angular/core';
import { CombatAction, ExportedCharacter, Monster } from '../models/character.model';
import { CharacterHelpersService } from '../sheet/character-helpers.service';
import { UiIconComponent } from '../ui-icon.component';
import { CombatActionDialogComponent } from './combat-action-dialog.component';
import { CombatResource, CombatResourceType, combatLinksForResource, monsterCombatOptions, prefillCombatAction } from './combat-actions';
import { AppDialogService } from '../services/app-dialog.service';

@Component({
  selector: 'app-combat-bookmark',
  host: { class: 'flex min-w-0 max-w-full' },
  imports: [UiIconComponent, CombatActionDialogComponent],
  styleUrl: './editor.css',
  template: `
    <span class="inline-flex max-w-full items-center gap-1 rounded-lg"
      role="group" [attr.aria-label]="resource().name + ' Combat Entries'">
    <button type="button" class="combat-tool-button" [class.secondary-button]="!isBookmarked()" [class.action-button]="isBookmarked()"
      [title]="isBookmarked() ? 'In Combat · Click to Remove' : 'Add to Combat'" [attr.aria-pressed]="isBookmarked()"
      [attr.aria-label]="(isBookmarked() ? 'Remove ' : 'Add ') + resource().name + (isBookmarked() ? ' from Combat' : ' to Combat')"
      aria-haspopup="dialog" (click)="toggle()"><app-ui-icon name="swords" /><span>Combat</span>@if (isBookmarked()) { <span class="tabular-nums">({{ linkedActions().length }})</span> }</button>
    @if (isBookmarked()) {
      <button type="button" class="secondary-button combat-tool-button" [title]="'Add Another Combat Entry for ' + resource().name" [attr.aria-label]="'Add another combat entry for ' + resource().name" (click)="open()"><app-ui-icon name="plus" /></button>
    }
    </span>
    @if (draft; as action) { <app-combat-action-dialog [entry]="action" [suggestions]="suggestions" (saved)="add($event)" (cancelled)="draft = undefined" /> }
  `,
  styles: [`button.combat-tool-button { display: inline-flex; align-items: center; justify-content: center; gap: .25rem; min-height: 2rem; padding: .25rem .5rem; border: 1px solid var(--md-sys-color-outline-variant); border-radius: .375rem; font-size: .75rem; }`],
})
export class CombatBookmarkComponent {
  readonly sheet = input.required<ExportedCharacter>();
  readonly resource = input.required<CombatResource>();
  readonly type = input.required<CombatResourceType>();
  readonly edited = output<void>();
  private readonly helpers = inject(CharacterHelpersService);
  private readonly dialogs = inject(AppDialogService);
  draft?: CombatAction;
  suggestions: { label: string; action: CombatAction }[] = [];
  linkedActions() {
    return combatLinksForResource(this.sheet(), this.resource());
  }
  isBookmarked() { return this.linkedActions().length > 0; }
  async toggle() {
    const linked = this.linkedActions();
    if (!linked.length) { this.open(); return; }
    const count = linked.length;
    if (!await this.dialogs.confirm(`Remove ${count === 1 ? 'the combat entry' : `all ${count} combat entries`} linked to "${this.resource().name}"? The original entry will be kept.`, 'Remove from Combat', 'Remove')) return;
    this.sheet().combatActions = (this.sheet().combatActions ?? []).filter(action => !linked.includes(action));
    this.draft = undefined;
    this.edited.emit();
  }
  open() {
    this.suggestions = this.type() === 'MONSTER' ? monsterCombatOptions(this.resource() as Monster).map((ability, index) => ({
      label: ability.name || 'Ability', action: prefillCombatAction(this.sheet(), this.resource(), this.type(), this.helpers, index),
    })) : [];
    this.draft = this.suggestions[0]?.action ?? prefillCombatAction(this.sheet(), this.resource(), this.type(), this.helpers);
  }
  add(action: CombatAction) {
    const actions = this.sheet().combatActions ??= [];
    action.orderIndex = Math.max(-1, ...actions.map(entry => entry.orderIndex ?? 0)) + 1;
    actions.push(action); this.draft = undefined; this.edited.emit();
  }
}
