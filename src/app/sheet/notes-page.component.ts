import { AppDialogService } from '../services/app-dialog.service';
import { UiIconComponent } from '../ui-icon.component';
import { Component, computed, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ExportedCharacter, Note } from '../models/character.model';
import { CharacterStore } from '../stores/character.store';
import { RemoveEntryDialogComponent } from '../editor/remove-entry-dialog.component';

@Component({
  selector: 'app-notes-page',
  imports: [UiIconComponent, FormsModule, RemoveEntryDialogComponent],
  templateUrl: './notes-page.component.html',
  styles: [`
    :host { display: block; min-width: 0; }
    input, textarea { font-size: 1rem; width: 100%; min-width: 0; padding: .5rem .625rem; border: 1px solid var(--md-sys-color-outline-variant); border-radius: .375rem; background: var(--md-sys-color-surface-container-low); color: var(--md-sys-color-on-surface); }
    input:focus-visible, textarea:focus-visible { outline: 2px solid var(--md-sys-color-primary); }
    button { cursor: pointer; }
    .markdown { overflow-wrap: anywhere; }
  `],
})
export class NotesPageComponent {
  readonly characterData = input.required<ExportedCharacter | null>();
  private readonly store = inject(CharacterStore);
  private readonly dialogs = inject(AppDialogService);
  readonly draft = this.store.noteDraft;
  readonly pendingRemoval = signal<Note | null>(null);
  readonly collapsed = signal(new Set<string>());
  readonly preview = signal(false);
  readonly sections = computed(() => {
    const groups = new Map<string, Note[]>();
    const sorted = [...this.characterData()?.notes ?? []].sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0));
    for (const note of sorted) {
      const title = note.title || 'Untitled';
      if (!groups.has(title)) groups.set(title, []);
      groups.get(title)!.push(note);
    }
    return [...groups].map(([title, entries]) => ({ title, entries }));
  });

  toggle(title: string) {
    this.collapsed.update(current => {
      const next = new Set(current);
      if (next.has(title)) next.delete(title); else next.add(title);
      return next;
    });
  }

  async add(title = '') {
    if (this.store.hasNoteDraftChanges() && !await this.canReplaceDraft()) return;
    const notes = this.characterData()?.notes ?? [];
    this.draft.set({ id: Math.max(0, ...notes.map(note => note.id)) + 1, title, body: '',
      orderIndex: Math.max(-1, ...notes.map(note => note.orderIndex ?? 0)) + 1 });
    this.preview.set(false);
  }

  async edit(note: Note) {
    if (this.store.hasNoteDraftChanges() && !await this.canReplaceDraft()) return;
    this.draft.set({ ...note }); this.preview.set(false);
  }
  private canReplaceDraft() {
    return !this.store.hasNoteDraftChanges() || this.dialogs.confirm('Discard the unfinished note draft?', 'Unfinished Note', 'Discard Draft');
  }
  updateDraft(field: 'title' | 'body', value: string) {
    const draft = this.draft();
    if (draft) this.draft.set({ ...draft, [field]: value });
  }

  apply() {
    const draft = this.draft();
    if (!draft) return;
    this.collapsed.update(current => { const next = new Set(current); next.delete(draft.title.trim() || 'Untitled'); return next; });
    this.store.applyNoteDraft();
  }

  remove() {
    const note = this.pendingRemoval();
    if (note) this.saveNotes((this.characterData()?.notes ?? []).filter(entry => entry.id !== note.id));
    this.pendingRemoval.set(null);
  }

  private saveNotes(notes: Note[]) {
    const character = this.characterData();
    if (!character) return;
    // Replace the sheet reference so grouping updates immediately and Quick Save exports the new notes.
    this.store.setCharacter({ ...character, notes });
  }

  parseMarkdown(markdown: string): string {
    // Simple markdown parsing to HTML
    let html = markdown
      // Escape HTML entities first to prevent XSS
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      // Parse markdown
      .replace(/^### (.*?)$/gm, '<h3 class="text-lg font-bold mt-4 mb-2">$1</h3>')
      .replace(/^## (.*?)$/gm, '<h2 class="text-xl font-bold mt-4 mb-2">$1</h2>')
      .replace(/^# (.*?)$/gm, '<h1 class="text-2xl font-bold mt-4 mb-2">$1</h1>')
      .replace(/\*\*(.*?)\*\*/g, '<strong class="font-bold">$1</strong>')
      .replace(/\*(.*?)\*/g, '<em class="italic">$1</em>')
      .replace(/\n\n+/g, '</p><p class="my-3">')
      .replace(/\n/g, '<br />');
    
    html = `<p class="my-2">${html}</p>`;
    return html;
  }
}
