import { UiIconComponent } from '../ui-icon.component';
import { Component, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ConditionName } from '../models/character.model';
import { RuleDescriptionSnapshot, STANDARD_CONDITIONS } from '../models/character-references';
import { RuleReferenceComponent } from './rule-reference.component';

@Component({
  selector: 'app-conditions',
  standalone: true,
  imports: [RuleReferenceComponent, UiIconComponent, CommonModule],
  template: `
    <div class="space-y-2" (keydown.escape)="showDropdown.set(false)">
      <div class="flex flex-wrap gap-1.5">
        @for (condition of activeConditions(); track condition) {
          <app-rule-reference appearance="tag" [reference]="description(condition)">
            <span class="min-w-0 pr-1 text-[13px] font-medium [overflow-wrap:anywhere]">{{ getConditionLabel(condition) }}</span>
            <button reference-actions type="button" (click)="removeCondition(condition)" [attr.aria-label]="'Remove ' + getConditionLabel(condition)" class="inline-flex h-7 w-6 shrink-0 items-center justify-center rounded-r-md border-l border-on-primary-container/20 text-[11px] text-on-primary-container/70 hover:bg-primary/15 hover:text-on-primary-container focus-visible:outline-2 focus-visible:outline-primary"><app-ui-icon name="close" /></button>
          </app-rule-reference>
        }
        <button type="button" (click)="showDropdown.set(!showDropdown())" [attr.aria-expanded]="showDropdown()" class="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-outline-variant bg-surface-container px-2.5 py-1.5 text-sm hover:bg-surface-container-high"><app-ui-icon [name]="showDropdown() ? 'close' : 'plus'" />{{ showDropdown() ? 'Close Picker' : 'Add Condition' }}</button>
      </div>
      @if (showDropdown()) {
        <div class="rounded-lg border border-outline-variant bg-surface-container-high p-3">
          <div class="mb-3 flex min-w-0 items-center gap-2">
            <input aria-label="Custom effect name" [value]="customConditionInput()" (input)="onCustomConditionInput($any($event.target).value)" (keydown.enter)="addCustomCondition()" placeholder="Custom effect" class="h-10 min-w-0 flex-1 rounded-lg border border-outline-variant bg-surface px-2.5 text-sm text-on-surface focus-visible:outline-2 focus-visible:outline-primary" />
            <button type="button" [disabled]="!customConditionInput().trim()" (click)="addCustomCondition()" aria-label="Add custom effect" class="inline-flex h-10 shrink-0 items-center gap-1 rounded-lg bg-primary-container px-3 text-sm font-semibold text-on-primary-container disabled:opacity-50"><app-ui-icon name="plus" /> Add</button>
          </div>
          <h4 class="mb-2 text-xs font-semibold uppercase text-on-surface-variant">Standard Conditions</h4>
          <div class="condition-picker-grid max-h-64 gap-2 overflow-y-auto overscroll-contain" aria-label="Available conditions">
            @for (condition of availableConditions(); track condition) {
              <app-rule-reference appearance="row" [reference]="description(condition)">
                <button type="button" (click)="addCondition(condition)" [attr.aria-label]="'Add ' + getConditionLabel(condition)" class="min-h-10 min-w-0 flex-1 py-2 text-left text-[13px] font-medium focus-visible:outline-2 focus-visible:outline-primary">{{ getConditionLabel(condition) }}</button>
              </app-rule-reference>
            }
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    :host {
      display: block;
    }
    .condition-picker-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(min(100%, 10rem), 1fr));
    }
  `],
})
export class ConditionsComponent {
  activeConditions = input<ConditionName[]>([]);
  descriptions = input<readonly RuleDescriptionSnapshot[]>([]);
  conditionsChanged = output<ConditionName[]>();
  
  showDropdown = signal(false);
  customConditionInput = signal('');
  allConditions = STANDARD_CONDITIONS;
  description(condition: ConditionName) {
    if (!this.allConditions.includes(condition as typeof STANDARD_CONDITIONS[number])) return undefined;
    return this.descriptions().find(reference => reference.name.toUpperCase() === condition);
  }

  availableConditions = () => {
    const active = this.activeConditions();
    return this.allConditions.filter((c) => !active.includes(c));
  };

  addCondition(condition: ConditionName): void {
    if (this.activeConditions().includes(condition)) {
      this.showDropdown.set(false);
      return;
    }

    const updated = [...this.activeConditions(), condition];
    this.conditionsChanged.emit(updated);
    this.showDropdown.set(false);
  }

  addCustomCondition(): void {
    const nextCondition = this.customConditionInput().trim();
    if (!nextCondition) {
      return;
    }

    if (this.activeConditions().includes(nextCondition)) {
      this.customConditionInput.set('');
      return;
    }

    const updated = [...this.activeConditions(), nextCondition];
    this.conditionsChanged.emit(updated);
    this.customConditionInput.set('');
    this.showDropdown.set(false);
  }

  onCustomConditionInput(value: string): void {
    this.customConditionInput.set(value);
  }

  removeCondition(condition: ConditionName): void {
    const updated = this.activeConditions().filter((c) => c !== condition);
    this.conditionsChanged.emit(updated);
  }

  getConditionLabel(condition: ConditionName): string {
    if (!this.allConditions.includes(condition as (typeof STANDARD_CONDITIONS)[number])) {
      return condition;
    }

    return condition
      .split('_')
      .map((word) => word.charAt(0) + word.slice(1).toLowerCase())
      .join(' ');
  }
}
