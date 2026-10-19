import { Component, input } from '@angular/core';
import { UiIconComponent } from './ui-icon.component';
import { CatalogDialogComponent } from './editor/catalog-dialog.component';

/** Short contextual guidance without adding permanent explanatory text to the page. */
@Component({
  selector: 'app-info-button',
  imports: [UiIconComponent, CatalogDialogComponent],
  host: { class: 'inline-flex shrink-0 align-middle' },
  template: `
    <button type="button" class="info-button" [attr.aria-label]="'About ' + title()" [title]="'About ' + title()" aria-haspopup="dialog" [attr.aria-expanded]="open" (click)="open = true"><app-ui-icon name="info" /></button>
    @if (open) {
      <app-catalog-dialog [title]="title()" subtitle="" [compact]="true" (closed)="open = false">
        <div class="space-y-3 text-sm leading-relaxed"><ng-content /></div>
      </app-catalog-dialog>
    }
  `,
  styles: [`.info-button { display: grid; place-items: center; width: 2rem; height: 2rem; padding: 0; border-radius: 50%; color: var(--md-sys-color-on-surface-variant); font-size: 1rem; cursor: pointer; }
    .info-button:hover { background: var(--md-sys-color-surface-container-highest); color: var(--md-sys-color-primary); }
    .info-button:focus-visible { outline: 2px solid var(--md-sys-color-primary); outline-offset: 2px; }`],
})
export class InfoButtonComponent {
  readonly title = input.required<string>();
  open = false;
}
