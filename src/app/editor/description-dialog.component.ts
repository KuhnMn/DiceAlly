import { Component, input, signal, TemplateRef } from '@angular/core';
import { SheetDetailDialogComponent } from '../sheet/sheet-detail-dialog.component';
import { UiIconComponent } from '../ui-icon.component';

/** Reference descriptions share the viewer's modal; editing controls stay in their forms. */
@Component({
  selector: 'app-description-dialog',
  imports: [SheetDetailDialogComponent, UiIconComponent],
  host: { class: 'block min-w-0' },
  template: `
    <button type="button" (click)="open.set(true)" aria-haspopup="dialog" [attr.aria-label]="compact() ? 'View ' + label().toLowerCase() + ' for ' + title() : null" [title]="compact() ? 'View ' + label().toLowerCase() + ' for ' + title() : ''"
      [class.dense-description]="dense()"
      [class]="compact() ? 'stretched-description flex h-full min-h-10 w-8 items-center justify-center rounded text-base text-primary focus-visible:outline-2 focus-visible:outline-primary' : 'inline-flex min-h-10 items-center gap-2 rounded-lg border border-outline-variant bg-surface-container px-3 py-2 text-sm font-semibold text-primary hover:bg-surface-container-high focus-visible:outline-2 focus-visible:outline-primary'">
      @if (!compact()) { <app-ui-icon name="info" /> {{ label() }} }
      <app-ui-icon name="chevron" />
    </button>
    @if (open()) {
      <app-sheet-detail-dialog [title]="title()" [tags]="tags()" (closed)="open.set(false)"><ng-content /></app-sheet-detail-dialog>
    }
  `,
  styles: [`
    .dense-description { min-height: 2rem; padding: .25rem .5rem; font-size: .75rem; gap: .25rem; }
    .stretched-description::after { content: ''; position: absolute; inset: 0; border-radius: .375rem; cursor: pointer; }
    .stretched-description:hover::after { background: color-mix(in srgb, var(--md-sys-color-on-surface) 4%, transparent); }
    .stretched-description:focus-visible::after { outline: 2px solid var(--md-sys-color-primary); outline-offset: -2px; }
  `],
})
export class DescriptionDialogComponent {
  readonly title = input('Description');
  readonly label = input('Description');
  readonly compact = input(false);
  readonly dense = input(false);
  readonly tags = input<TemplateRef<unknown> | null>(null);
  readonly open = signal(false);
}
