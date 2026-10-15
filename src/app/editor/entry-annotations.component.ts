import { UiIconComponent } from '../ui-icon.component';
import { Component, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AnnotatedEntry, EntryAnnotationsEditor } from './entry-annotations-editor';

@Component({
  selector: 'app-entry-annotations-editor',
  imports: [UiIconComponent, FormsModule],
  templateUrl: './entry-annotations.component.html',
  styleUrl: './local-editor.component.css',
  host: { class: 'block space-y-3' },
})
export class EntryAnnotationsComponent extends EntryAnnotationsEditor {
  readonly entry = input.required<AnnotatedEntry>();
  readonly edited = output<void>();
  readonly i = crypto.randomUUID();
  change() { this.edited.emit(); }
}
