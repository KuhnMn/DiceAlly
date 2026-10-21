import { Component, DestroyRef, inject, input, signal } from '@angular/core';
import { OverlayModule, ConnectedPosition } from '@angular/cdk/overlay';
import { RuleDescriptionSnapshot } from '../models/character-references';
import { EntryRendererComponent } from '../entries/entry-renderer.component';
import { SheetDetailDialogComponent } from './sheet-detail-dialog.component';
import { UiIconComponent } from '../ui-icon.component';

let nextReferenceId = 0;

/** Hover/focus reference on desktop; a separate info action opens a mobile dialog. */
@Component({
  selector: 'app-rule-reference',
  imports: [OverlayModule, EntryRendererComponent, SheetDetailDialogComponent, UiIconComponent],
  host: { class: 'inline-flex min-w-0 max-w-full', '[class.w-full]': "appearance() === 'row'" },
  template: `
    <span cdkOverlayOrigin #origin="cdkOverlayOrigin" class="inline-flex min-w-0 max-w-full items-center gap-1 rounded focus-visible:outline-2 focus-visible:outline-primary"
      [class]="appearance() === 'tag' ? 'min-h-9 rounded-lg border border-primary/40 bg-primary-container py-0.5 pl-2.5 pr-0.5 text-on-primary-container' : appearance() === 'row' ? 'w-full rounded-lg border border-outline-variant bg-surface-container-low px-2 hover:bg-surface-container' : ''"
      (keydown.escape)="close(); $event.stopPropagation()">
      <ng-content />
      @if (reference()?.entries?.length) {
        <button type="button" (mouseenter)="show()" (mouseleave)="scheduleClose()" (focus)="show()" (blur)="scheduleClose()" (click)="desktop() ? show() : dialogOpen.set(true); $event.stopPropagation()" [attr.aria-label]="'About ' + reference()!.name" [attr.aria-haspopup]="desktop() ? null : 'dialog'" [attr.aria-describedby]="desktop() && opened() ? tooltipId : null" class="inline-flex shrink-0 items-center justify-center rounded-full focus-visible:outline-2 focus-visible:outline-primary" [class.text-on-surface-variant]="appearance() !== 'tag'" [class.text-on-primary-container]="appearance() === 'tag'" [class.hover:bg-primary/15]="appearance() === 'tag'" [class.hover:bg-surface-container-high]="appearance() !== 'tag'" [class]="appearance() === 'tag' ? 'h-7 w-7 text-xs' : desktop() ? 'h-5 w-5 text-xs' : 'h-8 w-8'"><app-ui-icon name="info" /></button>
      }
      <ng-content select="[reference-actions]" />
    </span>
    <ng-template cdkConnectedOverlay [cdkConnectedOverlayOrigin]="origin" [cdkConnectedOverlayOpen]="opened() && desktop() && !!reference()?.entries?.length"
      [cdkConnectedOverlayPositions]="positions" [cdkConnectedOverlayPush]="true" [cdkConnectedOverlayViewportMargin]="12" (overlayOutsideClick)="close()" (overlayKeydown)="overlayKey($event)">
      <div role="tooltip" [id]="tooltipId" tabindex="0" (mouseenter)="keepOpen()" (mouseleave)="scheduleClose()" (focusin)="keepOpen()" (focusout)="scheduleClose()"
        class="max-h-[55dvh] w-96 max-w-[calc(100vw-1.5rem)] overflow-auto overscroll-contain rounded-lg border border-outline-variant bg-surface-container-high p-3 text-sm text-on-surface shadow-lg">
        <div class="mb-2 flex items-center gap-2"><strong>{{ reference()?.name }}</strong><span class="rounded bg-surface-container-highest px-1.5 py-0.5 text-xs">{{ reference()?.source }}</span></div>
        <app-entry-renderer [entries]="reference()?.entries ?? []" />
      </div>
    </ng-template>
    @if (dialogOpen() && reference(); as definition) {
      <app-sheet-detail-dialog [title]="definition.name" [tags]="sourceTag" (closed)="dialogOpen.set(false)">
        <ng-template #sourceTag><span class="rounded bg-surface-container-highest px-1.5 py-0.5 text-xs">{{ definition.source }}</span></ng-template>
        <app-entry-renderer [entries]="definition.entries" />
      </app-sheet-detail-dialog>
    }
  `,
})
export class RuleReferenceComponent {
  readonly reference = input<RuleDescriptionSnapshot>();
  readonly appearance = input<'plain' | 'tag' | 'row'>('plain');
  readonly desktop = signal(false);
  readonly opened = signal(false);
  readonly dialogOpen = signal(false);
  readonly tooltipId = `rule-reference-${nextReferenceId++}`;
  readonly positions: ConnectedPosition[] = [
    { originX: 'end', originY: 'bottom', overlayX: 'start', overlayY: 'top', offsetX: 8, offsetY: 4 },
    { originX: 'start', originY: 'top', overlayX: 'end', overlayY: 'bottom', offsetX: -8, offsetY: -4 },
  ];
  private closeTimer?: ReturnType<typeof setTimeout>;
  constructor() {
    const destroy = inject(DestroyRef);
    const media = typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia('(min-width: 768px) and (hover: hover) and (pointer: fine)') : undefined;
    const changed = () => { this.desktop.set(media?.matches ?? false); this.close(); };
    changed(); media?.addEventListener('change', changed);
    destroy.onDestroy(() => { media?.removeEventListener('change', changed); this.close(); });
  }
  show() { if (this.desktop() && this.reference()?.entries.length) this.keepOpen(); }
  keepOpen() { clearTimeout(this.closeTimer); this.opened.set(true); }
  scheduleClose() { clearTimeout(this.closeTimer); this.closeTimer = setTimeout(() => this.opened.set(false), 120); }
  close() { clearTimeout(this.closeTimer); this.opened.set(false); }
  overlayKey(event: KeyboardEvent) { if (event.key === 'Escape') { this.close(); event.stopPropagation(); } }
}
