import { Component, inject, input, output } from '@angular/core';
import { CombatAction, ExportedCharacter, Monster } from '../models/character.model';
import { CharacterHelpersService } from '../sheet/character-helpers.service';
import { UiIconComponent } from '../ui-icon.component';
import { CombatActionDialogComponent } from './combat-action-dialog.component';
import { CombatResource, CombatResourceType, monsterCombatOptions, prefillCombatAction, resolveCombatResource } from './combat-actions';
import { AppDialogService } from '../services/app-dialog.service';

@Component({
  selector: 'app-combat-bookmark',
  imports: [UiIconComponent, CombatActionDialogComponent],
  styleUrl: './local-editor.component.css',
  template: `
    <span class="inline-flex items-center gap-1 rounded-lg" [class.border]="type() === 'MONSTER' && isBookmarked()"
      [class.border-outline-variant]="type() === 'MONSTER' && isBookmarked()" [class.p-1]="type() === 'MONSTER' && isBookmarked()"
      role="group" [attr.aria-label]="resource().name + ' Combat Entries'">
    <button type="button" class="compact-button icon-button" [class.secondary-button]="!isBookmarked()" [class.action-button]="isBookmarked()"
      [title]="isBookmarked() ? 'In Combat · Click to Remove' : 'Add to Combat'" [attr.aria-pressed]="isBookmarked()"
      [attr.aria-label]="(isBookmarked() ? 'Remove ' : 'Add ') + resource().name + (isBookmarked() ? ' from Combat' : ' to Combat')"
      aria-haspopup="dialog" (click)="toggle()"><app-ui-icon name="bookmark" /></button>
    @if (type() === 'MONSTER' && isBookmarked()) {
      <button type="button" class="secondary-button compact-button inline-flex items-center gap-1" [title]="'Add Another Combat Entry for ' + resource().name" [attr.aria-label]="'Add another combat entry for ' + resource().name" (click)="open()"><app-ui-icon name="plus" /><span>Entry</span></button>
    }
    </span>
    @if (draft; as action) { <app-combat-action-dialog [entry]="action" [suggestions]="suggestions" (saved)="add($event)" (cancelled)="draft = undefined" /> }
  `,
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
    return (this.sheet().combatActions ?? []).filter(action => resolveCombatResource(this.sheet(), action) === this.resource());
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
