import { Directive, ElementRef, ViewChild } from '@angular/core';
import { FeatureNotes, FeatureUses } from '../models/character.model';
import { SLOT_RECOVERY } from './spell-slots.component';
export interface AnnotatedEntry { notes?: FeatureNotes[]; uses?: FeatureUses[]; }

/** Shared note and use editing behavior for features and prepared spells. */
@Directive()
export abstract class EntryAnnotationsEditor {
  readonly recoveryOptions = SLOT_RECOVERY;
  abstract change(): void;
  editingNoteGroup?: FeatureNotes;
  editingNoteIndex = 0;
  noteDraft = '';
  @ViewChild('noteEditor') set noteEditor(element: ElementRef<HTMLTextAreaElement> | undefined) { element?.nativeElement.focus(); }
  noteKeydown(event: Event) {
    const keyboard = event as KeyboardEvent;
    if (keyboard.key === 'Escape') { event.preventDefault(); this.cancelNote(); }
    else if (keyboard.key === 'Enter' && !keyboard.shiftKey) { event.preventDefault(); this.commitNote(); }
  }

  addNote(feature: AnnotatedEntry) { (feature.notes ??= []).push({ tag: 'Notes', notes: [], isEditable: true }); this.change(); }
  addNoteEntry(group: FeatureNotes) { this.editNoteEntry(group, group.notes.length); }
  editNoteEntry(group: FeatureNotes, index: number) {
    this.commitNote(); this.editingNoteGroup = group; this.editingNoteIndex = index; this.noteDraft = group.notes[index] ?? '';
  }
  commitNote() {
    const group = this.editingNoteGroup; const text = this.noteDraft.trim();
    if (group && text) {
      this.setNoteEntry(group, this.editingNoteIndex, text);
    }
    this.cancelNote();
  }
  cancelNote() { this.editingNoteGroup = undefined; this.noteDraft = ''; }
  setNoteEntry(group: FeatureNotes, index: number, value: string) { group.notes[index] = value; this.change(); }
  removeNoteEntry(group: FeatureNotes, index: number) { this.cancelNote(); group.notes.splice(index, 1); this.change(); }
  removeNote(feature: AnnotatedEntry, index: number) { feature.notes!.splice(index, 1); this.change(); }
  addUses(feature: AnnotatedEntry) { (feature.uses ??= []).push({ tag: 'Uses', totalFreeUses: 1, usedFreeUses: 0, freeUsesRegainCondition: 'LONG_REST', userAdded: true }); this.change(); }
  removeUses(feature: AnnotatedEntry, index: number) { feature.uses!.splice(index, 1); this.change(); }
}
