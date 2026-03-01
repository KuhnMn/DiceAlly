import { Component, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

const CONDITION_NAMES = [
  'BLINDED',
  'CHARMED',
  'DEAFENED',
  'EXHAUSTION',
  'FRIGHTENED',
  'GRAPPLED',
  'INCAPACITATED',
  'PARALYZED',
  'PETRIFIED',
  'POISONED',
  'PRONE',
  'RESTRAINED',
  'STUNNED',
  'UNCONSCIOUS',
] as const;

export type ConditionName = (typeof CONDITION_NAMES)[number];

@Component({
  selector: 'app-conditions',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="flex flex-wrap gap-2">
          @for (condition of activeConditions(); track condition) {
            <button
              (click)="removeCondition(condition)"
              title="Click to remove"
              class="px-2 py-1 rounded text-xs font-semibold bg-rose-container text-on-rose-container border border-rose hover:bg-rose transition-colors"
            >
              {{ getConditionLabel(condition) }} ✕
            </button>
          }
    <div class="relative">
        <button
          (click)="showDropdown.set(!showDropdown())"
          class="px-2 py-1 rounded text-xs font-semibold bg-surface-container text-on-surface-variant border border-outline-variant hover:bg-surface-container-high transition-colors"
        >
          + Add
        </button>
        
        @if (showDropdown()) {
          <div class="absolute left-0 top-full mt-1 z-50 bg-surface-container-highest border-2 border-outline rounded-lg shadow-lg max-h-64 overflow-y-auto">
            @for (condition of availableConditions(); track condition) {
              <button
                (click)="addCondition(condition)"
                class="block w-full text-left px-3 py-2 text-xs hover:bg-surface-container transition-colors border-b border-outline-variant last:border-b-0"
              >
                {{ getConditionLabel(condition) }}
              </button>
            }
          </div>
        }
      </div>
      

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
  allConditions = CONDITION_NAMES;

  availableConditions = () => {
    const active = this.activeConditions();
    return this.allConditions.filter((c) => !active.includes(c));
  };

  addCondition(condition: ConditionName): void {
    const updated = [...this.activeConditions(), condition];
    this.conditionsChanged.emit(updated);
    this.showDropdown.set(false);
  }

  removeCondition(condition: ConditionName): void {
    const updated = this.activeConditions().filter((c) => c !== condition);
    this.conditionsChanged.emit(updated);
  }

  getConditionLabel(condition: ConditionName): string {
    return condition
      .split('_')
      .map((word) => word.charAt(0) + word.slice(1).toLowerCase())
      .join(' ');
  }
}
