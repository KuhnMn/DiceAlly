import { UiIconComponent } from '../ui-icon.component';
import { Component, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ConditionName } from '../models/character.model';

const CONDITION_NAMES = [
  'BLINDED',
  'CHARMED',
  'DEAFENED',
  'EXHAUSTION',
  'FRIGHTENED',
  'GRAPPLED',
  'INCAPACITATED',
  'INVISIBLE',
  'PARALYZED',
  'PETRIFIED',
  'POISONED',
  'PRONE',
  'RESTRAINED',
  'STUNNED',
  'UNCONSCIOUS',
] as const;

@Component({
  selector: 'app-conditions',
  standalone: true,
  imports: [UiIconComponent, CommonModule],
  template: `
    <div class="space-y-2" (keydown.escape)="showDropdown.set(false)">
      <div class="flex flex-wrap gap-1.5">
        @for (condition of activeConditions(); track condition) {
          <button type="button" (click)="removeCondition(condition)" [attr.aria-label]="'Remove ' + getConditionLabel(condition)" class="inline-flex min-h-9 min-w-0 max-w-full items-center gap-1 rounded-lg border border-primary bg-primary-container px-2 py-1.5 text-sm text-on-primary-container [overflow-wrap:anywhere] sm:min-h-0 sm:py-1">{{ getConditionLabel(condition) }} <app-ui-icon name="close" /></button>
        }
        <button type="button" (click)="showDropdown.set(!showDropdown())" [attr.aria-expanded]="showDropdown()" class="min-h-9 rounded-lg border border-outline-variant bg-surface-container px-2 py-1.5 text-sm sm:min-h-0 sm:py-1">{{ showDropdown() ? 'Close picker' : '+ Add condition' }}</button>
      </div>
      @if (showDropdown()) {
        <div class="rounded-lg border border-outline-variant bg-surface-container-highest p-2">
          <label class="block text-sm font-semibold">Custom effect
            <input [value]="customConditionInput()" (input)="onCustomConditionInput($any($event.target).value)" (keydown.enter)="addCustomCondition()" placeholder="Condition or effect name" class="mt-1 min-h-11 w-full min-w-0 rounded border border-outline-variant bg-surface px-2 text-base" />
          </label>
          <button type="button" [disabled]="!customConditionInput().trim()" (click)="addCustomCondition()" class="my-2 min-h-11 rounded-lg bg-primary-container px-3 py-2 text-sm text-on-primary-container disabled:opacity-50">Add custom effect</button>
          <div class="grid max-h-56 grid-cols-2 gap-1 overflow-y-auto overscroll-contain" aria-label="Available conditions">
            @for (condition of availableConditions(); track condition) {
              <button type="button" (click)="addCondition(condition)" class="min-h-11 min-w-0 break-words rounded px-2 py-2 text-left text-sm hover:bg-surface-container">{{ getConditionLabel(condition) }}</button>
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
  `],
})
export class ConditionsComponent {
  activeConditions = input<ConditionName[]>([]);
  conditionsChanged = output<ConditionName[]>();
  
  showDropdown = signal(false);
  customConditionInput = signal('');
  allConditions = CONDITION_NAMES;

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
    if (!this.allConditions.includes(condition as (typeof CONDITION_NAMES)[number])) {
      return condition;
    }

    return condition
      .split('_')
      .map((word) => word.charAt(0) + word.slice(1).toLowerCase())
      .join(' ');
  }
}
