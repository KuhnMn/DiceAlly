import { AppDialogService } from '../services/app-dialog.service';
import { Injectable, inject } from '@angular/core';
import { CanDeactivateFn } from '@angular/router';
import { CharacterStore } from '../stores/character.store';

@Injectable({
  providedIn: 'root',
})
export class UnsavedChangesGuard {
  private readonly store = inject(CharacterStore);
  private lastSavedState: string = '';

  setLastSavedState(data: any): void {
    this.lastSavedState = JSON.stringify(data);
  }

  hasUnsavedChanges(data: any): boolean {
    if (!data) return false;
    return this.store.hasNoteDraftChanges() || JSON.stringify(data) !== this.lastSavedState;
  }

  resetGuard(): void {
    this.lastSavedState = '';
  }
}

export const canDeactivateCharacterSheet: CanDeactivateFn<any> = () => {
  const guard = inject(UnsavedChangesGuard);
  const store = inject(CharacterStore);
  const characterData = store.characterData();

  // If no character is loaded, allow navigation
  if (!characterData) {
    return true;
  }

  // Check if there are unsaved changes
  if (guard.hasUnsavedChanges(characterData)) {
    return inject(AppDialogService).confirm(
      'You have unsaved changes. If you navigate away, these changes will be lost.\n\nAre you sure you want to leave?'
    );
  }

  return true;
};
