import { Component, OnInit, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CombatAction } from '../models/character.model';
import { CatalogDialogComponent } from './catalog-dialog.component';
import { COMBAT_TYPES, COMBAT_SNAPSHOT_FIELDS } from './combat-actions';

@Component({
  selector: 'app-combat-action-dialog',
  imports: [FormsModule, CatalogDialogComponent],
  styleUrl: './editor.css',
  template: `
    <app-catalog-dialog [title]="sourceUpdate() ? 'Update Combat Entry' : 'Combat Entry'" [subtitle]="sourceUpdate() ? 'Review the updated values before saving. Customized text is kept unless you replace it.' : 'Add a reminder to the Combat page.'" [compact]="true" (closed)="cancelled.emit()">
      @if (suggestions().length > 1) {
        <label class="block mb-3"><span class="field-label">Monster Ability</span><select class="editor-input" name="combat-suggestion" [(ngModel)]="suggestion" (ngModelChange)="choose($event)">
          @for (option of suggestions(); track $index) { <option [ngValue]="$index">{{ option.label }}</option> }
        </select></label>
      }
      @if (draft.linkedResource; as link) { <p class="text-xs text-on-surface-variant mb-2">For {{ link.name }}</p> }
      @if (customizedFields.length) {
        <section aria-label="Customized values" class="mb-3 space-y-2 rounded-lg border border-outline-variant bg-surface-container p-3 text-xs">
          <p class="font-semibold">Your customized values are kept in the form below.</p>
          @for (field of customizedFields; track field.key) {
            <div class="min-w-0"><p class="whitespace-pre-wrap [overflow-wrap:anywhere]">{{ field.label }} · Source: {{ sourceUpdate()![field.key] || '(empty)' }}</p>
              <button type="button" class="secondary-button compact-button mt-1" (click)="useSource(field.key)" [attr.aria-label]="'Use Source for ' + field.label">Use Source</button>
            </div>
          }
        </section>
      }
      <div class="combat-form space-y-2">
        <label class="block"><span class="field-label">Name</span><input class="editor-input" name="combat-name" [(ngModel)]="draft.name" /></label>
        <div class="grid grid-cols-2 gap-2">
          <label><span class="field-label">Action Type</span><select class="editor-input" name="combat-type" [(ngModel)]="draft.actionType">@for (type of types; track type.value) { <option [value]="type.value">{{ type.label }}</option> }</select></label>
          <label><span class="field-label">Range (Optional)</span><input class="editor-input" name="combat-range" [(ngModel)]="draft.range" placeholder="Melee, 60 ft.…" /></label>
        </div>
        <label class="block"><span class="field-label">To Hit / Saving Throw (Optional)</span><input class="editor-input" name="combat-hit" [(ngModel)]="draft.hitOrDc" placeholder="+5 to hit or DC 14 Dexterity" /></label>
        <label class="block"><span class="field-label">Damage, Healing, or Effect</span><textarea class="editor-input" rows="2" name="combat-effect" [(ngModel)]="draft.damageOrHeal" placeholder="1d8 + 3 Slashing, heal 1d6, or a brief effect…"></textarea></label>
      </div>
      <div catalog-footer class="flex justify-end gap-2 [&>button]:min-h-11"><button type="button" class="secondary-button" (click)="cancelled.emit()">Cancel</button><button type="button" class="action-button" [disabled]="!draft.name?.trim()" (click)="save()">{{ sourceUpdate() ? 'Save Update' : 'Save Combat Entry' }}</button></div>
    </app-catalog-dialog>
  `,
  styles: [`.combat-form .editor-input { padding: .375rem .5rem; font-size: 1rem; } @media (min-width: 640px) { .combat-form .editor-input { font-size: .8125rem; } } .combat-form .field-label { margin-bottom: .125rem; }`],
})
export class CombatActionDialogComponent implements OnInit {
  readonly entry = input.required<CombatAction>();
  readonly previous = input<CombatAction>();
  readonly sourceUpdate = input<CombatAction>();
  readonly suggestions = input<{ label: string; action: CombatAction }[]>([]);
  readonly saved = output<CombatAction>();
  readonly cancelled = output<void>();
  readonly types = COMBAT_TYPES;
  draft: CombatAction = {};
  suggestion = 0;
  ngOnInit() { this.draft = structuredClone(this.entry()); }
  choose(index: number) { this.draft = structuredClone(this.suggestions()[index].action); }
  get customizedFields() {
    const previous = this.previous(), next = this.sourceUpdate();
    if (!previous || !next) return [];
    return COMBAT_SNAPSHOT_FIELDS.filter(({ key }) => (!previous.sourceSnapshot || (previous[key] ?? '') !== (previous.sourceSnapshot[key] ?? ''))
      && (previous[key] ?? '') !== (next[key] ?? '') && (this.draft[key] ?? '') !== (next[key] ?? ''));
  }
  useSource(key: typeof COMBAT_SNAPSHOT_FIELDS[number]['key']) { this.draft[key] = this.sourceUpdate()?.[key]; }
  save() { if (this.draft.name?.trim()) this.saved.emit({ ...this.draft, name: this.draft.name.trim() }); }
}
