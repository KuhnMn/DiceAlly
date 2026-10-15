import { UiIconComponent } from '../ui-icon.component';
import { CharacterUpdateNoticeComponent } from '../characters/character-update-notice.component';
import { CharacterSessionService } from '../characters/character-session.service';
import { ThemePickerComponent } from '../theme-picker.component';
import { ScrollableTabsDirective } from '../scrollable-tabs.directive';
import { AppDialogService } from '../services/app-dialog.service';
import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { CharacterLibraryService } from '../characters/character-library.service';
import { CharacterStore } from '../stores/character.store';
import { RestService } from '../services/rest.service';
import { UnsavedChangesGuard } from '../guards/unsaved-changes.guard';
import { ExportedCharacter } from '../models/character.model';
import { CharacterInfoPageComponent } from './character-info-page.component';
import { FeaturesPageComponent } from './features-page.component';
import { SpellsPageComponent } from './spells-page.component';
import { EquipmentPageComponent } from './equipment-page.component';
import { MonstersPageComponent } from './monsters-page.component';
import { NotesPageComponent } from './notes-page.component';

@Component({
  selector: 'app-character-sheet',
  imports: [CharacterUpdateNoticeComponent, UiIconComponent,
    ThemePickerComponent,
    ScrollableTabsDirective,
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
        <header class="flex items-center gap-2 min-w-0 mb-3">
          <a routerLink="/" aria-label="Back to characters"
            class="min-h-10 min-w-10 inline-flex items-center justify-center shrink-0 rounded-lg bg-surface-container text-on-surface hover:bg-surface-container-high focus-visible:outline-2 focus-visible:outline-primary">
            <app-ui-icon name="left" />
          </a>
          <div class="min-w-0">
            <h1 class="text-lg sm:text-2xl font-bold">Character Sheet</h1>
            <p class="text-xs text-on-surface-variant break-words">{{ characterData()?.character?.name || 'Unnamed Character' }}</p>
          </div>
        </header>
        <app-character-update-notice [characterId]="store.nativeCharacterId()" [characterName]="characterData()?.character?.name || 'Unnamed Character'" [loadedVersion]="session.loadedVersion()" [busy]="isSaving()" (refresh)="refreshCharacter()" />
        <!-- Top Action Bar -->
        <div class="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] sm:flex sm:flex-wrap items-center gap-2 mb-4">
          <div class="flex items-center gap-1.5 min-w-0 sm:mr-auto">
            <button type="button" (click)="quickSave()" [disabled]="isSaving()"
              class="min-h-10 flex-1 sm:flex-none whitespace-nowrap rounded-lg bg-secondary-container text-on-secondary-container px-3 py-2 text-sm font-semibold disabled:opacity-50">
              <span aria-hidden="true" class="inline-block mr-1" [class.animate-spin]="isSaving()"><app-ui-icon [name]="isSaving() ? 'loader' : 'save'" /></span>
              {{ isSaving() ? 'Saving…' : saveStatus() ? 'Saved!' : 'Quick Save' }}
            </button>
          </div>
          <app-theme-picker class="min-w-0 sm:order-last sm:w-44" />
          <div class="col-span-2 flex gap-2 sm:col-span-1">
            @if (creatorAvailable) {
              <button type="button" (click)="editCharacter()" [disabled]="isSaving()"
                class="min-h-10 flex-1 sm:flex-none rounded-lg bg-primary-container text-on-primary-container px-3 py-2 text-sm font-semibold hover:brightness-110 disabled:opacity-50"
                title="Save Changes and Open the Character Editor">
                <span aria-hidden="true"><app-ui-icon name="edit" /></span> Edit
              </button>
            }
            <button
              (click)="performShortRest()"
              class="min-h-10 flex-1 sm:flex-none px-3 py-2 bg-blue-container text-on-blue-container font-medium rounded-lg hover:brightness-110 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:brightness-95 transition-all text-sm"
              title="Rest for 1 hour - restores SHORT_REST resources"
            >
              <app-ui-icon name="rest" /> Short Rest
            </button>
            <button
              (click)="performLongRest()"
              class="min-h-10 flex-1 sm:flex-none px-3 py-2 bg-purple-container text-on-purple-container font-medium rounded-lg hover:brightness-110 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:brightness-95 transition-all text-sm"
              title="Rest for 8 hours - restores LONG_REST resources and heals to full"
            >
              <app-ui-icon name="moon" /> Long Rest
            </button>
          </div>
        </div>

        @if (restService.report(); as report) {
          <section class="mb-4 rounded-lg bg-secondary-container text-on-secondary-container p-3" role="status" aria-live="polite">
            <div class="flex items-center justify-between gap-3">
              <h2 class="font-semibold text-sm">{{ report.title }}</h2>
              <button type="button" class="rounded px-2 py-1 hover:bg-surface-container focus-visible:outline-2" aria-label="Dismiss rest report" (click)="restService.report.set(null)">Dismiss</button>
            </div>
            @if (report.changes.length) {
              <ul class="mt-1 list-disc pl-5 text-sm space-y-1 max-h-48 overflow-y-auto">
                @for (change of report.changes; track $index) { <li>{{ change }}</li> }
              </ul>
            } @else { <p class="text-sm mt-1">No resources needed restoring.</p> }
          </section>
        }

        <!-- Page Navigation Tabs -->
        <nav [appScrollableTabs]="currentPage()" class="justify-between mb-6 items-stretch" aria-label="Character sheet pages">
          <button
            (click)="currentPage.set(1)"
            [attr.aria-current]="currentPage() === 1 ? 'page' : null"
            class="px-6 py-3 font-semibold transition-colors flex-auto border-b-2 border-outline"
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
            class="hidden sm:block border-1 px-1 border-primary rounded-xl bg-primary-container text-center content-center overflow-hidden transition-all duration-350 ease-in"
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
            [attr.aria-current]="currentPage() === 2 ? 'page' : null"
            class="px-6 py-3 font-semibold transition-colors flex-auto border-b-2 border-outline"
            [class.border-b-4]="currentPage() === 2"
            [class.border-primary]="currentPage() === 2"
            [class.text-primary]="currentPage() === 2"
            [class.text-on-surface-variant]="currentPage() !== 2"
          >
            Features & Traits
          </button>
          <button
            (click)="currentPage.set(3)"
            [attr.aria-current]="currentPage() === 3 ? 'page' : null"
            class="px-6 py-3 font-semibold transition-colors flex-auto border-b-2 border-outline"
            [class.border-b-4]="currentPage() === 3"
            [class.border-primary]="currentPage() === 3"
            [class.text-primary]="currentPage() === 3"
            [class.text-on-surface-variant]="currentPage() !== 3"
          >
            Spells
          </button>
          <button
            (click)="currentPage.set(4)"
            [attr.aria-current]="currentPage() === 4 ? 'page' : null"
            class="px-6 py-3 font-semibold transition-colors flex-auto border-b-2 border-outline"
            [class.border-b-4]="currentPage() === 4"
            [class.border-primary]="currentPage() === 4"
            [class.text-primary]="currentPage() === 4"
            [class.text-on-surface-variant]="currentPage() !== 4"
          >
            Equipment
          </button>
          <button
            (click)="currentPage.set(5)"
            [attr.aria-current]="currentPage() === 5 ? 'page' : null"
            class="px-6 py-3 font-semibold transition-colors flex-auto border-b-2 border-outline"
            [class.border-b-4]="currentPage() === 5"
            [class.border-primary]="currentPage() === 5"
            [class.text-primary]="currentPage() === 5"
            [class.text-on-surface-variant]="currentPage() !== 5"
          >
            Monsters
          </button>
          <button
            (click)="currentPage.set(6)"
            [attr.aria-current]="currentPage() === 6 ? 'page' : null"
            class="px-6 py-3 font-semibold transition-colors flex-auto border-b-2 border-outline"
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

    </main>
  `,
})
export class CharacterSheetComponent {
  private readonly dialogs = inject(AppDialogService);
  protected store = inject(CharacterStore);
  readonly session = inject(CharacterSessionService);
  async refreshCharacter() {
    if (this.isSaving()) return;
    const id = this.store.nativeCharacterId();
    if (!id) return;
    if (this.unsavedChangesGuard.hasUnsavedChanges(this.characterData()) &&
        !await this.dialogs.confirm('Refreshing replaces your open sheet with the saved version. Unsaved changes will be lost.', 'Updated Version Available', 'Refresh Now')) return;
    try {
      if (!await this.library.get(id)) { await this.router.navigateByUrl('/'); return; }
      await this.session.open(id);
    } catch (error) { await this.dialogs.alert(String(error)); }
  }
  private library = inject(CharacterLibraryService);
  private router = inject(Router);
  readonly creatorAvailable = true;
  private fallbackVersion?: Promise<number>;
  protected restService = inject(RestService);
  private unsavedChangesGuard = inject(UnsavedChangesGuard);

  characterData = this.store.characterData;
  currentPage = signal(1);
  isSaving = signal(false);
  saveStatus = signal(false);

  constructor() {
    this.restService.report.set(null);
    // Track the initial state as "saved"
    const initialData = this.characterData();
    if (initialData && !this.store.nativeSave && initialData.character?.characterUuid) {
      // Capture the loaded revision before the user edits, rather than accepting a newer version at save time.
      this.fallbackVersion = this.library.get(initialData.character.characterUuid).then(record => record?.version ?? 0);
    }
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

  async editCharacter() {
    await this.quickSave();
    const id = this.store.nativeCharacterId() ?? this.characterData()?.character?.characterUuid;
    if (this.saveStatus() && id) await this.router.navigate(['/characters', id, 'edit']);
  }

  async quickSave(): Promise<void> {
    const data = this.characterData();
    if (!data || this.isSaving()) return;
    const character = structuredClone(data);
    this.isSaving.set(true);
    this.saveStatus.set(false);
    try {
      if (this.store.nativeSave) {
        await this.store.nativeSave(character);
      } else {
        // Sheets opened in memory also write to the shared library.
        const id = character.character?.characterUuid;
        if (!id) throw new Error('Character ID is missing.');
        this.fallbackVersion ??= this.library.get(id).then(record => record?.version ?? 0);
        const version = await this.library.save(character, await this.fallbackVersion);
        this.fallbackVersion = Promise.resolve(version);
      }
      this.unsavedChangesGuard.setLastSavedState(character);
      this.saveStatus.set(true);
    } catch (error) { void this.dialogs.alert('Save failed: ' + String(error)); }
    finally { this.isSaving.set(false); }
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


}
