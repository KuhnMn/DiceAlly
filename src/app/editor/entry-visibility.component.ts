import { Component, input, output } from '@angular/core';
import { ViewerEntryVisibility } from '../models/entry-visibility';
import { UiIconComponent } from '../ui-icon.component';

@Component({
  selector: 'button[appEntryVisibility]',
  imports: [UiIconComponent],
  host: {
    type: 'button',
    '[attr.aria-label]': "hidden() ? 'Show in viewer' : 'Hide in viewer'",
    '[attr.title]': "hidden() ? 'Hidden in viewer: Click to show' : 'Visible in viewer: Click to hide'",
    '[attr.aria-pressed]': 'hidden()',
    '[class.bg-secondary-container]': 'hidden()',
    '(click)': 'toggle($event)',
  },
  template: `<app-ui-icon [name]="hidden() ? 'eye-off' : 'eye'" />`,
})
export class EntryVisibilityComponent {
  readonly entries = input.required<readonly ViewerEntryVisibility[]>();
  readonly edited = output<void>();
  hidden() { return this.entries().length > 0 && this.entries().every(entry => entry.hidden === true); }
  toggle(event: Event) {
    event.stopPropagation();
    const hidden = !this.hidden();
    for (const entry of this.entries()) {
      if (hidden) entry.hidden = true;
      else delete entry.hidden;
    }
    this.edited.emit();
  }
}
