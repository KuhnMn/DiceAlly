import { Injectable, inject } from '@angular/core';
import { ExportedCharacter } from '../models/character.model';
import { CharacterStore } from '../stores/character.store';
import { AppDialogService } from './app-dialog.service';

@Injectable({ providedIn: 'root' })
export class ConcentrationService {
  private readonly store = inject(CharacterStore);
  private readonly dialogs = inject(AppDialogService);
  private pending = false;

  async remindAfterDamage(sheet: ExportedCharacter, amount: number) {
    const character = sheet.character;
    const effect = character?.concentrationEffect;
    if (!effect || character?.concentrationReminderEnabled === false || !Number.isFinite(amount) || amount < 1 || this.pending) return;
    this.pending = true;
    try {
      const okay = await this.dialogs.alertWithAction(
        `You took damage while concentrating on ${effect}. Roll your concentration saving throw.`,
        'Concentration Reminder', 'End Concentration');
      const current = this.store.characterData();
      if (!okay && current?.character?.characterUuid === character?.characterUuid && current?.character?.concentrationEffect === effect) {
        this.store.setCharacter({ ...current, character: { ...current.character, concentrationEffect: '' } });
      }
    } finally { this.pending = false; }
  }
}
