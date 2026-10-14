import { Injectable, signal } from '@angular/core';
import { ExportedCharacter } from '../models/character.model';

@Injectable({ providedIn: 'root' })
export class CharacterStore {
  readonly characterData = signal<ExportedCharacter | null>(null);
  readonly featureScrollTarget = signal<string | null>(null);
  readonly nativeCharacterId = signal<string | null>(null);
  nativeSave?: (sheet: ExportedCharacter) => Promise<void>;
  nativeRest?: (sheet: ExportedCharacter, rest: 'short' | 'long') => ExportedCharacter;
  clearNativeContext() {
    this.nativeCharacterId.set(null); this.nativeSave = undefined; this.nativeRest = undefined;
  }

  setCharacter(data: ExportedCharacter | null) {
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
