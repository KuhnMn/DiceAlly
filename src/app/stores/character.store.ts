import { Injectable, signal } from '@angular/core';
import { ExportedCharacter, Note } from '../models/character.model';

@Injectable({ providedIn: 'root' })
export class CharacterStore {
  readonly noteDraft = signal<Note | null>(null);
  hasNoteDraftChanges(): boolean {
    const draft = this.noteDraft();
    if (!draft) return false;
    const original = this.characterData()?.notes?.find(note => note.id === draft.id);
    return original ? JSON.stringify(original) !== JSON.stringify(draft) : !!(draft.title.trim() || draft.body.trim());
  }
  applyNoteDraft() {
    const draft = this.noteDraft(), sheet = this.characterData();
    if (!draft || !sheet) return;
    if (this.hasNoteDraftChanges()) {
      const note = { ...draft, title: draft.title.trim() || 'Untitled' };
      const notes = sheet.notes ?? [];
      this.setCharacter({ ...sheet, notes: notes.some(entry => entry.id === note.id)
        ? notes.map(entry => entry.id === note.id ? note : entry) : [...notes, note] });
    }
    this.noteDraft.set(null);
  }
  readonly characterData = signal<ExportedCharacter | null>(null);
  readonly featureScrollTarget = signal<string | null>(null);
  readonly nativeCharacterId = signal<string | null>(null);
  nativeSave?: (sheet: ExportedCharacter) => Promise<void>;
  nativeRest?: (sheet: ExportedCharacter, rest: 'short' | 'long') => ExportedCharacter;
  clearNativeContext() {
    this.noteDraft.set(null);
    this.nativeCharacterId.set(null); this.nativeSave = undefined; this.nativeRest = undefined;
  }

  setCharacter(data: ExportedCharacter | null) {
    if (data?.character?.characterUuid !== this.characterData()?.character?.characterUuid) this.noteDraft.set(null);
    if (data?.character?.characterUuid !== this.nativeCharacterId()) {
      this.nativeCharacterId.set(null);
      this.nativeSave = undefined;
      this.nativeRest = undefined;
    }
    this.characterData.set(data);
  }

  setFeatureScrollTarget(targetId: string | null) {
    this.featureScrollTarget.set(targetId);
  }
}
