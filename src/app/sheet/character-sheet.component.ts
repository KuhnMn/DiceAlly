import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { CharacterStore } from '../stores/character.store';
import { CharacterInfoPageComponent } from './character-info-page.component';
import { FeaturesPageComponent } from './features-page.component';
import { SpellsPageComponent } from './spells-page.component';
import { EquipmentPageComponent } from './equipment-page.component';

@Component({
  selector: 'app-character-sheet',
  imports: [
    CommonModule,
    RouterModule,
    CharacterInfoPageComponent,
    FeaturesPageComponent,
    SpellsPageComponent,
    EquipmentPageComponent,
  ],
  template: `
    <main class="max-w-[1200px] mx-auto my-6 p-4">
      @if (characterData()) {
        <!-- Page Navigation -->
        <nav class="flex gap-2 mb-6 border-b-2 border-gray-300">
          <button
            (click)="currentPage.set(1)"
            class="px-6 py-3 font-semibold transition-colors"
            [class.border-b-4]="currentPage() === 1"
            [class.border-sky-600]="currentPage() === 1"
            [class.text-sky-600]="currentPage() === 1"
            [class.text-gray-600]="currentPage() !== 1"
          >
            Character
          </button>
          <button
            (click)="currentPage.set(2)"
            class="px-6 py-3 font-semibold transition-colors"
            [class.border-b-4]="currentPage() === 2"
            [class.border-sky-600]="currentPage() === 2"
            [class.text-sky-600]="currentPage() === 2"
            [class.text-gray-600]="currentPage() !== 2"
          >
            Features & Traits
          </button>
          <button
            (click)="currentPage.set(3)"
            class="px-6 py-3 font-semibold transition-colors"
            [class.border-b-4]="currentPage() === 3"
            [class.border-sky-600]="currentPage() === 3"
            [class.text-sky-600]="currentPage() === 3"
            [class.text-gray-600]="currentPage() !== 3"
          >
            Spells
          </button>
          <button
            (click)="currentPage.set(4)"
            class="px-6 py-3 font-semibold transition-colors"
            [class.border-b-4]="currentPage() === 4"
            [class.border-sky-600]="currentPage() === 4"
            [class.text-sky-600]="currentPage() === 4"
            [class.text-gray-600]="currentPage() !== 4"
          >
            Equipment
          </button>
          <a [routerLink]="['/']" class="ml-auto px-6 py-3 text-sm text-gray-600 hover:text-sky-600">
            ← Import another
          </a>
        </nav>

        <!-- Page Content -->
        @switch (currentPage()) {
          @case (1) {
            <app-character-info-page [characterData]="characterData()" />
          }
          @case (2) {
            <app-features-page [characterData]="characterData()" />
          }
          @case (3) {
            <app-spells-page [characterData]="characterData()" />
          }
          @case (4) {
            <app-equipment-page [characterData]="characterData()" />
          }
        }
      } @else {
        <p>
          No character loaded. Use the
          <a [routerLink]="['/']" class="text-sky-600 underline">import page</a>.
        </p>
      }
    </main>
  `,
})
export class CharacterSheetComponent {
  private store = inject(CharacterStore);

  characterData = this.store.characterData;
  currentPage = signal(1);
}
