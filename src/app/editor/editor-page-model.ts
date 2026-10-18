import { ExportedCharacter } from '../models/character.model';
import { CharacterHelpersService } from '../sheet/character-helpers.service';

export interface EditorFormContext {
  sheet(): ExportedCharacter;
  changed(): void;
  reportError(message: string): void;
}

/** Shared document access without copying the character or taking over persistence. */
export abstract class EditorPageModel {
  constructor(
    protected readonly context: EditorFormContext,
    protected readonly helpers: CharacterHelpersService,
  ) {}

  get sheet() { return this.context.sheet(); }
  get character() { return this.sheet.character!; }
  changed() { this.context.changed(); }
}
