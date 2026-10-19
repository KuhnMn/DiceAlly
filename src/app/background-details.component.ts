import { Component, input } from '@angular/core';
import { Background } from './models/character.model';
import { CatalogDialogComponent } from './editor/catalog-dialog.component';
import { EntryRendererComponent } from './entries/entry-renderer.component';

/** Library backgrounds can be inspected; name-only custom backgrounds remain plain text. */
@Component({
  selector: 'app-background-details',
  imports: [CatalogDialogComponent, EntryRendererComponent],
  host: { class: 'inline' },
  template: `
    @if (background(); as value) {
      @if (value.entity) {
        <button type="button" class="min-h-8 text-primary underline" aria-haspopup="dialog" [attr.aria-label]="'View background ' + value.name" (click)="open = true">{{ label() || value.name }}</button>
        @if (open) {
          <app-catalog-dialog [title]="value.name" [subtitle]="value.source || ''" [compact]="true" (closed)="open = false"><app-entry-renderer [entries]="value.entity.entries ?? []" /></app-catalog-dialog>
        }
      } @else { <span>{{ value.name }}</span> }
    }
  `,
})
export class BackgroundDetailsComponent {
  readonly background = input<Background>();
  readonly label = input('');
  open = false;
}
