import { Component, ChangeDetectionStrategy, input, output, signal, effect, viewChild, ElementRef } from '@angular/core';
import { FeatureNotes } from '../models/character.model';

@Component({
  selector: 'app-feature-notes',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (localNotes().length > 0) {
        <div class="mt-4 border-t border-outline-variant pt-4">
      <div class="border border-outline-variant rounded-lg p-3 mb-2 bg-surface-variant">
        @for (group of localNotes(); track $index; let i = $index) {
          <div [class]="i < localNotes().length - 1 ? 'mb-3' : ''">
            @if (group.tag) {
              <div class="text-sm font-semibold text-on-surface mb-1">{{ group.tag }}</div>
            }
            <div class="flex flex-wrap gap-1 items-center">
              @for (note of group.notes; track $index; let j = $index) {
                @if (group.isEditable === true) {
                  <button
                    type="button"
                    (click)="removeNote(i, j)"
                    [attr.aria-label]="note + ', remove note'"
                    class="px-2 py-1 rounded text-xs bg-tertiary-container text-on-tertiary-container border border-tertiary hover:opacity-75 transition-opacity"
                  >
                    {{ note }} ✕
                  </button>
                } @else {
                  <span class="px-2 py-1 rounded text-xs bg-tertiary-container text-on-tertiary-container border border-tertiary">
                    {{ note }}
                  </span>
                }
              }
              @if (group.isEditable === true && addingGroupIndex() === i) {
                <input
                  #noteInput
                  type="text"
                  [value]="addingText()"
                  (input)="addingText.set($any($event.target).value)"
                  placeholder="Add note…"
                  [attr.aria-label]="(group.tag ?? 'Notes') + ', new note text'"
                  (keydown.enter)="confirmAdd()"
                  (keydown.escape)="cancelAdd()"
                  (blur)="confirmAdd()"
                  class="px-2 py-1 rounded text-xs bg-surface border border-primary text-on-surface focus:outline-none focus:ring-1 focus:ring-primary"
                />
              } @else if (group.isEditable === true) {
                <button
                  type="button"
                  (click)="startAdding(i)"
                  class="px-2 py-1 rounded text-xs font-semibold bg-surface-container text-on-surface-variant border border-outline-variant hover:bg-surface-container-high transition-colors"
                >
                  + Add
                </button>
              }
            </div>
          </div>
        }
      </div>
    
        </div>    }
    
  `,
})
export class FeatureNotesComponent {
  notes = input<FeatureNotes[] | undefined>();
  notesChanged = output<FeatureNotes[]>();

  localNotes = signal<FeatureNotes[]>([]);
  addingGroupIndex = signal<number | null>(null);
  addingText = signal('');

  private noteInputRef = viewChild<ElementRef>('noteInput');

  constructor() {
    effect(() => {
      const normalized = (this.notes() ?? []).map((group) => ({
        ...group,
        notes: Array.isArray(group.notes) ? group.notes : [],
        isEditable: group.isEditable ?? true,
      }));
      this.localNotes.set(normalized);
    });
  }

  startAdding(groupIndex: number): void {
    const group = this.localNotes()[groupIndex];
    if (!group || group.isEditable !== true) return;
    this.addingGroupIndex.set(groupIndex);
    this.addingText.set('');
    setTimeout(() => this.noteInputRef()?.nativeElement?.focus());
  }

  confirmAdd(): void {
    const text = this.addingText().trim();
    if (!text) {
      this.cancelAdd();
      return;
    }
    const groupIndex = this.addingGroupIndex();
    if (groupIndex === null) return;
    const group = this.localNotes()[groupIndex];
    if (!group || group.isEditable !== true) {
      this.cancelAdd();
      return;
    }
    const updated = this.localNotes().map((g, i) =>
      i === groupIndex ? { ...g, notes: [...(g.notes ?? []), text] } : g
    );
    this.localNotes.set(updated);
    this.notesChanged.emit(updated);
    this.addingText.set('');
    this.addingGroupIndex.set(null);
  }

  cancelAdd(): void {
    this.addingGroupIndex.set(null);
    this.addingText.set('');
  }

  removeNote(groupIndex: number, noteIndex: number): void {
    const group = this.localNotes()[groupIndex];
    if (!group || group.isEditable !== true) return;
    const updated = this.localNotes().map((g, i) => {
      if (i !== groupIndex) return g;
      return { ...g, notes: (g.notes ?? []).filter((_, j) => j !== noteIndex) };
    });
    this.localNotes.set(updated);
    this.notesChanged.emit(updated);
  }
}
