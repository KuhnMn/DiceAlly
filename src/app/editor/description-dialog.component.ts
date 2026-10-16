import { Component, input, signal } from '@angular/core';
import { SheetDetailDialogComponent } from '../sheet/sheet-detail-dialog.component';
import { UiIconComponent } from '../ui-icon.component';

/** Reference descriptions share the viewer's modal; editing controls stay in their forms. */
@Component({
  selector: 'app-description-dialog',
  imports: [SheetDetailDialogComponent, UiIconComponent],
  host: { class: 'block min-w-0' },
  template: `
    <button type="button" (click)="open.set(true)" aria-haspopup="dialog" class="inline-flex min-h-10 items-center gap-2 rounded-lg border border-outline-variant bg-surface-container px-3 py-2 text-sm font-semibold text-primary hover:bg-surface-container-high focus-visible:outline-2 focus-visible:outline-primary"><app-ui-icon name="info" /> {{ label() }} <app-ui-icon name="chevron" /></button>
    @if (open()) {
      <app-sheet-detail-dialog [title]="title()" (closed)="open.set(false)"><ng-content /></app-sheet-detail-dialog>
    }
  `,
})
export class DescriptionDialogComponent {
  readonly title = input('Description');
  readonly label = input('Description');
  readonly open = signal(false);
}
