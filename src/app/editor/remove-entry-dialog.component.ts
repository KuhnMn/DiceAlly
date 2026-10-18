import { Component, HostListener, OnDestroy, OnInit, inject, input, output } from '@angular/core';
import { A11yModule } from '@angular/cdk/a11y';
import { DialogScrollLockService } from './dialog-scroll-lock.service';

/** Confirm deletion without leaving the editor's visual and keyboard conventions. */
@Component({
  selector: 'app-remove-entry-dialog',
  imports: [A11yModule],
  template: `
    <button class="backdrop" type="button" tabindex="-1" aria-label="Cancel removal" (click)="cancelled.emit()"></button>
    <section role="alertdialog" aria-modal="true" aria-labelledby="remove-entry-title" aria-describedby="remove-entry-message"
      cdkTrapFocus [cdkTrapFocusAutoCapture]="true">
      <h2 id="remove-entry-title">{{ action() }} {{ name() }}?</h2>
      <p id="remove-entry-message">{{ message() }}</p>
      <footer>
        <button type="button" class="secondary-button" cdkFocusInitial (click)="cancelled.emit()">Cancel</button>
        <button type="button" class="secondary-button remove-button" (click)="confirmed.emit()">{{ action() }}</button>
      </footer>
    </section>
  `,
  styleUrl: './editor.css',
  styles: [`
    :host { position: fixed; inset: 0; z-index: 1100; display: grid; place-items: center; padding: 1rem; }
    .backdrop { position: absolute; inset: 0; background: rgb(0 0 0 / .55); }
    section { position: relative; width: min(100%, 26rem); padding: 1rem; border: 2px solid var(--md-sys-color-outline-variant); border-radius: .5rem; background: var(--md-sys-color-surface-container); color: var(--md-sys-color-on-surface); box-shadow: 0 1rem 3rem rgb(0 0 0 / .3); overflow-wrap: anywhere; }
    h2 { font-size: 1rem; font-weight: 700; color: var(--md-sys-color-primary); }
    p { margin-top: .5rem; font-size: .875rem; color: var(--md-sys-color-on-surface-variant); }
    footer { display: flex; justify-content: flex-end; flex-wrap: wrap; gap: .5rem; margin-top: 1rem; }
    .remove-button { color: var(--md-sys-color-on-error-container); background: var(--md-sys-color-error-container); border-color: var(--md-sys-color-error); }
    .remove-button:hover { background: var(--md-sys-color-error); color: var(--md-sys-color-on-error); }
  `],
})
export class RemoveEntryDialogComponent implements OnInit, OnDestroy {
  readonly name = input.required<string>();
  readonly action = input('Remove');
  readonly message = input('Its notes and use settings will also be deleted.');
  readonly confirmed = output<void>();
  readonly cancelled = output<void>();
  private readonly scrollLock = inject(DialogScrollLockService);

  ngOnInit() { this.scrollLock.lock(); }
  ngOnDestroy() { this.scrollLock.unlock(); }

  @HostListener('keydown', ['$event']) keydown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      event.preventDefault(); event.stopPropagation(); this.cancelled.emit();
    }
  }
}
