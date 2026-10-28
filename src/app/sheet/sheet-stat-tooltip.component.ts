import { Component, computed, input, signal } from '@angular/core';
import { ConnectedPosition, OverlayModule } from '@angular/cdk/overlay';

let nextTooltipId = 0;

/** Immediate stat explanations, positioned outside clipped sheet containers. */
@Component({
  selector: 'app-sheet-stat-tooltip',
  imports: [OverlayModule],
  host: { class: 'block' },
  styleUrl: './sheet-stat-tooltip.css',
  template: `
    <div cdkOverlayOrigin #origin="cdkOverlayOrigin" [attr.tabindex]="focusable() ? 0 : null"
      class="rounded focus-visible:outline-2 focus-visible:outline-primary"
      [attr.aria-describedby]="visible() ? tooltipId : null"
      (mouseenter)="opened.set(true)" (mouseleave)="opened.set(false)"
      (focusin)="opened.set(true)" (focusout)="opened.set(false)"
      (keydown.escape)="opened.set(false); $event.stopPropagation()">
      <ng-content />
    </div>
    <ng-template cdkConnectedOverlay [cdkConnectedOverlayOrigin]="origin" [cdkConnectedOverlayOpen]="visible()"
      [cdkConnectedOverlayPositions]="positions" [cdkConnectedOverlayPush]="true" [cdkConnectedOverlayViewportMargin]="12">
      <div role="tooltip" [id]="tooltipId" class="stat-tooltip overlay-stat-tooltip">{{ text() }}</div>
    </ng-template>
  `,
})
export class SheetStatTooltipComponent {
  readonly text = input.required<string>();
  readonly disabled = input(false);
  readonly focusable = input(false);
  readonly opened = signal(false);
  readonly visible = computed(() => this.opened() && !this.disabled());
  readonly tooltipId = `sheet-stat-tooltip-${nextTooltipId++}`;
  readonly positions: ConnectedPosition[] = [
    { originX: 'center', originY: 'top', overlayX: 'center', overlayY: 'bottom', offsetY: -8 },
    { originX: 'center', originY: 'bottom', overlayX: 'center', overlayY: 'top', offsetY: 8 },
  ];
}
