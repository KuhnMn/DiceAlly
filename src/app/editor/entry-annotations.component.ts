import { Component, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { FeatureEntryFull } from '../models/character.model';
import { EntryAnnotationsEditor } from './entry-annotations-editor';

@Component({
  selector: 'app-entry-annotations-editor',
  imports: [FormsModule],
  templateUrl: './entry-annotations.component.html',
  styleUrl: './local-editor.component.css',
  host: { class: 'block space-y-3' },
})
export class EntryAnnotationsComponent extends EntryAnnotationsEditor {
  readonly entry = input.required<FeatureEntryFull>();
  readonly edited = output<void>();
  readonly i = crypto.randomUUID();
  change() { this.edited.emit(); }
}
