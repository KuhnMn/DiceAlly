import { Component, ElementRef, OnDestroy, OnInit, afterNextRender, inject, input, viewChild } from '@angular/core';
import { A11yModule } from '@angular/cdk/a11y';
import { AppDialogRequest, AppDialogService } from './services/app-dialog.service';
import { DialogScrollLockService } from './editor/dialog-scroll-lock.service';

@Component({
  selector: 'app-dialog',
  imports: [A11yModule],
  styleUrl: './editor/editor.css',
  template: `
    <dialog #modal class="fixed inset-0 m-0 h-full max-h-none w-full max-w-none border-0 bg-transparent p-4 text-on-surface open:grid place-items-center backdrop:bg-black/55" (click)="dismiss()" (cancel)="escape($event)">
      <section role="alertdialog" aria-modal="true" aria-labelledby="app-dialog-title" aria-describedby="app-dialog-message"
        cdkTrapFocus [cdkTrapFocusAutoCapture]="true" (click)="$event.stopPropagation()"
        class="w-full max-w-md rounded-lg border-2 border-outline-variant bg-surface-container p-4 shadow-xl">
        <h2 id="app-dialog-title" class="text-base font-bold text-primary">{{ request().title }}</h2>
        <p id="app-dialog-message" class="text-sm mt-2 whitespace-pre-line break-words">{{ request().message }}</p>
        @if (request().copyValue; as value) {
          <textarea readonly aria-label="Value to copy" class="editor-input mt-3" rows="3" [value]="value" (focus)="select($event)"></textarea>
        }
        <footer class="flex flex-wrap justify-end gap-2 mt-4">
          @if (request().cancellable || request().secondaryLabel) {
            <button type="button" class="secondary-button" [attr.cdkFocusInitial]="request().secondaryLabel ? null : ''" (click)="dialogs.finish(false)">{{ request().secondaryLabel || 'Cancel' }}</button>
          }
          <button type="button" class="action-button" [attr.autofocus]="request().secondaryLabel ? '' : null" [attr.cdkFocusInitial]="request().secondaryLabel ? '' : null" (click)="dialogs.finish(true)">{{ request().confirmLabel }}</button>
        </footer>
      </section>
    </dialog>
  `,
})
export class AppDialogComponent implements OnInit, OnDestroy {
  readonly request = input.required<AppDialogRequest>();
  readonly dialogs = inject(AppDialogService);
  private readonly scrollLock = inject(DialogScrollLockService);
  private readonly modal = viewChild.required<ElementRef<HTMLDialogElement>>('modal');
  constructor() {
    afterNextRender(() => this.modal().nativeElement.showModal());
  }
  ngOnInit() { this.scrollLock.lock(); }
  ngOnDestroy() { this.modal().nativeElement.close(); this.scrollLock.unlock(); }
  select(event: Event) { (event.target as HTMLTextAreaElement).select(); }
  dismiss() { this.dialogs.finish(!this.request().cancellable); }
  escape(event: Event) {
    event.preventDefault(); event.stopPropagation(); this.dismiss();
  }
}
