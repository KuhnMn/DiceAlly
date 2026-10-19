import { Component } from '@angular/core';
import { CharacterInfoPageComponent } from './character-info-page.component';
import { UiIconComponent } from '../ui-icon.component';
import { BackgroundDetailsComponent } from '../background-details.component';

@Component({
  selector: 'app-mobile-character-header',
  imports: [UiIconComponent, BackgroundDetailsComponent],
  host: { class: 'mb-3 block sm:hidden' },
  template: `
    @if (character(); as c) {
      <section class="space-y-2 rounded-xl border border-outline-variant bg-surface-container p-3" aria-label="Character Details">
        <div class="flex items-start gap-3">
          <div class="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-outline-variant bg-surface text-xl text-primary">
            @if (characterData()?.portaitUrl) { <img [src]="characterData()?.portaitUrl" [alt]="'Portrait of ' + c.name" class="h-full w-full object-cover" /> } @else { <app-ui-icon name="image" /> }
          </div>
          <div class="min-w-0 flex-1">
            <h1 class="text-lg font-bold leading-snug [overflow-wrap:anywhere]">{{ c.name || 'Unnamed Character' }}</h1>
            <p class="text-xs text-on-surface-variant">Level <strong>{{ c.level ?? 1 }}</strong> @if (characterData()?.species?.name) { <button type="button" class="ml-1 min-h-8 text-primary underline" (click)="goToSpecies()">{{ characterData()?.species?.name }}</button> }</p>
            @if (classDescription()) { <p class="mt-1 text-xs [overflow-wrap:anywhere]">{{ classDescription() }}</p> }
            @if (characterData()?.background; as background) { <div class="mt-1 text-xs [overflow-wrap:anywhere]"><span class="text-on-surface-variant">Background: </span><app-background-details [background]="background" /></div> }
          </div>
        </div>
      </section>
    }
  `,
})
export class MobileCharacterHeaderComponent extends CharacterInfoPageComponent {}
