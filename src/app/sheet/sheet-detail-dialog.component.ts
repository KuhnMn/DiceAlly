import { afterNextRender, Component, ElementRef, inject, input, OnDestroy, output, viewChild } from '@angular/core';
import { DialogScrollLockService } from '../editor/dialog-scroll-lock.service';
import { UiIconComponent } from '../ui-icon.component';

let nextDialogId = 0;

/** Native modal supplies focus containment, Escape dismissal and an inert background. */
@Component({
  selector: 'app-sheet-detail-dialog',
  imports: [UiIconComponent],
  template: `
    <dialog #dialog (close)="dismiss()" (click)="backdrop($event)" [attr.aria-labelledby]="titleId"
      class="fixed inset-0 m-auto box-border max-h-[92dvh] w-[calc(100vw_-_1rem)] min-w-0 max-w-[min(48rem,calc(100vw_-_1rem))] overflow-hidden rounded-2xl border border-outline-variant bg-surface p-0 text-on-surface shadow-xl open:flex open:flex-col backdrop:bg-black/60">
      <header class="z-10 flex shrink-0 items-center justify-between gap-3 border-b border-outline-variant bg-surface px-4 py-2 sm:px-6">
        <h2 [id]="titleId" class="min-w-0 text-xl font-bold [overflow-wrap:anywhere]">{{ title() }}</h2>
        <button type="button" autofocus (click)="dialog.close()" aria-label="Close details" class="flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-lg bg-surface-container"><app-ui-icon name="close" /></button>
      </header>
      <div class="min-h-0 min-w-0 flex-1 space-y-4 overflow-auto overscroll-contain p-4 [overflow-wrap:anywhere] [&_img]:max-w-full [&_pre]:max-w-full [&_pre]:overflow-x-auto sm:p-6"><ng-content /></div>
    </dialog>
  `,
})
export class SheetDetailDialogComponent implements OnDestroy {
  readonly titleId = `sheet-detail-title-${nextDialogId++}`;
  readonly title = input.required<string>();
  readonly closed = output<void>();
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');
  private readonly lock = inject(DialogScrollLockService);
  private opener: HTMLElement | null = null;
  private locked = false;
  constructor() {
    afterNextRender(() => {
      this.opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      this.dialog().nativeElement.showModal();
      this.lock.lock();
      this.locked = true;
    });
  }
  dismiss() { this.release(); this.closed.emit(); }
  backdrop(event: MouseEvent) {
    const dialog = this.dialog().nativeElement;
    if (event.target !== dialog) return;
    const box = dialog.getBoundingClientRect();
    if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) dialog.close();
  }
  private release() {
    if (this.locked) { this.lock.unlock(); this.locked = false; }
    if (this.opener?.isConnected) this.opener.focus({ preventScroll: true });
    this.opener = null;
  }
  ngOnDestroy() { this.release(); }
}
