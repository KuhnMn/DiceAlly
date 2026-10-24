import { Component, input, output, signal } from '@angular/core';
import { ExportedCharacter, Note } from '../models/character.model';
import { UiIconComponent } from '../ui-icon.component';
import { RemoveEntryDialogComponent } from './remove-entry-dialog.component';

@Component({
  selector: 'app-editor-notes',
  imports: [UiIconComponent, RemoveEntryDialogComponent],
  host: { class: 'block min-w-0' },
  styleUrl: './editor.css',
  template: `
    <section class="editor-card" aria-labelledby="editor-notes-title">
      <div class="mb-3 flex items-center justify-between gap-2">
        <h2 id="editor-notes-title" class="!mb-0">Notes</h2>
        <button type="button" class="secondary-button inline-flex items-center gap-1" (click)="add()"><app-ui-icon name="plus" /> Add Note</button>
      </div>
      <p class="mb-4 text-sm text-on-surface-variant">Notes remain editable here even when their sheet page is hidden. Save the character to keep your changes.</p>
      <div class="space-y-3">
        @for (note of sheet().notes ?? []; track note.id) {
          <div class="min-w-0 rounded-lg border border-outline-variant bg-surface-container p-3">
            <div class="mb-2 flex items-end gap-2">
              <label class="min-w-0 flex-1"><span class="field-label">Title</span><input class="editor-input !text-base" [value]="note.title" (input)="update(note, 'title', $any($event.target).value)" /></label>
              <button type="button" class="secondary-button shrink-0" [attr.aria-label]="'Remove note ' + (note.title || 'Untitled')" (click)="pendingRemoval.set(note)"><app-ui-icon name="trash" /></button>
            </div>
            <label class="block"><span class="field-label">Text (Markdown supported)</span><textarea rows="5" class="editor-input !text-base" [value]="note.body" (input)="update(note, 'body', $any($event.target).value)"></textarea></label>
          </div>
        } @empty {
          <p class="text-sm text-on-surface-variant">No notes yet.</p>
        }
      </div>
    </section>
    @if (pendingRemoval(); as note) {
      <app-remove-entry-dialog [name]="note.title || 'Untitled'" message="This note will be deleted when you save the character." (confirmed)="remove()" (cancelled)="pendingRemoval.set(null)" />
    }
  `,
})
export class NotesEditorComponent {
  readonly sheet = input.required<ExportedCharacter>();
  readonly edited = output<void>();
  readonly pendingRemoval = signal<Note | null>(null);
  add() {
    const sheet = this.sheet(), notes = sheet.notes ?? [];
    sheet.notes = [...notes, { id: Math.max(0, ...notes.map(note => note.id)) + 1, title: '', body: '',
      orderIndex: Math.max(-1, ...notes.map(note => note.orderIndex ?? 0)) + 1 }];
    this.edited.emit();
  }
  update(note: Note, field: 'title' | 'body', value: string) { note[field] = value; this.edited.emit(); }
  remove() {
    const note = this.pendingRemoval();
    if (note) { this.sheet().notes = (this.sheet().notes ?? []).filter(entry => entry.id !== note.id); this.edited.emit(); }
    this.pendingRemoval.set(null);
  }
}
