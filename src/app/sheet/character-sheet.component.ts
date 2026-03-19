import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { CharacterStore } from '../stores/character.store';
import { CharacterStorageService } from '../services/character-storage.service';
import { RestService } from '../services/rest.service';
import { UnsavedChangesGuard } from '../guards/unsaved-changes.guard';
import { ThemeService } from '../services/theme.service';
import { ExportedCharacter } from '../models/character.model';
import { CharacterInfoPageComponent } from './character-info-page.component';
import { FeaturesPageComponent } from './features-page.component';
import { SpellsPageComponent } from './spells-page.component';
import { EquipmentPageComponent } from './equipment-page.component';
import { MonstersPageComponent } from './monsters-page.component';
import { NotesPageComponent } from './notes-page.component';
import { QRCodeModalComponent } from './qr-code-modal.component';

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
    QRCodeModalComponent,
  ],
  template: `
    <main class="max-w-[1200px] mx-auto my-6 p-4">
      @if (characterData()) {
        <!-- Top Action Bar (Save/Export/Navigation) -->
        <div class="flex gap-2 mb-6 items-center justify-between flex-wrap">
          <div class="flex gap-2 items-center">
            <a [routerLink]="['/']" class="gap-2 px-4 py-2 bg-surface-container hover:bg-surface-container-high text-surface-container font-medium rounded-lg hover:bg-surface-container-high transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
              ← Menu
            </a>
            <button
              (click)="quickSave()"
              class="flex items-center gap-2 px-4 py-2 bg-secondary-container text-on-secondary-container font-medium rounded-lg hover:bg-secondary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              [disabled]="isSaving()"
            >
              @if (isSaving()) {
                <span class="inline-block animate-spin">⟳</span>
              } @else {
                <span>💾</span>
              }
              {{ saveStatus() ? 'Saved!' : 'Quick Save' }}
            </button>
            <button
              (click)="generateQRCode()"
              [disabled]="isGeneratingQR()"
              class="flex items-center gap-2 px-4 py-2 bg-primary-container text-on-primary-container font-medium rounded-lg hover:bg-primary transition-colors disabled:opacity-50"
            >
              @if (isGeneratingQR()) {
                <span class="inline-block animate-spin">⟳</span>
              } @else {
                <span>📱</span>
              }
              QR Code
            </button>
          </div>
          <div class="flex gap-2 items-center">
            <button
              (click)="performShortRest()"
              class="px-4 py-2 bg-blue-container text-on-blue-container font-medium rounded-lg hover:bg-blue transition-colors text-sm"
              title="Rest for 1 hour - restores SHORT_REST resources"
            >
              😴 Short Rest
            </button>
            <button
              (click)="performLongRest()"
              class="px-4 py-2 bg-purple-container text-on-purple-container font-medium rounded-lg hover:bg-purple transition-colors text-sm"
              title="Rest for 8 hours - restores LONG_REST resources and heals to full"
            >
              🌙 Long Rest
            </button>
            <select
              [value]="themeService.currentTheme()"
              (change)="onThemeChange($event)"
              class="px-4 py-2 text-sm font-medium transition-colors rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface cursor-pointer"
              title="Select color theme"
            >
              <option value="light-mc">☀️ Light (Monte Carlo)</option>
              <option value="dark-mc">🌙 Dark (Monte Carlo)</option>
              <option value="light-royal">✨ Light (Royal)</option>
              <option value="dark-royal">👑 Dark (Royal)</option>
                <option value="light-ethereal">🌌 Light (Ethereal)</option>
                <option value="dark-ethereal">💜 Dark (Ethereal)</option>
                <option value="light-forge">🔥 Light (Forge)</option>
                <option value="dark-forge">⚒️ Dark (Forge)</option>
                <option value="light-glade">🌿 Light (Glade)</option>
                <option value="dark-glade">🍃 Dark (Glade)</option>
            </select>
          </div>
        </div>

        <!-- Page Navigation Tabs -->
        <nav class="flex flex-wrap-reverse flex-row-reverse justify-between mb-6 items-center">
          <button
            (click)="currentPage.set(1)"
            class="px-6 py-3 font-semibold transition-colors flex-auto order-6 border-b-2 border-outline"
            [class.border-b-4]="currentPage() === 1"
            [class.border-primary]="currentPage() === 1"
            [class.text-primary]="currentPage() === 1"
            [class.text-on-surface-variant]="currentPage() !== 1"
          >
          <div class="flex items-center justify-center gap-2">
            <span>
              Sheet
            </span>
            
            <div 
            class="border-1 px-1 border-primary rounded-xl bg-primary-container text-center content-center overflow-hidden transition-all duration-350 ease-in"
            [class.opacity-0]="!characterData()?.character?.name || currentPage() === 1"
            [class.opacity-100]="characterData()?.character?.name && currentPage() !== 1"
            [class.max-w-0]="!characterData()?.character?.name || currentPage() === 1"
            [class.max-w-xs]="characterData()?.character?.name && currentPage() !== 1"
            [class.pointer-events-none]="!characterData()?.character?.name || currentPage() === 1"
            [class.-mb-50]="!characterData()?.character?.name || currentPage() === 1"
            [class.mb-0]="characterData()?.character?.name && currentPage() !== 1"
          >
              <div class="text-xs text-on-primary-container whitespace-nowrap">{{ characterData()?.character?.name }}</div>
          </div>
          </div>


          </button>
          <button
            (click)="currentPage.set(2)"
            class="px-6 py-3 font-semibold transition-colors flex-auto order-4 border-b-2 border-outline"
            [class.border-b-4]="currentPage() === 2"
            [class.border-primary]="currentPage() === 2"
            [class.text-primary]="currentPage() === 2"
            [class.text-on-surface-variant]="currentPage() !== 2"
          >
            Features & Traits
          </button>
          <button
            (click)="currentPage.set(3)"
            class="px-6 py-3 font-semibold transition-colors flex-auto order-3 border-b-2 border-outline"
            [class.border-b-4]="currentPage() === 3"
            [class.border-primary]="currentPage() === 3"
            [class.text-primary]="currentPage() === 3"
            [class.text-on-surface-variant]="currentPage() !== 3"
          >
            Spells
          </button>
          <button
            (click)="currentPage.set(4)"
            class="px-6 py-3 font-semibold transition-colors flex-auto order-2 border-b-2 border-outline"
            [class.border-b-4]="currentPage() === 4"
            [class.border-primary]="currentPage() === 4"
            [class.text-primary]="currentPage() === 4"
            [class.text-on-surface-variant]="currentPage() !== 4"
          >
            Equipment
          </button>
          <button
            (click)="currentPage.set(5)"
            class="px-6 py-3 font-semibold transition-colors flex-auto order-1 border-b-2 border-outline"
            [class.border-b-4]="currentPage() === 5"
            [class.border-primary]="currentPage() === 5"
            [class.text-primary]="currentPage() === 5"
            [class.text-on-surface-variant]="currentPage() !== 5"
          >
            Monsters
          </button>
          <button
            (click)="currentPage.set(6)"
            class="px-6 py-3 font-semibold transition-colors flex-auto order-0 border-b-2 border-outline"
            [class.border-b-4]="currentPage() === 6"
            [class.border-primary]="currentPage() === 6"
            [class.text-primary]="currentPage() === 6"
            [class.text-on-surface-variant]="currentPage() !== 6"
          >
            Notes
          </button>
        </nav>

        <!-- Page Content -->
        @switch (currentPage()) {
          @case (1) {
            <app-character-info-page
              [characterData]="characterData()"
              (navigateToFeatures)="navigateToFeatures($event)"
              (inspirationChanged)="onInspirationChanged($event)"
              (characterRested)="onCharacterRested($event)"
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
          <a [routerLink]="['/']" class="text-primary underline">import page</a>.
        </p>
      }

      <!-- QR Code Modal -->
      @if (qrCodeUrl()) {
        <div class="transition-opacity duration-300">
          <app-qr-code-modal
            [character]="characterData()"
            [qrCodeUrl]="qrCodeUrl()"
            [jsonSize]="qrJsonSize()"
            (close)="closeQRCode()"
          />
        </div>
      }
    </main>
  `,
})
export class CharacterSheetComponent {
  private store = inject(CharacterStore);
  private storage = inject(CharacterStorageService);
  private restService = inject(RestService);
  private unsavedChangesGuard = inject(UnsavedChangesGuard);
  protected themeService = inject(ThemeService);

