import { Directive, ElementRef, ViewChild } from '@angular/core';
import { FeatureNotes, FeatureUses } from '../models/character.model';
import { RECOVERY_OPTIONS } from './recovery-options';
export interface AnnotatedEntry {
  notes?: FeatureNotes[];
  uses?: FeatureUses[];
}

/** One editing model for features, species, spells and monsters; annotations remain ordinary sheet data. */
@Directive()
export abstract class EntryAnnotationsEditor {
  readonly recoveryOptions = RECOVERY_OPTIONS;
  abstract change(): void;
  editingNoteGroup?: FeatureNotes;
  editingNoteIndex = 0;
  noteDraft = '';
  @ViewChild('noteEditor') set noteEditor(element: ElementRef<HTMLTextAreaElement> | undefined) {
    element?.nativeElement.focus();
  }

  /** Enter commits, Shift+Enter inserts a newline, and Escape discards the draft. */
  noteKeydown(event: Event) {
    const keyboard = event as KeyboardEvent;
    if (keyboard.key === 'Escape') {
      event.preventDefault(); this.cancelNote();
    } else if (keyboard.key === 'Enter' && !keyboard.shiftKey) {
      event.preventDefault(); this.commitNote();
    }
  }

  addNote(entry: AnnotatedEntry) {
    (entry.notes ??= []).push({ tag: 'Notes', notes: [], isEditable: true });
    this.change();
  }

  addNoteEntry(group: FeatureNotes) {
    this.editNoteEntry(group, group.notes.length);
  }

  editNoteEntry(group: FeatureNotes, index: number) {
    this.commitNote();
    this.editingNoteGroup = group;
    this.editingNoteIndex = index;
    this.noteDraft = group.notes[index] ?? '';
  }

  commitNote() {
    const group = this.editingNoteGroup;
    const text = this.noteDraft.trim();
    if (group && text) {
      this.setNoteEntry(group, this.editingNoteIndex, text);
    }
    this.cancelNote();
  }
  cancelNote() {
    this.editingNoteGroup = undefined;
    this.noteDraft = '';
  }

  setNoteEntry(group: FeatureNotes, index: number, value: string) {
    group.notes[index] = value;
    this.change();
  }

  removeNoteEntry(group: FeatureNotes, index: number) {
    this.cancelNote();
    group.notes.splice(index, 1);
    this.change();
  }

  removeNote(entry: AnnotatedEntry, index: number) {
    entry.notes!.splice(index, 1);
    this.change();
  }

  addUses(entry: AnnotatedEntry) {
    (entry.uses ??= []).push({
      tag: 'Uses', totalFreeUses: 1, usedFreeUses: 0,
      freeUsesRegainCondition: 'LONG_REST', userAdded: true,
    });
    this.change();
  }

  removeUses(entry: AnnotatedEntry, index: number) {
    entry.uses!.splice(index, 1);
    this.change();
  }
}
