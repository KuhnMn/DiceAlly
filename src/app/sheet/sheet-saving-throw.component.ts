import { Component, input } from '@angular/core';
import { UiIconComponent } from '../ui-icon.component';
import { SavingThrowCalculation } from './character-helpers.service';

import { SheetStatTooltipComponent } from './sheet-stat-tooltip.component';

/** Shared save display keeps equipment indicators and explanations consistent across layouts. */
@Component({
  selector: 'app-sheet-saving-throw',
  imports: [UiIconComponent, SheetStatTooltipComponent],
  host: { class: 'block' },
  template: `
    <app-sheet-stat-tooltip [text]="calculation().source" [focusable]="true">
      <div class="text-xs">
        <span class="inline-flex items-center justify-center gap-1">
          @if (calculation().itemBonuses.length) {
            <span role="img" class="inline-flex text-tertiary"
              [attr.aria-label]="'Equipment bonuses apply to ' + label() + ' saving throw'"><app-ui-icon name="backpack" /></span>
          }
          @if (proficient()) { <span class="font-bold text-primary" role="img" aria-label="Proficient">●</span> }
          <span>Save</span>
        </span>
      </div>
      <div class="flex items-center justify-center gap-1">
        <div class="text-sm font-bold text-tertiary" [attr.aria-label]="label() + ' saving throw ' + signedValue()">{{ signedValue() }}</div>
      </div>
    </app-sheet-stat-tooltip>
  `,
})
export class SheetSavingThrowComponent {
  readonly calculation = input.required<SavingThrowCalculation>();
  readonly proficient = input(false);
  readonly label = input.required<string>();
  signedValue() {
    const value = this.calculation().value;
    return value >= 0 ? `+${value}` : `${value}`;
  }
}
