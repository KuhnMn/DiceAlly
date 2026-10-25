import { RecoveryIndicatorComponent } from '../recovery-indicator.component';
import { UiIconComponent } from '../ui-icon.component';
import { Component, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AnnotatedEntry, EntryAnnotationsEditor } from './entry-annotations-editor';
import { HorizontalRowDirective } from '../sheet/horizontal-row.directive';

@Component({
  selector: 'app-entry-annotations-editor',
  imports: [HorizontalRowDirective, RecoveryIndicatorComponent, UiIconComponent, FormsModule],
  templateUrl: './entry-annotations.component.html',
  styleUrls: ['./editor.css', './editor-annotations.css'],
  host: { class: 'block min-w-0' },
  styles: [`
    .annotation-panel { border: 1px solid var(--md-sys-color-outline-variant); border-radius: .5rem; padding: .5rem; margin-top: .5rem; }
    .annotation-panel .editor-input { min-height: 2rem; padding: .25rem .5rem; font-size: .8125rem; }
    .annotation-panel .field-label { margin-bottom: .125rem; font-size: .6875rem; }
    .annotation-button { display: inline-flex; align-items: center; justify-content: center; gap: .25rem; min-height: 2rem; padding: .25rem .5rem; border: 1px solid var(--md-sys-color-outline-variant); border-radius: .375rem; font-size: .75rem; }
    .annotation-remove { display: inline-flex; align-items: center; justify-content: center; width: 2rem; min-height: 2rem; flex-shrink: 0; border-radius: .375rem; }
  `],
})
export class EntryAnnotationsComponent extends EntryAnnotationsEditor {
  readonly entry = input.required<AnnotatedEntry>();
  readonly annotationsEnabled = input(true);
  readonly showUses = input(true);
  activePanel: 'uses' | 'notes' | null = null;
  togglePanel(panel: 'uses' | 'notes') { this.activePanel = this.activePanel === panel ? null : panel; }
  override addUses(entry: AnnotatedEntry) { super.addUses(entry); this.activePanel = 'uses'; }
  override addNote(entry: AnnotatedEntry) { super.addNote(entry); this.activePanel = 'notes'; }
  readonly edited = output<void>();
  readonly i = crypto.randomUUID();
  change() { this.edited.emit(); }
}