  characterData = this.store.characterData;
  currentPage = signal(1);
  isSaving = signal(false);
  saveStatus = signal(false);
  qrCodeUrl = signal<string | null>(null);
  isGeneratingQR = signal(false);
  qrJsonSize = signal(0);

  constructor() {
    // Track the initial state as "saved"
    const initialData = this.characterData();
    if (initialData) {
      this.unsavedChangesGuard.setLastSavedState(initialData);
    }
  }

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

  onInspirationChanged(newValue: boolean) {
    const character = this.characterData();
    if (character?.character) {
      character.character.hasInspiration = newValue;
      // Trigger a save update for the changed value
      // The component will detect changes on next save
    }
  }

  onCharacterRested(restType: 'short' | 'long') {
    const character = this.characterData();
    if (!character) return;
    
    // Deep clone to trigger change detection and preserve all mutations
    const updatedCharacter = JSON.parse(JSON.stringify(character)) as ExportedCharacter;
    
    // Notify the store with the new reference
    this.store.setCharacter(updatedCharacter);
    
    // Trigger a save update for the rested state
    this.quickSave();
  }

  quickSave(): Promise<void> {
    const character = this.characterData();
    if (!character) return Promise.resolve();

    this.isSaving.set(true);
    this.saveStatus.set(false);

    return new Promise((resolve) => {
      // Simulate async save
      setTimeout(() => {
        const result = this.storage.saveCharacter(character);
        if (result.success) {
          // Mark this state as saved
          this.unsavedChangesGuard.setLastSavedState(character);
          this.saveStatus.set(true);
          // Clear "Saved!" message after 2 seconds
          setTimeout(() => {
            this.saveStatus.set(false);
          }, 2000);
        } else {
          alert(`Save failed: ${result.error?.message}`);
        }
        this.isSaving.set(false);
        resolve();
      }, 300);
    });
  }

