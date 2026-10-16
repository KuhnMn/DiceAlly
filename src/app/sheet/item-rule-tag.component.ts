import { Component, input, signal } from '@angular/core';
import { OverlayModule } from '@angular/cdk/overlay';
import { Entry } from '../models/character.model';
import { EntryRendererComponent } from '../entries/entry-renderer.component';

/** Compact rule tags expose their descriptions on hover, keyboard focus, or tap. */
@Component({
  selector: 'app-item-rule-tag',
  imports: [OverlayModule, EntryRendererComponent],
  host: { class: 'inline-flex' },
  template: `
    <button type="button" cdkOverlayOrigin #origin="cdkOverlayOrigin"
      class="rounded px-2 py-0.5 text-xs" [class.bg-teal-container]="!mastery()" [class.text-on-teal-container]="!mastery()"
      [class.bg-secondary-container]="mastery()" [class.text-on-secondary-container]="mastery()"
      [attr.aria-label]="label() + ' description'" [attr.aria-expanded]="opened() && !!entry()"
      (mouseenter)="opened.set(true)" (mouseleave)="opened.set(false)" (focus)="opened.set(true)" (blur)="opened.set(false)"
      (click)="opened.set(true)" (keydown.escape)="opened.set(false); $event.stopPropagation()">{{ label() }}</button>
    <ng-template cdkConnectedOverlay [cdkConnectedOverlayOrigin]="origin" [cdkConnectedOverlayOpen]="opened() && !!entry()"
      [cdkConnectedOverlayPush]="true" [cdkConnectedOverlayViewportMargin]="8" (overlayOutsideClick)="opened.set(false)">
      <div role="tooltip" class="my-1 max-h-[50dvh] w-80 max-w-[calc(100vw-1rem)] overflow-auto rounded-lg border border-outline-variant bg-surface-container-high p-3 text-sm text-on-surface shadow-lg">
        <strong class="mb-1 block">{{ label() }}</strong><app-entry-renderer [entry]="entry() ?? null" />
      </div>
    </ng-template>
  `,
})
export class ItemRuleTagComponent {
  readonly label = input.required<string>();
  readonly entry = input<Entry | null>();
  readonly mastery = input(false);
  readonly opened = signal(false);
}
