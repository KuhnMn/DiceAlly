import { Injectable, inject } from '@angular/core';
import { CharacterStore } from '../stores/character.store';
import { ExportedCharacter } from '../models/character.model';

@Injectable({
  providedIn: 'root',
})
export class RestService {
  private readonly store = inject(CharacterStore);
  performLongRest(character: ExportedCharacter): void {
    if (this.store.nativeRest && character.character?.characterUuid === this.store.nativeCharacterId()) {
      Object.assign(character, this.store.nativeRest(character, 'long')); return;
    }
    if (!character.character) return;

    const char = character.character;

    // Heal to full (respecting maxHpOverride if set)
    const effectiveMaxHp = char.maxHpOverride ?? char.maxHp ?? 0;
    if (effectiveMaxHp > 0) {
      char.currentHp = effectiveMaxHp;
    }

    // Reset hit dice
    if (char.hitDice && Array.isArray(char.hitDice)) {
      char.hitDice.forEach((die) => {
        die.used = 0;
      });
    }

    // Restore feature uses with LONG_REST or SHORT_REST condition
    this.restoreFeatureUses(character, 'LONG_REST');
    this.restoreFeatureUses(character, 'SHORT_REST');
    this.restoreFeatureUsesOne(character, 'SHORT_REST_ONE');

    // Restore spell slots and uses with LONG_REST
    this.restoreSpellSlots(character, 'LONG_REST');
    this.restoreSpellSlots(character, 'SHORT_REST');
    this.restoreOneSpellSlot(character);
    this.restoreSpellUses(character, 'LONG_REST');
    this.restoreSpellUses(character, 'SHORT_REST');
    this.restoreSpellUsesOne(character, 'SHORT_REST_ONE');

    // Clear temp HP
    char.tempHp = 0;
  }

  performShortRest(character: ExportedCharacter): void {
    if (this.store.nativeRest && character.character?.characterUuid === this.store.nativeCharacterId()) {
      Object.assign(character, this.store.nativeRest(character, 'short')); return;
    }
    if (!character.character) return;

    // Restore feature uses with SHORT_REST condition
    this.restoreFeatureUses(character, 'SHORT_REST');
    this.restoreFeatureUsesOne(character, 'SHORT_REST_ONE');

    // Restore spell uses with SHORT_REST
    this.restoreSpellUses(character, 'SHORT_REST');
    this.restoreSpellUsesOne(character, 'SHORT_REST_ONE');

    // Restore spell slots with SHORT_REST
    this.restoreSpellSlots(character, 'SHORT_REST');
    this.restoreOneSpellSlot(character);
  }

  private restoreFeatureUses(
    character: ExportedCharacter,
    condition: 'LONG_REST' | 'SHORT_REST'
  ): void {
    // Restore uses in features
    if (character.features) {
      character.features.forEach((feature) => {
        if (feature.uses) {
          feature.uses.forEach((use) => {
            const useCondition = use.freeUsesRegainCondition || 'LONG_REST';
            if (useCondition === condition) {
              use.usedFreeUses = 0;
            }
          });
        }
      });
    }

    // Restore uses in species
    if (character.species?.uses) {
      character.species.uses.forEach((use) => {
        const useCondition = use.freeUsesRegainCondition || 'LONG_REST';
        if (useCondition === condition) {
          use.usedFreeUses = 0;
        }
      });
    }

    // Restore uses in inventory items
    if (character.inventory) {
      character.inventory.forEach((item) => {
        if (item.uses) {
          item.uses.forEach((use) => {
            const useCondition = use.freeUsesRegainCondition || 'LONG_REST';
            if (useCondition === condition) {
              use.usedFreeUses = 0;
            }
          });
        }
      });
    }
  }

  private restoreFeatureUsesOne(
    character: ExportedCharacter,
    condition: 'SHORT_REST_ONE'
  ): void {
    // Restore ONE use for SHORT_REST_ONE features
    // First in features
    if (character.features) {
      character.features.forEach((feature) => {
        if (feature.uses) {
          feature.uses.forEach((use) => {
            if (use.freeUsesRegainCondition === condition) {
              // Restore only 1, not all
              if (use.usedFreeUses && use.usedFreeUses > 0) {
                use.usedFreeUses = Math.max(0, (use.usedFreeUses || 0) - 1);
              }
            }
          });
        }
      });
    }

    // Then species
    if (character.species?.uses) {
      character.species.uses.forEach((use) => {
        if (use.freeUsesRegainCondition === condition) {
          if (use.usedFreeUses && use.usedFreeUses > 0) {
            use.usedFreeUses = Math.max(0, (use.usedFreeUses || 0) - 1);
          }
        }
      });
    }

    // Then inventory
    if (character.inventory) {
      character.inventory.forEach((item) => {
        if (item.uses) {
          item.uses.forEach((use) => {
            if (use.freeUsesRegainCondition === condition) {
              if (use.usedFreeUses && use.usedFreeUses > 0) {
                use.usedFreeUses = Math.max(0, (use.usedFreeUses || 0) - 1);
              }
            }
          });
        }
      });
    }
  }

  private restoreSpellUses(
    character: ExportedCharacter,
    condition: 'LONG_REST' | 'SHORT_REST'
  ): void {
    // Restore uses in spells
    if (character.spells) {
      character.spells.forEach((spell) => {
        if (spell.uses) {
          spell.uses.forEach((use) => {
            const useCondition = use.freeUsesRegainCondition || 'LONG_REST';
            if (useCondition === condition) {
              use.usedFreeUses = 0;
            }
          });
        }
      });
    }
  }

  private restoreSpellUsesOne(
    character: ExportedCharacter,
    condition: 'SHORT_REST_ONE'
  ): void {
    // Restore ONE use for SHORT_REST_ONE spells
    if (character.spells) {
      character.spells.forEach((spell) => {
        if (spell.uses) {
          spell.uses.forEach((use) => {
            if (use.freeUsesRegainCondition === condition) {
              if (use.usedFreeUses && use.usedFreeUses > 0) {
                use.usedFreeUses = Math.max(0, (use.usedFreeUses || 0) - 1);
              }
            }
          });
        }
      });
    }
  }

  private restoreSpellSlots(
    character: ExportedCharacter,
    condition: 'LONG_REST' | 'SHORT_REST'
  ): void {
    if (!character.character?.spellSlots) return;

    Object.values(character.character.spellSlots).forEach((slotsByLevel) => {
      if (Array.isArray(slotsByLevel)) {
        slotsByLevel.forEach((slot) => {
          // If no regain condition set, default to LONG_REST (standard D&D 5e)
          const slotCondition = slot.regainCondition || 'LONG_REST';
          if (slotCondition === condition) {
            slot.used = 0;
          }
        });
      }
    });
  }
  private restoreOneSpellSlot(character: ExportedCharacter): void {
    for (const slots of Object.values(character.character?.spellSlots ?? {})) {
      for (const slot of slots) if (slot.regainCondition === 'SHORT_REST_ONE') slot.used = Math.max(0, slot.used - 1);
    }
  }
}