  async generateQRCode() {
    await this.quickSave();
    const character = this.characterData();
    if (!character) {
      alert('No character loaded');
      return;
    }

    this.isGeneratingQR.set(true);
    try {
      // Get the JSON size first
      const jsonString = this.storage.getMinimalExportJson(character);
      console.log(`QR Code JSON size: ${jsonString.length} bytes`);
      console.log(`JSON preview:`, jsonString.substring(0, 200));

      const qrUrl = await this.storage.generateQRCode(character);
      
      this.qrCodeUrl.set(qrUrl);
      this.qrJsonSize.set(jsonString.length);
      console.log('QR Code generated successfully');
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      alert(`Failed to generate QR code:\n\n${msg}\n\nTry using "Export" from the character overview instead.`);
      console.error('QR code generation error:', error);
    } finally {
      this.isGeneratingQR.set(false);
    }
  }

  closeQRCode() {
    this.qrCodeUrl.set(null);
    this.qrJsonSize.set(0);
  }

  performShortRest() {
    const character = this.characterData();
    if (!character) return;

    this.restService.performShortRest(character);
    
    // Deep clone to trigger change detection and preserve all mutations
    const updatedCharacter = JSON.parse(JSON.stringify(character)) as ExportedCharacter;
    
    // Notify the store that character data has changed to trigger reactivity
    this.store.setCharacter(updatedCharacter);
    // Trigger a save update for the rested state
    this.quickSave();
  }

  performLongRest() {
    const character = this.characterData();
    if (!character) return;

    this.restService.performLongRest(character);
    
    // Deep clone to trigger change detection and preserve all mutations
    const updatedCharacter = JSON.parse(JSON.stringify(character)) as ExportedCharacter;
    
    // Notify the store that character data has changed to trigger reactivity
    this.store.setCharacter(updatedCharacter);
    // Trigger a save update for the rested state
    this.quickSave();
  }

  onThemeChange(event: Event) {
    const target = event.target as HTMLSelectElement;
    this.themeService.setTheme(target.value as any);
  }
}
