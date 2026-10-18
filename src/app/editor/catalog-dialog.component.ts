import { Component, HostListener, OnDestroy, OnInit, inject, input, output } from '@angular/core';
import { A11yModule } from '@angular/cdk/a11y';
import { DialogScrollLockService } from './dialog-scroll-lock.service';

/** Catalog workspace shared by feature and spell editors. */
@Component({
  selector: 'app-catalog-dialog',
  imports: [A11yModule],
  template: `
    <button type="button" class="catalog-backdrop" tabindex="-1" aria-label="Close catalog"
      [disabled]="closeDisabled()" (click)="close()"></button>
    <section class="catalog-window" role="dialog" aria-modal="true" [attr.aria-label]="title()"
      cdkTrapFocus [cdkTrapFocusAutoCapture]="true">
      <header class="catalog-header">
        <div><h2>{{ title() }}</h2><p>{{ subtitle() }}</p></div>
        <button type="button" class="secondary-button" [disabled]="closeDisabled()" (click)="close()">{{ closeLabel() }}</button>
      </header>
      <div class="catalog-body feature-editor"><ng-content /></div>
      <div class="catalog-footer"><ng-content select="[catalog-footer]" /></div>
    </section>
  `,
  styleUrl: './editor.css',
  styles: [`
    :host { position: fixed; inset: 0; z-index: 1000; display: grid; place-items: center; padding: 1rem; }
    .catalog-backdrop { position: absolute; inset: 0; background: rgb(0 0 0 / .55); cursor: default; }
    .catalog-window { position: relative; width: min(100%, 56rem); max-height: calc(100dvh - 2rem); display: flex; flex-direction: column; overflow: hidden; border: 2px solid var(--md-sys-color-outline-variant); border-radius: .5rem; background: var(--md-sys-color-surface-container-low); color: var(--md-sys-color-on-surface); box-shadow: 0 1rem 3rem rgb(0 0 0 / .3); }
    .catalog-header { display: flex; align-items: center; justify-content: space-between; gap: 1rem; padding: 1rem; border-bottom: 2px solid var(--md-sys-color-outline-variant); background: var(--md-sys-color-surface-container); }
    .catalog-header h2 { font-size: 1.125rem; font-weight: 700; color: var(--md-sys-color-primary); }
    .catalog-header p { font-size: .75rem; color: var(--md-sys-color-on-surface-variant); margin-top: .25rem; }
    .catalog-body { padding: 1rem; overflow-y: auto; overscroll-behavior: contain; }
    .catalog-footer:not(:empty) { padding: .75rem 1rem; border-top: 2px solid var(--md-sys-color-outline-variant); background: var(--md-sys-color-surface-container); }
    @media (max-width: 600px) {
      :host { padding: 0; }
      .catalog-window { width: 100%; max-height: 100dvh; height: 100dvh; border-radius: 0; }
    }
  `],
})
export class CatalogDialogComponent implements OnInit, OnDestroy {
  readonly title = input.required<string>();
  readonly closeLabel = input('Close');
  readonly subtitle = input('Add entries, then return to your character.');
  readonly closeDisabled = input(false);
  readonly closed = output<void>();
  private readonly scrollLock = inject(DialogScrollLockService);

  ngOnInit() {
    this.scrollLock.lock();
  }
  ngOnDestroy() { this.scrollLock.unlock(); }
  close() { if (!this.closeDisabled()) this.closed.emit(); }

  @HostListener('keydown', ['$event']) keydown(event: KeyboardEvent) {
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); this.close(); }
    // Searching must not implicitly submit the surrounding character form.
    if (event.key === 'Enter' && (event.target as HTMLElement)?.tagName === 'INPUT') event.preventDefault();
  }
}
