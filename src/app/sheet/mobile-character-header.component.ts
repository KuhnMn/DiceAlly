import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CharacterInfoPageComponent } from './character-info-page.component';
import { UiIconComponent } from '../ui-icon.component';

@Component({
  selector: 'app-mobile-character-header',
  imports: [FormsModule, UiIconComponent],
  host: { class: 'mb-3 block sm:hidden' },
  template: `
    @if (character(); as c) {
      <section class="space-y-2 rounded-xl border border-outline-variant bg-surface-container p-3" aria-label="Character Details">
        <div class="flex items-start gap-3">
          <button type="button" (click)="startEditingProfilePictureUrl()" aria-label="Change Portrait" class="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-outline-variant bg-surface text-xl text-primary">
            @if (characterData()?.portaitUrl) { <img [src]="characterData()?.portaitUrl" [alt]="'Portrait of ' + c.name" class="h-full w-full object-cover" /> } @else { <app-ui-icon name="image" /> }
          </button>
          <div class="min-w-0 flex-1">
            <p class="text-xs text-on-surface-variant">Level <strong>{{ c.level ?? 1 }}</strong> @if (characterData()?.species?.name) { <button type="button" class="ml-1 min-h-8 text-primary underline" (click)="goToSpecies()">{{ characterData()?.species?.name }}</button> }</p>
            <p class="whitespace-pre-line break-words text-sm">{{ c.description || 'No description' }}</p>
          </div>
        </div>
          @if (isEditingProfilePictureUrl()) {
            <label class="mt-2 block text-sm">Portrait URL<input type="url" [(ngModel)]="profilePictureUrlInput" (keydown)="handleProfilePictureUrlKeydown($event)" class="mt-1 min-h-11 w-full rounded border text-base border-outline bg-surface px-2" /></label>
            <button type="button" (click)="saveProfilePictureUrl()" class="min-h-11 px-3 text-sm text-primary">Apply Portrait</button><button type="button" (click)="cancelProfilePictureUrlEdit()" class="min-h-11 px-3 text-sm">Cancel</button>
          }

        @if (isEditingProfilePictureUrl() && characterData()?.portaitUrl) { <button type="button" (click)="removeProfilePicture(); cancelProfilePictureUrlEdit()" class="min-h-11 text-sm text-error">Remove Portrait</button> }
      </section>
    }
  `,
})
export class MobileCharacterHeaderComponent extends CharacterInfoPageComponent {}
