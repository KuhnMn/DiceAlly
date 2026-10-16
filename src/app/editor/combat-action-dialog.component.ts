import { Component, OnInit, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CombatAction } from '../models/character.model';
import { CatalogDialogComponent } from './catalog-dialog.component';
import { COMBAT_TYPES } from './combat-actions';

@Component({
  selector: 'app-combat-action-dialog',
  imports: [FormsModule, CatalogDialogComponent],
  styleUrl: './local-editor.component.css',
  template: `
    <app-catalog-dialog title="Combat Entry" subtitle="Keep a short reference for use during combat." (closed)="cancelled.emit()">
      @if (suggestions().length > 1) {
        <label class="block mb-3"><span class="field-label">Monster Ability</span><select class="editor-input" name="combat-suggestion" [(ngModel)]="suggestion" (ngModelChange)="choose($event)">
          @for (option of suggestions(); track $index) { <option [ngValue]="$index">{{ option.label }}</option> }
        </select></label>
      }
      @if (draft.linkedResource; as link) { <p class="text-xs text-on-surface-variant mb-3">Linked to {{ link.name }}. Suggestions are snapshots: review the action, attack/save and effect before saving.</p> }
      <div class="space-y-3">
        <label class="block"><span class="field-label">Name</span><input class="editor-input" name="combat-name" [(ngModel)]="draft.name" /></label>
        <div class="grid sm:grid-cols-2 gap-3">
          <label><span class="field-label">Action Type</span><select class="editor-input" name="combat-type" [(ngModel)]="draft.actionType">@for (type of types; track type.value) { <option [value]="type.value">{{ type.label }}</option> }</select></label>
          <label><span class="field-label">Range (Optional)</span><input class="editor-input" name="combat-range" [(ngModel)]="draft.range" placeholder="Melee, 60 ft.…" /></label>
        </div>
        <label class="block"><span class="field-label">To Hit / Saving Throw (Optional)</span><input class="editor-input" name="combat-hit" [(ngModel)]="draft.hitOrDc" placeholder="+5 to hit or DC 14 Dexterity" /></label>
        <label class="block"><span class="field-label">Damage, Healing, or Effect</span><textarea class="editor-input" rows="3" name="combat-effect" [(ngModel)]="draft.damageOrHeal" placeholder="1d8 + 3 Slashing, heal 1d6, or a brief effect…"></textarea></label>
        <div class="flex justify-end gap-2"><button type="button" class="secondary-button" (click)="cancelled.emit()">Cancel</button><button type="button" class="action-button" [disabled]="!draft.name?.trim()" (click)="save()">Save Combat Entry</button></div>
      </div>
    </app-catalog-dialog>
  `,
})
export class CombatActionDialogComponent implements OnInit {
  readonly entry = input.required<CombatAction>();
  readonly suggestions = input<{ label: string; action: CombatAction }[]>([]);
  readonly saved = output<CombatAction>();
  readonly cancelled = output<void>();
  readonly types = COMBAT_TYPES;
  draft: CombatAction = {};
  suggestion = 0;
  ngOnInit() { this.draft = structuredClone(this.entry()); }
  choose(index: number) { this.draft = structuredClone(this.suggestions()[index].action); }
  save() { if (this.draft.name?.trim()) this.saved.emit({ ...this.draft, name: this.draft.name.trim() }); }
}
