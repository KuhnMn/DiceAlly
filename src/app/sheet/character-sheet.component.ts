import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { CharacterStore } from '../stores/character.store';
import { CharacterInfoPageComponent } from './character-info-page.component';
import { FeaturesPageComponent } from './features-page.component';
import { SpellsPageComponent } from './spells-page.component';
import { EquipmentPageComponent } from './equipment-page.component';
import { MonstersPageComponent } from './monsters-page.component';
import { NotesPageComponent } from './notes-page.component';

@Component({
  selector: 'app-character-sheet',
  imports: [
    CommonModule,
    RouterModule,
    CharacterInfoPageComponent,
    FeaturesPageComponent,
    SpellsPageComponent,
    EquipmentPageComponent,
    MonstersPageComponent,
    NotesPageComponent,
  ],
  template: `
    <main class="max-w-[1200px] mx-auto my-6 p-4">
      @if (characterData()) {
        <!-- Page Navigation -->
        <nav class="flex flex-wrap gap-2 mb-6 border-b-2 border-gray-300">
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
            <app-character-info-page
              [characterData]="characterData()"
              (navigateToFeatures)="navigateToFeatures($event)"
            />
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
          @case (5) {
            <app-monsters-page [characterData]="characterData()" />
          }
          @case (6) {
            <app-notes-page [characterData]="characterData()" />
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

  navigateToFeatures(targetId: string) {
    // Determine which page to navigate to based on the anchor ID prefix
    let page = 2; // Default to Features
    
    if (targetId.startsWith('spell-')) {
      page = 3; // Spells page
    } else if (targetId.startsWith('item-')) {
      page = 4; // Equipment page
    } else if (targetId.startsWith('monster-')) {
      page = 5; // Monsters page
    } else if (targetId.startsWith('feature-') || targetId === 'species-section') {
      page = 2; // Features & Traits page
    }
    
    this.store.setFeatureScrollTarget(targetId);
    this.currentPage.set(page);
  }
}
