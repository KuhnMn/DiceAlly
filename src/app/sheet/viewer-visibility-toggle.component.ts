import { Component, model } from '@angular/core';
import { UiIconComponent } from '../ui-icon.component';

/** Reveal hidden entries for browsing without changing their saved visibility. */
@Component({
  selector: 'app-viewer-visibility-toggle',
  imports: [UiIconComponent],
  host: { class: 'inline-flex shrink-0' },
  template: `
    <button type="button" aria-label="Show hidden entries" [attr.aria-pressed]="showHidden()"
      [title]="showHidden() ? 'Hide hidden entries' : 'Show hidden entries'" (click)="showHidden.set(!showHidden())"
      [class.bg-primary-container]="showHidden()" [class.text-on-primary-container]="showHidden()"
      class="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-outline-variant text-sm focus-visible:outline-2 focus-visible:outline-primary">
      <app-ui-icon [name]="showHidden() ? 'eye' : 'eye-off'" />
    </button>
  `,
})
export class ViewerVisibilityToggleComponent {
  readonly showHidden = model(false);
}
