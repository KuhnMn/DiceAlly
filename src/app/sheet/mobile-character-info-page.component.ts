import { SheetProficienciesComponent } from './sheet-proficiencies.component';
import { AdvantageBadgeComponent } from './advantage-badge.component';
import { Component } from '@angular/core';
import { CharacterInfoPageComponent } from './character-info-page.component';
import { UiIconComponent } from '../ui-icon.component';

/** Mobile composition reuses the full sheet's calculations and editing actions. */
@Component({
  selector: 'app-mobile-character-info-page',
  imports: [AdvantageBadgeComponent, SheetProficienciesComponent, UiIconComponent],
  template: `
    @if (character(); as c) {
      <div class="space-y-3 rounded-lg border border-outline-variant bg-surface-container-highest p-3">
          <section aria-label="Ability modifiers and saving throws" class="grid grid-cols-3 gap-2">
            @for (ability of abilities(); track ability.name) {
              <div class="border-2 border-surface rounded-xl p-2 bg-surface-container-low text-center shadow-lg">
                <div class="text-xs font-bold text-on-surface-variant uppercase">{{ ability.abbr }}</div>
                <div class="text-2xl font-bold my-0.5 text-primary">{{ ability.score }}</div>
                <div class="text-lg font-semibold text-tertiary">
                  {{ helpers.formatSigned(ability.modifier) }}
                </div>
                <div class="mt-1 pt-1 border-t-2 border-outline-variant">
                  <div class="text-xs">
                      @if (ability.proficient) {
                      <span class="text-primary font-bold"
                        title="Proficient">●
                    </span>
                    }  
                  Save</div>
                  <div class="flex items-center justify-center gap-1">
                    <div class="text-sm font-bold text-tertiary">
                      {{ helpers.formatSigned(ability.savingThrowValue) }}
                    </div>
                  </div>
                </div>
              </div>
            }
          </section>



          <section aria-label="Skills" class="border-2 border-surface rounded-lg p-3 bg-surface-container-low shadow-lg">
            <h3 class="text-sm font-bold uppercase text-center mb-3 border-b-2 border-outline-variant pb-2">
              Skills
            </h3>
            <ul class="space-y-1 text-sm">
              @for (s of skillList(); track s.name) {
                <li class="flex min-h-8 items-center gap-2">
                                  @switch (s.levelLabel) {
                  @case ('NONE') {
                    <span class="w-6 h-6 border-2 border-outline rounded-full flex items-center justify-center text-xs font-bold text-on-surface-variant">
                      
                    </span>
                  }
                  @case ('PROF.') {
                    <span class="w-6 h-6 border-2 border-outline rounded-full flex items-center justify-center text-xs font-bold text-primary">
                      ●
                    </span>
                  }
                  @case ('EXP.') {
                    <span class="w-6 h-6 border-2 border-outline rounded-full flex items-center justify-center text-sm font-bold text-tertiary">
                      ✪
                    </span>
                  }
                  @default {
                    <span class="w-6 h-6 border-2 border-outline rounded-full flex items-center justify-center text-xs font-bold text-secondary">
                      ◐
                    </span>
                  }
                }
                  <span class="font-mono font-bold w-8">{{ s.value }}</span>
                  <span class="flex-1">{{ s.name }}</span>
                  <span class="text-xs text-on-surface-variant">({{ helpers.getSkillAbility(s.name) }})</span>
                </li>
              }
            </ul>
          </section>


        <details open class="overflow-hidden rounded-xl border border-outline-variant bg-surface p-3 text-sm" aria-label="General Stats">
          <summary class="flex min-h-11 cursor-pointer items-center gap-2 border-b border-outline-variant pb-2 font-bold"><app-ui-icon name="info" /> General Stats</summary>
          <div class="mt-3 space-y-3">
            <section aria-label="Senses">
              <h3 class="mb-2 text-xs font-semibold uppercase text-on-surface-variant">Senses</h3>
              <div class="flex flex-wrap gap-1">
                @for (sense of senseEntries(); track sense) {
                  <p class="max-w-full rounded bg-surface-container px-2 py-1 text-xs [overflow-wrap:anywhere]">{{ sense }}</p>
                } @empty {
                  <p class="text-on-surface-variant">None</p>
                }
              </div>
            </section>
            @if (resistanceEntries().length) {
              <section aria-label="Resistances">
                <h3 class="mb-2 text-xs font-semibold uppercase text-on-surface-variant">Resistances</h3>
                <div class="flex flex-wrap gap-1">
                  @for (resistance of resistanceEntries(); track resistance) {
                    <p class="max-w-full rounded bg-surface-container px-2 py-1 text-xs [overflow-wrap:anywhere]">{{ resistance }}</p>
                  }
                </div>
              </section>
            }
            @if (advantageItems().length) {
              <section aria-label="Advantages and disadvantages">
                <h3 class="mb-1 text-xs font-semibold uppercase text-on-surface-variant">(Dis)Advantages</h3>
                <div class="flex flex-wrap gap-x-3 gap-y-1">
                  @for (advantage of advantageItems(); track advantage.text) {
                    <p class="inline-flex max-w-full items-center gap-1 text-xs">
                      <app-advantage-badge style="width: 1.5rem; height: 1.5rem" [disadvantage]="advantage.isDisadvantage" />
                      <span class="min-w-0 [overflow-wrap:anywhere]">{{ advantage.text }}</span>
                    </p>
                  }
                </div>
              </section>
            }
          </div>
        </details>

        <details open class="overflow-hidden rounded-xl border border-outline-variant bg-surface p-3 text-sm">
          <summary class="flex min-h-11 cursor-pointer items-center gap-2 border-b border-outline-variant pb-2 font-bold"><app-ui-icon name="bookmark" /> Languages & Proficiencies</summary>
          <app-sheet-proficiencies class="mt-3" [proficiencies]="c.proficiencies" />
        </details>
        <details class="overflow-hidden rounded-xl border border-outline-variant bg-surface p-3 text-sm">
          <summary class="flex min-h-11 cursor-pointer items-center gap-2 border-b border-outline-variant pb-2 font-bold">Feature Index ({{ features().length }})</summary>
          @for (feature of features(); track feature) { <button type="button" (click)="goToFeature(feature)" class="block min-h-11 text-left text-primary underline">{{ feature.name }}</button> }
        </details>
      </div>
    }
  `,
})
export class MobileCharacterInfoPageComponent extends CharacterInfoPageComponent {}
