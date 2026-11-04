import { Component, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ExportedCharacter } from '../models/character.model';
import { WizardState } from './wizard-prefill';
import { resourceImportKind, resourceImportName, resourceImportReminder, resourceImportSetting, ResourceImportSetting, WizardResourceColumn } from './wizard-resources';
import { RESOURCE_RECOVERY_OPTIONS } from '../models/source-resources';
import { RESOURCE_MODE_LABELS } from '../models/source-resource-labels';

@Component({
  selector: 'app-wizard-resources',
  imports: [FormsModule],
  styleUrl: './editor.css',
  styles: ['.editor-input { min-height: 2rem; padding: .25rem .5rem; font-size: .8125rem; }'],
  template: `
    <section class="mb-3 space-y-2 rounded-lg border border-outline-variant p-2 text-sm" aria-label="Resource and reminder import">
      <label class="flex items-center gap-2 font-semibold"><input type="checkbox" name="wizard-resources-enabled"
        [ngModel]="state().options['resourceReminders'] === true" (ngModelChange)="enabledChanged.emit($event)" />Import Resources &amp; Reminders</label>
      <p class="text-xs text-on-surface-variant">Resources track spendable uses. Reminders display information without spending it. Selected entries replace saved definitions or are added again if deleted. Spent uses are preserved.</p>
      @if (state().options['resourceReminders'] === true) {
        @for (column of columns(); track column.id) {
          @let config = setting(column);
          <div class="rounded bg-surface-container p-2">
            <div class="flex flex-wrap items-center gap-x-3 gap-y-1">
            <label class="flex min-h-8 min-w-0 flex-1 items-center gap-2"><input type="checkbox" [ngModel]="config.enabled"
              (ngModelChange)="update(column, {enabled: $event})" [ngModelOptions]="{standalone:true}" [disabled]="combined(column)"
              [attr.aria-label]="'Import ' + column.owner + ': ' + column.name" />
              <span class="min-w-0 flex-1">{{ column.name }} <span class="text-primary">· {{ column.value }}</span></span>
              @if (!numeric(column) || combined(column) || typeLabel(column) === modes.both) {
                <span class="text-xs text-on-surface-variant">{{ combined(column) ? 'Attached Reminder' : typeLabel(column) }}</span>
              }
            </label>
            @if (numeric(column)) {
              <label class="ml-auto flex items-center gap-2 text-xs text-on-surface-variant"><span>Entry Type</span>
                <select class="editor-input !w-auto" [ngModel]="kind(column)" (ngModelChange)="update(column, {kind:$event})"
                  [ngModelOptions]="{standalone:true}" [attr.aria-label]="'Entry type for ' + column.name">
                  <option value="counter">{{ modes.counter }}</option>
                  <option value="note">{{ modes.note }}</option>
                </select>
              </label>
            }
            </div>
            <p class="text-[11px] text-on-surface-variant">{{ column.owner }} · {{ column.table }}</p>
            @if (config.enabled && !combined(column)) {
              <div class="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                <label><span class="field-label">{{ kind(column) === 'counter' ? 'Resource Name' : 'Reminder Name' }}</span><input class="editor-input" [ngModel]="name(column)"
                  (ngModelChange)="update(column, {name:$event})" [ngModelOptions]="{standalone:true}" /></label>
                @if (kind(column) === 'counter') {
                  <label><span class="field-label">Resource Recovery</span><select class="editor-input" [ngModel]="config.recovery ?? 'NONE'"
                    (ngModelChange)="update(column, {recovery:$event})" [ngModelOptions]="{standalone:true}" [attr.aria-label]="'Recovery for ' + column.name">
                    @for (option of recoveries; track option.value) { <option [value]="option.value">{{ option.label }}</option> }
                  </select></label>
                  <label><span class="field-label">Attached Reminder</span><select class="editor-input"
                    [ngModel]="config.reminderId ?? ''" (ngModelChange)="update(column, {reminderId:$event})" [ngModelOptions]="{standalone:true}" [attr.aria-label]="'Reminder for ' + column.name">
                    <option value="">No Reminder</option>
                    @for (reminder of reminders(column); track reminder.id) { <option [value]="reminder.id">{{ reminder.name }} · {{ reminder.value }}</option> }
                  </select></label>
                }
              </div>
            }
          </div>
        } @empty { <p class="text-xs text-on-surface-variant">No supported resources or reminders at this class level.</p> }
      }
    </section>`,
})
export class WizardResourcesComponent {
  private readonly nameDrafts = new Map<string, string>();
  readonly modes = RESOURCE_MODE_LABELS;
  readonly recoveries = RESOURCE_RECOVERY_OPTIONS;
  readonly sheet = input.required<ExportedCharacter>();
  readonly state = input.required<WizardState>();
  readonly columns = input.required<WizardResourceColumn[]>();
  readonly enabledChanged = output<boolean>();
  readonly edited = output<void>();
  setting(column: WizardResourceColumn) { return resourceImportSetting(this.sheet(), this.state(), column); }
  numeric(column: WizardResourceColumn) { return typeof column.value === 'number'; }
  kind(column: WizardResourceColumn) { return resourceImportKind(this.sheet(), this.state(), column); }
  typeLabel(column: WizardResourceColumn) {
    return RESOURCE_MODE_LABELS[resourceImportReminder(this.sheet(), this.state(), column, this.columns()) ? 'both' : this.kind(column)];
  }
  name(column: WizardResourceColumn) {
    const draft = this.nameDrafts.get(column.id);
    if (draft !== undefined) return draft;
    const configured = this.setting(column).name;
    return configured !== undefined && configured !== column.name ? configured
      : resourceImportName(this.sheet(), this.state(), column, this.columns());
  }
  update(column: WizardResourceColumn, patch: Partial<ResourceImportSetting>) {
    if (patch.name !== undefined) this.nameDrafts.set(column.id, patch.name);
    (this.state().resourceImports ??= {})[column.id] = { ...this.setting(column), ...patch };
    this.edited.emit();
  }
  reminders(column: WizardResourceColumn) {
    return this.columns().filter(candidate => candidate.id !== column.id && this.kind(candidate) === 'note' && candidate.sourceId === column.sourceId);
  }
  combined(column: WizardResourceColumn) {
    return this.kind(column) === 'note' && this.columns().some(candidate => this.setting(candidate).enabled
      && resourceImportReminder(this.sheet(), this.state(), candidate, this.columns())?.id === column.id);
  }
}
