import { Injectable, inject, signal } from '@angular/core';
import { CharacterLibraryService } from './character-library.service';
import { CharacterStore } from '../stores/character.store';
import { UnsavedChangesGuard } from '../guards/unsaved-changes.guard';

/** Connect a loaded character to the viewer's existing save/rest workflow. */
@Injectable({ providedIn: 'root' })
export class CharacterSessionService {
  readonly loadedVersion = signal(0);
  private readonly library = inject(CharacterLibraryService);
  private readonly store = inject(CharacterStore);
  private readonly guard = inject(UnsavedChangesGuard);

  async open(id: string) {
    const record = await this.library.get(id);
    if (!record) throw new Error('Character not found.');
    const sheet = structuredClone(record.sheet);
    if (sheet.character && sheet.character.currentHp == null) {
      sheet.character.currentHp = sheet.character.maxHpOverride ?? sheet.character.maxHp ?? 0;
    }
    let version = record.version;
    this.loadedVersion.set(version);
    this.store.clearNativeContext();
    this.store.nativeCharacterId.set(id);
    this.store.setCharacter(sheet);
    let pending = Promise.resolve();
    this.store.nativeSave = current => {
      if (current.character?.characterUuid !== id) return Promise.reject(new Error('The loaded character changed. Reopen the sheet.'));
      const snapshot = structuredClone(current);
      const save = pending.then(async () => {
        version = await this.library.save(snapshot, version);
        this.loadedVersion.set(version);
      });
      pending = save.catch(() => undefined);
      return save;
    };
    this.guard.setLastSavedState(sheet);
  }
}
