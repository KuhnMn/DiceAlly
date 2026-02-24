import { Component, computed, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ExportedCharacter } from '../models/character.model';

@Component({
  selector: 'app-equipment-page',
  imports: [CommonModule],
  template: `
    <div class="bg-white p-8 rounded-lg border-2 border-gray-300 shadow-lg">
      <h2 class="text-3xl font-bold mb-6">Equipment & Inventory</h2>

      <!-- Currency -->
      @if (character()?.currency && Object.keys(character()!.currency!).length > 0) {
        <div class="mb-6 border-2 border-gray-300 rounded-lg p-4">
          <h3 class="text-xl font-bold mb-3">Currency</h3>
          <div class="flex gap-4">
            @for (curr of currencyList(); track curr[0]) {
              <div class="text-center">
                <div class="text-2xl font-bold">{{ curr[1] }}</div>
                <div class="text-sm text-gray-600 uppercase">{{ curr[0] }}</div>
              </div>
            }
          </div>
        </div>
      }

      <!-- Inventory -->
      <div class="border-2 border-gray-300 rounded-lg p-4">
        <h3 class="text-xl font-bold mb-3">Items</h3>
        @if (inventory().length > 0) {
          <ul class="space-y-2">
            @for (item of inventory(); track item.name) {
              <li class="flex items-center gap-2 p-2 border-b border-gray-200">
                <span class="font-semibold">{{ item.name }}</span>
                @if (item.source) {
                  <span class="text-sm text-gray-600">({{ item.source }})</span>
                }
              </li>
            }
          </ul>
        } @else {
          <p class="text-gray-500 italic">No items in inventory</p>
        }
      </div>
    </div>
  `,
})
export class EquipmentPageComponent {
  characterData = input.required<ExportedCharacter | null>();
  Object = Object; // Make Object available in template

  character = computed(() => this.characterData()?.character ?? null);
  inventory = computed(() => this.characterData()?.inventory ?? []);
  currencyList = computed(() => {
    const currency = this.character()?.currency ?? {};
    return Object.entries(currency);
  });
}
