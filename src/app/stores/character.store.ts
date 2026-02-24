import { Injectable, signal } from '@angular/core';
import { ExportedCharacter } from '../models/character.model';

@Injectable({ providedIn: 'root' })
export class CharacterStore {
  readonly characterData = signal<ExportedCharacter | null>(null);

  setCharacter(data: ExportedCharacter | null) {
    this.characterData.set(data);
  }
}
