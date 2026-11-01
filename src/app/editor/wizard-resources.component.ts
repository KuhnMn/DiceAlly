import { Component, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ExportedCharacter } from '../models/character.model';
import { WizardState } from './wizard-prefill';
import { resourceImportName, resourceImportSetting, ResourceImportSetting, WizardResourceColumn } from './wizard-resources';
import { RESOURCE_RECOVERY_OPTIONS } from '../models/source-resources';

@Component({
  selector: 'app-wizard-resources',
  imports: [FormsModule],
  styleUrl: './editor.css',
  styles: ['.editor-input { min-height: 2rem; padding: .25rem .5rem; font-size: .8125rem; }'],
  template: `
    <section class="mb-3 space-y-2 rounded-lg border border-outline-variant p-2 text-sm" aria-label="Resource import">
      <label class="flex items-center gap-2 font-semibold"><input type="checkbox" name="wizard-resources-enabled"
        [ngModel]="state().options['resourceReminders'] === true" (ngModelChange)="enabledChanged.emit($event)" />Import Resources</label>
      <p class="text-xs text-on-surface-variant">Selected resources replace saved definitions or are added again if deleted. Spent uses are preserved.</p>
      @if (state().options['resourceReminders'] === true) {
        @for (column of columns(); track column.id) {
          @let config = setting(column);
          <div class="rounded bg-surface-container p-2">
            <label class="flex min-h-8 items-center gap-2"><input type="checkbox" [ngModel]="config.enabled"
              (ngModelChange)="update(column, {enabled: $event})" [ngModelOptions]="{standalone:true}" [disabled]="combined(column)"
              [attr.aria-label]="'Import ' + column.owner + ': ' + column.name" />
              <span class="min-w-0 flex-1">{{ column.name }} <span class="text-primary">· {{ column.value }}</span></span>
              <span class="text-xs text-on-surface-variant">{{ combined(column) ? 'Combined' : column.kind === 'counter' ? 'Counter' : 'Reminder' }}</span>
            </label>
            <p class="text-[11px] text-on-surface-variant">{{ column.owner }} · {{ column.table }}</p>
            @if (config.enabled && !combined(column)) {
              <div class="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                <label><span class="field-label">Name</span><input class="editor-input" [ngModel]="name(column)"
                  (ngModelChange)="update(column, {name:$event})" [ngModelOptions]="{standalone:true}" /></label>
                @if (column.kind === 'counter') {
                  <label><span class="field-label">Recovery</span><select class="editor-input" [ngModel]="config.recovery ?? 'NONE'"
                    (ngModelChange)="update(column, {recovery:$event})" [ngModelOptions]="{standalone:true}" [attr.aria-label]="'Recovery for ' + column.name">
                    @for (option of recoveries; track option.value) { <option [value]="option.value">{{ option.label }}</option> }
                  </select></label>
                  <label><span class="field-label">Combine with Reminder</span><select class="editor-input"
                    [ngModel]="config.reminderId ?? ''" (ngModelChange)="update(column, {reminderId:$event})" [ngModelOptions]="{standalone:true}" [attr.aria-label]="'Reminder for ' + column.name">
                    <option value="">No Reminder</option>
                    @for (reminder of reminders(column); track reminder.id) { <option [value]="reminder.id">{{ reminder.name }} · {{ reminder.value }}</option> }
                  </select></label>
                }
              </div>
            }
          </div>
        } @empty { <p class="text-xs text-on-surface-variant">No supported resource values at this class level.</p> }
      }
    </section>`,
})
export class WizardResourcesComponent {
  readonly recoveries = RESOURCE_RECOVERY_OPTIONS;
  readonly sheet = input.required<ExportedCharacter>();
  readonly state = input.required<WizardState>();
  readonly columns = input.required<WizardResourceColumn[]>();
  readonly enabledChanged = output<boolean>();
  readonly edited = output<void>();
  setting(column: WizardResourceColumn) { return resourceImportSetting(this.sheet(), this.state(), column); }
  name(column: WizardResourceColumn) { return resourceImportName(this.sheet(), this.state(), column, this.columns()); }
  update(column: WizardResourceColumn, patch: Partial<ResourceImportSetting>) {
    (this.state().resourceImports ??= {})[column.id] = { ...this.setting(column), ...patch };
    this.edited.emit();
  }
  reminders(column: WizardResourceColumn) { return this.columns().filter(candidate => candidate.kind === 'note' && candidate.sourceId === column.sourceId); }
  combined(column: WizardResourceColumn) {
    return column.kind === 'note' && this.columns().some(candidate => candidate.kind === 'counter' && candidate.sourceId === column.sourceId
      && this.setting(candidate).enabled && this.setting(candidate).reminderId === column.id);
  }
}
