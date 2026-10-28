import { Component, input, signal } from '@angular/core';
import { ConnectedPosition, OverlayModule } from '@angular/cdk/overlay';
import { UiIconComponent } from '../ui-icon.component';
import { SavingThrowCalculation } from './character-helpers.service';

let nextSaveTooltipId = 0;

/** Shared save display keeps equipment indicators and explanations consistent across layouts. */
@Component({
  selector: 'app-sheet-saving-throw',
  imports: [UiIconComponent, OverlayModule],
  host: { class: 'block' },
  styleUrl: './sheet-stat-tooltip.css',
  styles: [`
    .save-tooltip {
      position: relative;
      visibility: visible;
      bottom: auto;
      left: auto;
      transform: none;
      width: max-content;
      max-width: min(24rem, calc(100vw - 24px));
      white-space: normal;
    }
    .save-tooltip::after { display: none; }
  `],
  template: `
    <div cdkOverlayOrigin #origin="cdkOverlayOrigin" tabindex="0" class="rounded focus-visible:outline-2 focus-visible:outline-primary"
      [attr.aria-describedby]="opened() ? tooltipId : null"
      (mouseenter)="opened.set(true)" (mouseleave)="opened.set(false)"
      (focusin)="opened.set(true)" (focusout)="opened.set(false)"
      (keydown.escape)="opened.set(false); $event.stopPropagation()">
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
    </div>
    <ng-template cdkConnectedOverlay [cdkConnectedOverlayOrigin]="origin" [cdkConnectedOverlayOpen]="opened()"
      [cdkConnectedOverlayPositions]="positions" [cdkConnectedOverlayPush]="true" [cdkConnectedOverlayViewportMargin]="12">
      <div role="tooltip" [id]="tooltipId" class="stat-tooltip save-tooltip">{{ calculation().source }}</div>
    </ng-template>
  `,
})
export class SheetSavingThrowComponent {
  readonly calculation = input.required<SavingThrowCalculation>();
  readonly proficient = input(false);
  readonly label = input.required<string>();
  readonly opened = signal(false);
  readonly tooltipId = `saving-throw-tooltip-${nextSaveTooltipId++}`;
  readonly positions: ConnectedPosition[] = [
    { originX: 'center', originY: 'top', overlayX: 'center', overlayY: 'bottom', offsetY: -8 },
    { originX: 'center', originY: 'bottom', overlayX: 'center', overlayY: 'top', offsetY: 8 },
  ];
  signedValue() {
    const value = this.calculation().value;
    return value >= 0 ? `+${value}` : `${value}`;
  }
}
