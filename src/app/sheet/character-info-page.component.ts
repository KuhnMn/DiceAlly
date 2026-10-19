import { ConcentrationControlComponent } from './concentration-control.component';
import { ConcentrationService } from '../services/concentration.service';
import { CharacterStore } from '../stores/character.store';
import { SheetProficienciesComponent } from './sheet-proficiencies.component';
import { AdvantageBadgeComponent } from './advantage-badge.component';
import { applyHealthAdjustment } from './sheet-health';
import { resolveCombatResource } from '../editor/combat-actions';
import { UiIconComponent } from '../ui-icon.component';
import { Component, inject, computed, input, effect, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CharacterHelpersService } from './character-helpers.service';
import { ExportedCharacter, HitDieEntry, ConditionName } from '../models/character.model';
import { ConditionsComponent } from './conditions.component';

@Component({
  selector: 'app-character-info-page',
  imports: [BackgroundDetailsComponent, ConcentrationControlComponent, AdvantageBadgeComponent, SheetProficienciesComponent, UiIconComponent, CommonModule, FormsModule, ConditionsComponent],
  styles: [`
    .ac-display {
      position: relative;
      cursor: help;
    }
    .ac-display .ac-tooltip {
      visibility: hidden;
      position: absolute;
      z-index: 1000;
      bottom: calc(100% + 8px);
      left: 50%;
      transform: translateX(-50%);
      background-color: #1f2937;
      color: #fff;
      text-align: center;
      padding: 8px 12px;
      border-radius: 6px;
      font-size: 12px;
      line-height: 1.4;
      white-space: nowrap;
      box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.3);
      font-weight: 500;
    }
    .ac-display:hover .ac-tooltip {
      visibility: visible;
    }
    .ac-display .ac-tooltip::after {
      content: '';
      position: absolute;
      top: 100%;
      left: 50%;
      transform: translateX(-50%);
      border-width: 6px;
      border-style: solid;
      border-color: #1f2937 transparent transparent transparent;
    }
    .speed-display {
      position: relative;
      cursor: help;
    }
    .speed-display .speed-tooltip {
      visibility: hidden;
      position: absolute;
      z-index: 1000;
      bottom: calc(100% + 8px);
      left: 50%;
      transform: translateX(-50%);
      background-color: #1f2937;
      color: #fff;
      text-align: left;
      padding: 8px 12px;
      border-radius: 6px;
      font-size: 12px;
      line-height: 1.5;
      white-space: nowrap;
      box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.3);
      font-weight: 500;
    }
    .speed-display:hover .speed-tooltip {
      visibility: visible;
    }
    .speed-display .speed-tooltip::after {
      content: '';
      position: absolute;
      top: 100%;
      left: 50%;
      transform: translateX(-50%);
      border-width: 6px;
      border-style: solid;
      border-color: #1f2937 transparent transparent transparent;
    }
    .round-tracker-input::-webkit-outer-spin-button,
    .round-tracker-input::-webkit-inner-spin-button {
      -webkit-appearance: none;
      margin: 0;
    }
    .round-tracker-input {
      -moz-appearance: textfield;
      appearance: textfield;
    }
  `],
  template: `
    <div
      class="character-sheet bg-surface-container-highest p-3 sm:p-4 rounded-lg border-2 border-outline"
    >
      <!-- Header Banner -->
      <header class="grid grid-cols-5 md:grid-cols-9 gap-2 mb-4">
        <!-- Profile Picture -->
        <div class="col-span-1 md:col-span-1 border-2 border-surface rounded-lg p-2 bg-surface-container-low text-center content-center overflow-hidden order-2 md:order-4 h-20 w-20 justify-self-center relative">
          @if (characterData()?.portaitUrl) {
            <img [src]="characterData()!.portaitUrl" alt="Portrait of {{ character()?.name }}" class="w-full h-full object-cover" />
          } @else {
            <span class="text-2xl text-on-surface-variant"><app-ui-icon name="image" /></span>
          }
        </div>

        <div class="col-span-2 md:col-span-2 border-2 border-secondary rounded-lg p-2 bg-secondary-container text-center content-center overflow-wrap order-1 md:order-2">
          <div class="text-xs text-on-secondary-container uppercase font-semibold overflow-wrap">Level</div>
          <div class="text-2xl font-bold text-on-secondary-container">{{ character()?.level ?? 1 }}</div>
        </div>
        <div class="col-span-5 md:col-span-2 border-2 border-secondary rounded-lg p-2 bg-secondary-container text-center content-center overflow-wrap order-4 md:order-3">
          <div class="text-xs text-on-secondary-container uppercase font-semibold">Background</div>
          <div class="text-sm font-medium text-on-secondary-container">
                    @if (characterData()?.background; as background) {
                      <app-background-details [background]="background" />
                    } @else {
                     Unknown
                    }
            
          </div>
        </div>
        <div class="col-span-5 md:col-span-9 border-2 border-primary rounded-lg p-2 bg-primary-container text-center content-center overflow-wrap md:order-0 order-0">
          <div class="text-xl font-bold text-on-primary-container">{{ character()?.name }}</div>
          @if (classDescription()) { <div class="mt-1 text-xs text-on-primary-container">{{ classDescription() }}</div> }
        </div>
        <div class="col-span-5 md:col-span-2 border-2 border-secondary rounded-lg p-2 bg-secondary-container text-center content-center overflow-wrap order-5 md:order-5">
          <div class="text-xs text-on-secondary-container uppercase font-semibold">Species</div>
          @if (characterData()?.species?.name) {
            <button
              type="button"
              class="text-sm font-medium text-tertiary underline cursor-pointer hover:opacity-80 transition-all"
              (click)="goToSpecies()"
            >
              {{ characterData()?.species?.name }}
            </button>
          } @else {
            <div class="text-sm font-medium text-on-secondary-container">—</div>
          }
        </div>
        <div class="col-span-2 md:col-span-2 border-2 border-secondary rounded-lg p-2 bg-secondary-container text-center content-center overflow-wrap order-3 md:order-6">
          <div class="text-xs text-on-secondary-container uppercase font-semibold">Inspiration</div>
          <input
            id="inspiration-checkbox"
            type="checkbox"
            value="{{ character()?.hasInspiration }}"
            class="appearance-none w-8 h-8 hover:border-tertiary hover:border-3 text-tertiary border-2 border-outline-variant rounded bg-surface-container-high cursor-pointer inline-flex items-center justify-center relative transition-all  checked:bg-tertiary-container checked:border-tertiary checked:after:content-['★'] checked:after:text-2xl checked:after:text-tertiary checked:after:absolute focus:ring-2 focus:ring-tertiary"
            (change)="toggleInspiration()"
            [checked]="character()?.hasInspiration ?? false"
          />
        </div>
      </header>

      <!-- Main Content Grid -->
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <!-- Left Column: Ability Scores & Skills -->
        <div class="space-y-4 order-2 md:order-1" >
          <!-- Ability Scores -->
          <div class="grid grid-cols-3 gap-2">
            @for (ability of abilities(); track ability.name) {
              <div class="border-2 border-surface rounded-lg sm:rounded-xl p-2 bg-surface-container-low text-center shadow-lg">
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
          </div>

          <!-- Skills -->
          <div class="border-4 border-surface rounded-lg p-4 bg-surface-container-low shadow-lg">
            <h3 class="text-sm font-bold uppercase text-center mb-3 border-b-2 border-outline-variant pb-2">
              Skills
            </h3>
            <ul class="space-y-1 text-sm">
              @for (s of skillList(); track s.name) {
                <li class="flex items-center gap-2">
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
                    <span class="w-6 h-6 border-2 border-outline rounded-full flex items-center justify-center text-xs font-bold text-tertiary">
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
          </div>

          <!-- Proficiency & Perception -->
          <div class="grid grid-cols-2 gap-3 justify-items-center">
            <div
              class="border-4 border-surface w-24 h-24 rounded-full aspect-square p-2 bg-surface-container-low text-center flex flex-col items-center justify-center shadow-lg"
            >
              <div class="text-xs text-on-surface-variant uppercase font-semibold">Proficiency</div>
              <div class="text-3xl font-bold text-tertiary">{{ helpers.formatSigned(proficiencyBonus()) }}</div>
            </div>
            <div
              class="border-4 border-surface w-24 h-24 rounded-full aspect-square p-2 bg-surface-container-low text-center flex flex-col items-center justify-center shadow-lg"
            >
              <div class="text-xs text-on-surface-variant uppercase font-semibold">Passive Per.</div>
              <div class="text-3xl font-bold text-primary">{{ passivePerception() }}</div>
            </div>
          </div>

          <!-- Languages & Proficiencies -->
          <div class="border-4 border-surface rounded-lg p-4 bg-surface-container-low shadow-lg">
            <h3 class="text-sm font-bold uppercase text-center mb-2 border-b-2 border-outline-variant pb-2">
              Languages & Proficiencies
            </h3>
            <app-sheet-proficiencies [proficiencies]="character()?.proficiencies" />
          </div>
        </div>

        <!-- Center Column: Combat Stats & HP -->
        <div class="space-y-4 order-1 md:order-2">
          <!-- Top Combat Stats -->
          <div class="flex justify-center gap-3 mb-3">
            <div
              class="border-4 border-surface rounded-lg sm:rounded-full w-20 h-16 sm:w-20 sm:h-20 bg-surface-container-low flex flex-col items-center justify-center shadow-lg ac-display relative"
              [class.cursor-pointer]="!isEditingAcOverride()"
              (click)="!isEditingAcOverride() && startEditingAc()"
            >
              <div class="text-xs text-on-surface-variant uppercase font-semibold"
              >AC</div>
              @if (isEditingAcOverride()) {
                <input
                  type="number"
                  [(ngModel)]="acOverrideInput"
                  (keydown)="handleAcKeydown($event)"
                  (blur)="saveAcOverride()"
                  class="w-16 text-center text-2xl font-bold bg-transparent border-b-2 border-primary outline-none"
                                  [class.text-teal]="acOverride() !== null"
                [class.text-primary]="acOverride() == null"
                  autofocus
                />
              } @else {
                <div class="text-2xl font-bold "
                [class.text-teal]="acOverride() !== null"
                [class.text-primary]="acOverride() == null"
                >{{ armorClassInfo().ac }}</div>
              }
              <div class="ac-tooltip">{{ armorClassInfo().source }}</div>
              @if (acOverride() !== null && !isEditingAcOverride()) {
                <button
                  (click)="resetAcOverride(); $event.stopPropagation()"
                  class="absolute -top-2 -right-2 bg-teal text-on-teal rounded-full w-6 h-6 flex items-center justify-center text-xs hover:bg-error-container transition-colors"
                  title="Reset AC"
                >
                  <app-ui-icon name="close" />
                </button>
              }
            </div>
            <div
              class="border-4 border-surface rounded-lg sm:rounded-full w-20 h-16 sm:w-20 sm:h-20 bg-surface-container-low flex flex-col items-center justify-center shadow-lg speed-display relative"
            >
              <div class="text-xs text-on-surface-variant uppercase font-semibold">
                <span class="inline-flex items-center gap-1">
                  <span
                    class=""
                  >
                    Walk
                  </span>
                  @if (getSpeedsTooltip()) {
                    <span
                      class="absolute -top-2 -right-2 bg-green text-on-green rounded-full w-6 h-6 flex items-center justify-center text-xl hover:bg-error-container transition-colors"
                      aria-hidden="true"
                    >
                      <app-ui-icon name="plus" />
                    </span>
                  }
                </span>
              </div>
              <div class="text-2xl font-bold text-primary">{{ character()?.speeds?.['walk'] ?? 30 }}</div>
              @if (getSpeedsTooltip()) {
                <div class="speed-tooltip">{{ getSpeedsTooltip() }}</div>
              }
            </div>
            <div
              class="border-4 border-surface rounded-lg sm:rounded-full w-20 h-16 sm:w-20 sm:h-20 bg-surface-container-low flex flex-col items-center justify-center shadow-lg"
            >
              <div class="inline-flex items-center gap-1 text-xs text-on-surface-variant uppercase font-semibold">@if (character()?.proficiencies?.initiative) { <span class="text-primary" title="Proficient" aria-label="Proficient">●</span> }Initiative</div>
              <div class="text-2xl font-bold text-tertiary">{{ helpers.formatSigned(initiative()) }}</div>
            </div>
          </div>

          <!-- HP Tracker -->
          <div class="border-4 border-surface rounded-xl sm:rounded-3xl p-3 sm:p-6 bg-surface-container-low shadow-lg">
                      <h3 class="text-sm font-bold uppercase text-center mb-3 border-b-2 border-outline-variant pb-2">
              Health
            </h3>  
          <div class="text-center">
              <div class="text-xs text-on-surface-variant uppercase font-semibold mb-2">Hit Points</div>
              <div class="mt-4 flex flex-nowrap items-center justify-center gap-2">

                <input
                  type="number"
                  [value]="character()?.currentHp ?? 0"
                  (input)="updateCurrentHp($any($event.target).value)"
                  class="w-20 sm:w-28 text-center text-2xl sm:text-4xl font-bold border-2 border-outline-variant rounded-lg py-1 pr-3 focus:ring-2 focus:ring-rose focus:border-rose"
                  min="0"
                  max="{{ getEffectiveMaxHp() }}"
                />
                <span class="whitespace-nowrap text-2xl sm:text-4xl font-bold transition-colors duration-300"
                [class.text-teal]="character()?.maxHpOverride !== null"> / {{ getEffectiveMaxHp() }}</span>
              </div>
                            <div class="mt-2 flex flex-wrap items-center justify-center gap-2 sm:gap-4 text-xs text-on-surface-variant">
                <div>Base: {{ character()?.maxHp ?? 0 }}</div>
                <label class="flex items-center gap-2">
                  <span>Override</span>
                  <input
                    type="number"
                    [value]="maxHpOverrideInput()"
                    (focus)="startMaxHpOverrideEdit()"
                    (input)="onMaxHpOverrideInput($any($event.target).value)"
                    (change)="commitMaxHpOverride()"
                    (blur)="commitMaxHpOverride()"
                    class="w-20 px-2 py-1 border border-outline-variant rounded-md text-center focus:ring-2 focus:ring-teal focus:border-teal "
                    min="0"
                  />
                </label>
                <button
                  type="button"
                  class="transition-colors px-2 py-1 border border-outline-variant rounded-md text-on-surface-variant hover:bg-surface-container"
                  [class.border-teal]="character()?.maxHpOverride !== null"
                  (click)="clearMaxHpOverride()"
                >
                  Clear
                </button>
              </div>

              <div class="mt-4">
                <div class="text-xs text-on-surface-variant uppercase font-semibold mb-1">Temp HP</div>
                <div class="flex items-center justify-center gap-4">
                <input
                  type="number"
                  [value]="character()?.tempHp ?? 0"
                  (input)="updateTempHp($any($event.target).value)"
                  class="w-28 text-center text-2xl font-bold text-green border border-outline-variant rounded-lg py-1 focus:ring-2 focus:ring-green focus:border-green pr-2"
                  min="0"
                />
                <button
                  (click)="updateTempHp('0')"
                  class="transition-colors px-2 py-1 border border-outline-variant rounded-md text-on-surface-variant hover:bg-surface-container"
                  [class.border-green]="character()?.tempHp !== null && character()?.tempHp !== 0"
                  title="Clear temp HP"
                >
                  Clear
                </button>
                </div>
              </div>

              <div class="mt-6 pt-4 border-t-2 border-outline-variant">
                <div class="text-xs text-on-surface-variant uppercase font-semibold mb-2">Quick HP Actions</div>
                <div class="flex flex-col items-center gap-3">
                  <input
                    type="number"
                    [value]="hpAdjustmentInput()"
                    (input)="hpAdjustmentInput.set($any($event.target).value)"
                    class="w-40 text-center text-lg font-bold border border-outline-variant rounded-lg py-1 px-2 focus:ring-2 focus:ring-primary focus:border-primary"
                    min="0"
                    placeholder="Amount"
                  />
                  <div class="flex flex-wrap justify-center gap-2">
                    <button
                      type="button"
                      (click)="applyDamageFromAdjustment()"
                      class="px-3 py-2 rounded-md border border-outline-variant bg-error-container text-on-error-container font-semibold hover:opacity-90 transition-colors"
                    >
                      Deal Damage
                    </button>
                    <button
                      type="button"
                      (click)="healFromAdjustment()"
                      class="px-3 py-2 rounded-md border border-outline-variant bg-primary-container text-on-primary-container font-semibold hover:opacity-90 transition-colors"
                    >
                      Heal
                    </button>
                    <button
                      type="button"
                      (click)="setTempHpFromAdjustment()"
                      class="px-3 py-2 rounded-md border border-outline-variant bg-secondary-container text-on-secondary-container font-semibold hover:opacity-90 transition-colors"
                    >
                      Set Temp HP
                    </button>
                  </div>
                </div>
              </div>

              <!-- Rest Buttons -->
<!--               <div class="mt-4 pt-4 border-t-2 border-outline-variant flex gap-2">
                <button
                  (click)="performShortRest()"
                  class="flex-1 px-4 py-2 bg-blue-container text-on-blue-container font-semibold rounded-lg hover:bg-blue transition-colors text-sm"
                  title="Restore Short Rest resources (1 hour rest)"
                >
                  Short Rest
                </button>
                <button
                  (click)="performLongRest()"
                  class="flex-1 px-4 py-2 bg-purple-container text-on-purple-container font-semibold rounded-lg hover:bg-purple transition-colors text-sm"
                  title="Restore Long Rest resources and heal to full (8 hour rest)"
                >
                  Long Rest
                </button>
              </div> -->

              <div class="mt-4 pt-4 border-t-2 border-outline-variant">
                <div class="text-xs text-on-surface-variant uppercase font-semibold">Hit Dice</div>
                @if (hasHitDiceList()) {
                  <div class="mt-2 space-y-2 text-sm">
                    @for (die of hitDiceList(); track die.dieType) {
                      <div class="flex items-center justify-between gap-2">
                        <div class="font-semibold">{{ die.dieType }}</div>
                        <div class="text-xs text-on-surface-variant">Total: {{ die.total }}</div>
                        <label class="flex items-center gap-1 text-xs text-on-surface-variant">
                          <span>Avail</span>
                          <input
                            type="number"
                            [value]="getHitDieAvailable(die)"
                            (input)="updateHitDieAvailable(die, $any($event.target).value)"
                            class="w-16 px-2 py-1 border border-outline-variant rounded-md text-center focus:ring-2 focus:ring-secondary focus:border-secondary"
                            min="0"
                            [max]="die.total"
                          />
                        </label>
                      </div>
                    }
                  </div>
                } @else {
                  <div class="text-lg font-semibold">{{ character()?.hitDice ?? 'N/A' }}</div>
                }
              </div>

              <div class="mt-4 pt-4 border-t-2 border-outline-variant">
                <div class="text-xs text-on-surface-variant uppercase font-semibold mb-2">Death Saves</div>
                <div class="flex items-center justify-center gap-2">
                  <!-- Failures -->
                  <div class="flex items-center gap-2">
                    
                    <div class="flex flex-row-reverse gap-1">
                      @for (i of [0, 1, 2]; track i) {
                        <label class="flex  items-center cursor-pointer">
                          <input
                            type="checkbox"
                            [checked]="(character()?.deathSavesFailures ?? 0) > i"
                            (change)="toggleDeathSaveFailure(i)"
                            class="w-4 h-4 rounded border-2 border-primary accent-primary cursor-pointer"
                          />
                        </label>
                      }
                    </div>
                    <span class="text-xs text-primary font-semibold"><app-ui-icon name="candle" /></span>
                  </div>
                  <button type="button" (click)="resetDeathSaves()" aria-label="Reset death saves" title="Reset death saves" class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-on-surface-variant hover:bg-primary-container hover:text-on-primary focus-visible:outline-2 focus-visible:outline-primary"><app-ui-icon name="reset" /></button>
                  <!-- Successes -->
                  <div class="flex items-center gap-2">
                    <span class="text-xs text-tertiary font-semibold"><app-ui-icon name="heart" /></span>
                    <div class="flex gap-1">
                      @for (i of [0, 1, 2]; track i) {
                        <label class="flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            [checked]="(character()?.deathSavesSuccesses ?? 0) > i"
                            (change)="toggleDeathSaveSuccess(i)"
                            class="w-4 h-4 rounded border-2 border-tertiary accent-tertiary cursor-pointer"
                          />
                        </label>
                      }
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Conditions Card -->
          <div class="border-4 border-surface rounded-lg p-4 bg-surface-container-low shadow-lg">
            <h3 class="text-sm font-bold uppercase text-center mb-3 border-b-2 border-outline-variant pb-2">
              Conditions & Effects
            </h3>
            <app-conditions
              [activeConditions]="activeConditions()"
              (conditionsChanged)="onConditionsChanged($event)"
            />
          </div>

          <!-- Combat Actions -->
          <div class="border-4 border-surface rounded-lg p-4 bg-surface-container-low shadow-lg">
            <h3 class="text-sm font-bold uppercase text-center mb-3 border-b-2 border-outline-variant pb-2">
              Combat
            </h3>
            @if (combatActions().length > 0) {
              <div class="space-y-3 text-sm max-h-[800px] overflow-y-auto pr-3">
                @for (actionType of ['ACTION', 'BONUS', 'REACTION', 'OTHER']; track actionType) {
                  @if ((groupedCombatActions()[actionType]?.length ?? 0) > 0) {
                    <div>
                      <h4 class="text-xs font-bold uppercase text-on-surface-variant mb-2 pt-2 border-t border-outline-variant">
                        {{ getActionTypeLabel(actionType) }}
                      </h4>
                      <div class="space-y-1">
                        @for (action of groupedCombatActions()[actionType]; track action) {
                          <button
                            type="button"
                            [disabled]="!isActionClickable(action)"
                            (click)="navigateToCombatAction(action)"
                            class="w-full text-left p-2 rounded transition-colors duration-300 border-2 bg-surface-container"
                            [class.border-blue]="getCombatActionLinkType(action) === 'feature'"
                            [class.border-rose]="getCombatActionLinkType(action) === 'species'"
                            [class.border-purple]="getCombatActionLinkType(action) === 'spell'"
                            [class.border-green]="getCombatActionLinkType(action) === 'item'"
                            [class.border-teal]="getCombatActionLinkType(action) === 'monster'"
                            [class.border-outline-variant]="getCombatActionLinkType(action) === null"
                            [class.hover:border-blue]="getCombatActionLinkType(action) === 'feature'"
                            [class.hover:border-rose]="getCombatActionLinkType(action) === 'species'"
                            [class.hover:border-purple]="getCombatActionLinkType(action) === 'spell'"
                            [class.hover:border-green]="getCombatActionLinkType(action) === 'item'"
                            [class.hover:border-teal]="getCombatActionLinkType(action) === 'monster'"
                            [class.hover:bg-blue-container]="getCombatActionLinkType(action) === 'feature'"
                            [class.hover:bg-rose-container]="getCombatActionLinkType(action) === 'species'"
                            [class.hover:bg-purple-container]="getCombatActionLinkType(action) === 'spell'"
                            [class.hover:bg-green-container]="getCombatActionLinkType(action) === 'item'"
                            [class.hover:bg-teal-container]="getCombatActionLinkType(action) === 'monster'"
                            [class.cursor-pointer]="isActionClickable(action)"
                            [class.text-blue]="getCombatActionLinkType(action) === 'feature'"
                            [class.text-rose]="getCombatActionLinkType(action) === 'species'"
                            [class.text-purple]="getCombatActionLinkType(action) === 'spell'"
                            [class.text-green]="getCombatActionLinkType(action) === 'item'"
                            [class.text-teal]="getCombatActionLinkType(action) === 'monster'"
                            [class.cursor-default]="!isActionClickable(action)"
                            [class.text-on-surface-variant]="!isActionClickable(action)"
                          >
                            <div class="grid grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,2fr)] gap-2 text-sm">
                              <div class="font-semibold break-words">{{ action.name }}@if (action.range) { <span class="block text-xs font-normal text-on-surface-variant">{{ action.range }}</span> }</div>
                              <div class="min-w-0 line-clamp-2 text-center font-mono text-xs [overflow-wrap:anywhere]" [title]="action.hitOrDc">{{ action.hitOrDc }}</div>
                              <div class="min-w-0 line-clamp-3 text-right font-mono text-xs [overflow-wrap:anywhere]" [title]="action.damageOrHeal">{{ action.damageOrHeal }}</div>
                            </div>
                          </button>
                        }
                      </div>
                    </div>
                  }
                }
              </div>
            } @else {
              <div class="text-on-surface-variant italic text-sm text-center py-4">No combat actions</div>
            }
          </div>
        </div>

        <!-- Right Column: Overview + Features -->
        <div class="space-y-4 order-3 md:order-3">
          <div class="border-4 border-surface rounded-lg p-4 bg-surface-container-low shadow-lg">
            <h3 class="text-sm font-bold uppercase text-center mb-3 border-b-2 border-outline-variant pb-2">
              Concentration &amp; Round Tracker
            </h3>
            <div class="flex items-center gap-2" role="group" aria-label="Concentration &amp; Round Tracker">
              @if (characterData(); as sheet) { <app-concentration-control class="min-w-0 flex-1 border-r border-outline-variant pr-3" [sheet]="sheet" /> }
              <div class="inline-flex shrink-0 items-center gap-1">
              <button
                type="button"
                class="w-9 h-9 rounded border-2 border-outline-variant bg-surface-container text-on-surface hover:bg-surface-container-high"
                (click)="adjustRoundTracker(-1)"
                aria-label="Decrease round tracker"
              >
                <app-ui-icon name="minus" />
              </button>
              <input
                type="number"
                inputmode="numeric"
                min="0"
                [value]="character()?.roundTracker ?? 0"
                (input)="updateRoundTracker($any($event.target).value)"
                class="round-tracker-input h-9 w-10 px-2 py-1 border-2 border-outline-variant rounded bg-surface text-on-surface text-center"
                aria-label="Round tracker value"
              />
              <button
                type="button"
                class="w-9 h-9 rounded border-2 border-outline-variant bg-surface-container text-on-surface hover:bg-surface-container-high"
                (click)="adjustRoundTracker(1)"
                aria-label="Increase round tracker"
              >
                <app-ui-icon name="plus" />
              </button>
                <button
                  type="button"
                  class="w-9 h-9 rounded border-2 border-outline-variant bg-surface-container text-on-surface hover:bg-surface-container-high text-sm"
                  (click)="resetRoundTracker()"
                  [class.invisible]="(character()?.roundTracker ?? 0) === 0"
                  [disabled]="(character()?.roundTracker ?? 0) === 0"
                  aria-label="Reset round tracker"
                  title="Reset"
                >
                  <app-ui-icon name="reset" />
                </button>
              </div>
            </div>
          </div>

          <div class="border-4 border-surface rounded-lg p-4 bg-surface-container-low shadow-lg">
            <h3 class="text-sm font-bold uppercase text-center mb-3 border-b-2 border-outline-variant pb-2">
              General Stats
            </h3>
            <div class="space-y-3 text-sm">
              <div>
                <div class="text-xs text-on-surface-variant uppercase font-semibold mb-1">Speeds</div>
                @if (speedEntries().length > 0) {
                  <div class="space-y-1">
                    @for (speed of speedEntries(); track speed) {
                      <div>{{ speed }}</div>
                    }
                  </div>
                } @else {
                  <div class="text-on-surface-variant italic">None listed</div>
                }
              </div>

              <div>
                <div class="text-xs text-on-surface-variant uppercase font-semibold mb-1">Senses</div>
                @if (senseEntries().length > 0) {
                  <div class="space-y-1">
                    @for (sense of senseEntries(); track sense) {
                      <div>{{ sense }}</div>
                    }
                  </div>
                } @else {
                  <div class="text-on-surface-variant italic">None listed</div>
                }
              </div>

              <div>
                <div class="text-xs text-on-surface-variant uppercase font-semibold mb-1">Resistances</div>
                @if (resistanceEntries().length > 0) {
                  <div class="space-y-1">
                    @for (resist of resistanceEntries(); track resist) {
                      <div>{{ resist }}</div>
                    }
                  </div>
                } @else {
                  <div class="text-on-surface-variant italic">None listed</div>
                }
              </div>

              <div>
                <div class="text-xs text-on-surface-variant uppercase font-semibold mb-1">(Dis)Advantages</div>
                @if (advantageItems().length > 0) {
                  <div class="space-y-1">
                    @for (adv of advantageItems(); track adv.text) {
                      <div class="flex items-center gap-2">
                        <app-advantage-badge [disadvantage]="adv.isDisadvantage" />
                        <span>{{ adv.text }}</span>
                      </div>
                    }
                  </div>
                } @else {
                  <div class="text-on-surface-variant italic">None listed</div>
                }
              </div>
            </div>
          </div>

          <div class="border-4 border-surface rounded-lg p-4 bg-surface-container-low shadow-lg">
            <h3 class="text-sm font-bold uppercase text-center mb-3 border-b-2 border-outline-variant pb-2">
              Features & Abilities
            </h3>
            <div class="space-y-3 text-sm max-h-[800px] overflow-y-auto  pr-3">
              @if (features().length > 0) {
                @for (feature of features(); track feature.editorId ?? feature) {
                  <div class="pb-2 border-b border-outline-variant">
                    <button
                      type="button"
                      class="font-bold text-tertiary underline cursor-pointer hover:opacity-80 transition-all"
                      (click)="goToFeature(feature)"
                    >
                      {{ feature.name }}
                    </button>
                    <div class="gap-2 mt-1 flex flex-wrap items-center mt-1">
                      @if (feature.featureType !== undefined) {
                        <span class="text-xs bg-teal-container text-on-teal-container px-2 py-0.5 rounded">{{ helpers.featureTypeLabel(feature) }}</span>
                      }
                    @if (feature.source) {
                      <span class="text-xs bg-surface-container-highest text-on-surface-container-highest px-2 py-0.5 rounded">{{ feature.source }}</span>
                    }
                    </div>

                  </div>
                }
              } @else {
                <div class="text-on-surface-variant italic text-center py-4">No features yet</div>
              }
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
})
export class CharacterInfoPageComponent {
  private readonly store = inject(CharacterStore);
  private readonly concentration = inject(ConcentrationService);
  characterData = input.required<ExportedCharacter | null>();
  helpers = inject(CharacterHelpersService);
  navigateToFeatures = output<string>();
  inspirationChanged = output<boolean>();
  characterRested = output<'short' | 'long'>();

  character = computed(() => this.characterData()?.character ?? null);
  readonly classDescription = computed(() => characterClasses(this.characterData()).join(' / '));
  inventory = computed(() => this.characterData()?.inventory ?? []);
  maxHpOverrideInput = signal('');
  isEditingMaxHpOverride = signal(false);
  acOverride = signal<number | null>(null);
  acOverrideInput = signal('');
  isEditingAcOverride = signal(false);
  activeConditions() { return this.characterData()?.conditions ?? []; }
  hpAdjustmentInput = signal('');

  constructor() {
    effect(() => {
      const data = this.characterData();
      this.acOverride.set(data?.character?.armorClassOverride ?? null);
    });

    effect(() => {
      const char = this.character();
      if (!char) return;

      if (!this.isEditingMaxHpOverride()) {
        const overrideValue = char.maxHpOverride ?? char.maxHp ?? 0;
        this.maxHpOverrideInput.set(String(overrideValue));
      }

      const maxHp = this.getEffectiveMaxHp();
      if (typeof char.currentHp === 'number' && char.currentHp > maxHp) {
        char.currentHp = maxHp;
      }
    });
  }

  armorClassInfo = computed(() => {
    const override = this.acOverride();
    if (override !== null) {
      return { ac: override, source: 'Manual Override' };
    }
    
    const char = this.character();
    if (!char?.calculateAC) {
      // Use static AC from character data if not calculating
      return { ac: char?.armorClass ?? 10, source: 'Static AC' };
    }
    return this.helpers.calculateArmorClass(char, this.inventory());
  });

  abilities = computed(() => {
    const c = this.character();
    if (!c?.abilityScores) return [];
    return (Object.entries(c.abilityScores) as [string, number][]).map(([key, value]) => {
      const abbr = this.helpers.abilityScoreToAbbreviation(key);
      const modifier = this.helpers.modifierNumber(value);
      const proficient = this.helpers.isProficientInSavingThrow(c, abbr);
      const savingThrowValue = this.helpers.savingThrowValue(c, key);
      return {
        name: key,
        abbr: abbr,
        score: value,
        modifier: modifier,
        proficient,
        savingThrowValue,
      };
    });
  });

  skillList = computed(() => {
    const skills = this.character()?.proficiencies?.skills ?? {};
    return this.helpers.skillDefinitions.map((skill) => {
      const rawProf = skills[skill.name.toUpperCase().replace(/\s+/g, '_')] ?? 'NONE';
      const level = this.helpers.skillProficiencyLevel(rawProf);
      const abilityScore = this.helpers.abilityScoreValue(this.character(), skill.ability);
      const base = this.helpers.modifierNumber(abilityScore);
      const profBonus = this.helpers.proficiencyBonusValue(this.character(), level);
      const otherBonus = this.helpers.getCustomSkillBonus(this.character(), skill.name) ?? 0;
      return {
        name: skill.name,
        level,
        levelLabel: this.helpers.proficiencyLabel(level),
        value: this.helpers.formatSigned(base + profBonus + otherBonus),
      };
    });
  });

  combatActions = computed(() => this.characterData()?.combatActions ?? []);
  
  groupedCombatActions = computed(() => {
    const actions = this.combatActions();
    const grouped: Record<string, typeof actions> = {
      ACTION: [],
      BONUS: [],
      REACTION: [],
      OTHER: [],
    };
    
    for (const action of actions) {
      const type = action.actionType ?? 'OTHER';
      if (type in grouped) {
        grouped[type].push(action);
      } else {
        grouped['OTHER'].push(action);
      }
    }
    
    // Sort each group by orderIndex
    for (const type in grouped) {
      grouped[type].sort((a, b) => (a.orderIndex ?? 1) - (b.orderIndex ?? 1));
    }
    
    return grouped;
  });
  
  features = computed(() => this.characterData()?.features ?? []);

  toolProficiencies = computed(() => {
    const tools = this.character()?.proficiencies?.tools;
    return tools ? Object.keys(tools) : [];
  });

  customProficiencies = computed(() => {
    return [...this.character()?.proficiencies?.languages ?? [], ...this.character()?.proficiencies?.custom ?? []];
  });

  proficiencyBonus() {
    return this.helpers.proficiencyBonus(this.character());
  }

  initiative() {
    return this.helpers.initiative(this.character());
  }

  passivePerception() {
    return this.helpers.passivePerception(this.character(), this.skillList());
  }

  getEffectiveMaxHp(): number {
    const char = this.character();
    if (!char) return 0;
    return char.maxHpOverride ?? char.maxHp ?? 0;
  }

  updateCurrentHp(value: string) {
    const char = this.character();
    if (!char) return;
    const numValue = Number(value);
    const nextValue = Number.isFinite(numValue) ? numValue : 0;
    char.currentHp = Math.min(nextValue, this.getEffectiveMaxHp());
  }

  updateTempHp(value: string) {
    const char = this.character();
    if (!char) return;
    const numValue = Number(value);
    char.tempHp = Number.isFinite(numValue) ? numValue : 0;
  }

  applyDamageFromAdjustment() {
    const char = this.character();
    if (char) {
      applyHealthAdjustment(char, 'damage', this.getHpAdjustmentAmount());
      this.store.setCharacter({ ...this.characterData()! });
      void this.concentration.remindAfterDamage(this.characterData()!, this.getHpAdjustmentAmount());
    }
    this.clearHpAdjustmentInput();
  }
  healFromAdjustment() {
    const char = this.character();
    if (char) applyHealthAdjustment(char, 'heal', this.getHpAdjustmentAmount());
    this.clearHpAdjustmentInput();
  }
  setTempHpFromAdjustment() {
    const char = this.character();
    if (char) applyHealthAdjustment(char, 'temp', this.getHpAdjustmentAmount());
    this.clearHpAdjustmentInput();
  }

  updateRoundTracker(value: string) {
    const char = this.character();
    if (!char) return;
    const numValue = Number(value);
    const nextValue = Number.isFinite(numValue) ? Math.floor(numValue) : 0;
    char.roundTracker = Math.max(0, nextValue);
  }

  adjustRoundTracker(delta: number) {
    const char = this.character();
    if (!char) return;
    const current = char.roundTracker ?? 0;
    char.roundTracker = Math.max(0, current + delta);
  }

  resetRoundTracker() {
    const char = this.character();
    if (!char) return;
    char.roundTracker = 0;
  }

  startMaxHpOverrideEdit() {
    this.isEditingMaxHpOverride.set(true);
  }

  onMaxHpOverrideInput(value: string) {
    this.maxHpOverrideInput.set(value);
  }

  commitMaxHpOverride() {
    const char = this.character();
    if (!char) return;
    this.isEditingMaxHpOverride.set(false);

    const trimmed = this.maxHpOverrideInput().trim();
    if (!trimmed) {
      char.maxHpOverride = char.maxHp ?? 0;
    } else {
      const numValue = Number(trimmed);
      char.maxHpOverride = Number.isFinite(numValue) ? numValue : char.maxHp ?? 0;
    }

    this.maxHpOverrideInput.set(String(char.maxHpOverride ?? 0));

    const maxHp = this.getEffectiveMaxHp();
    if (typeof char.currentHp === 'number' && char.currentHp > maxHp) {
      char.currentHp = maxHp;
    }
  }

  clearMaxHpOverride() {
    const char = this.character();
    if (!char) return;
    char.maxHpOverride = null;
    if (typeof char.currentHp === 'number' && char.currentHp > this.getEffectiveMaxHp()) {
      char.currentHp = this.getEffectiveMaxHp();
    }
    this.maxHpOverrideInput.set(String(char.maxHp ?? 0));
  }

  private getHpAdjustmentAmount(): number {
    const trimmed = this.hpAdjustmentInput().trim();
    if (!trimmed) return 0;

    const parsed = Number(trimmed);
    if (!Number.isFinite(parsed)) return 0;

    return Math.max(0, Math.floor(parsed));
  }

  private clearHpAdjustmentInput() {
    this.hpAdjustmentInput.set('');
  }

  onConditionsChanged(conditions: ConditionName[]) {
    const data = this.characterData();
    if (data) {
      data.conditions = conditions;
    }
  }

  goToFeature(feature: { name?: string; source?: string; editorId?: string }) {
    if (!feature?.name) return;
    const base = `${feature.name}-${feature.source ?? ''}`;
    this.navigateToFeatures.emit(`feature-${feature.editorId ?? this.helpers.sourceId(base)}`);
  }

  goToSpecies() {
    this.navigateToFeatures.emit('species-section');
  }

  hasHitDiceList(): boolean {
    const hitDice = this.character()?.hitDice;
    return Array.isArray(hitDice) && hitDice.length > 0;
  }

  hitDiceList(): HitDieEntry[] {
    const hitDice = this.character()?.hitDice;
    return Array.isArray(hitDice) ? hitDice : [];
  }

  getHitDieAvailable(die: HitDieEntry): number {
    const total = die.total ?? 0;
    const used = die.used ?? 0;
    return Math.max(0, total - used);
  }

  updateHitDieAvailable(die: HitDieEntry, value: string) {
    const total = die.total ?? 0;
    const numValue = Number(value);
    const available = Number.isFinite(numValue) ? Math.floor(numValue) : 0;
    const clamped = Math.min(Math.max(available, 0), total);
    die.used = Math.max(0, total - clamped);
  }

  getSpeedsTooltip(): string {
    const speeds = this.character()?.speeds;
    if (!speeds) return '';
    const speedEntries = Object.entries(speeds)
      .filter(([key, _]) => key !== 'walk')
      .map(([key, value]) => `${key.charAt(0).toUpperCase() + key.slice(1)}: ${value} ft.`)
      .join(' | ');
    return speedEntries;
  }

  speedEntries(): string[] {
    const speeds = this.character()?.speeds;
    if (!speeds) return [];
    return Object.entries(speeds).map(
      ([key, value]) => `${key.charAt(0).toUpperCase() + key.slice(1)}: ${value} ft.`
    );
  }

  senseEntries(): string[] {
    const senses = this.character()?.senses;
    if (!senses || typeof senses !== 'object') return [];
    return Object.entries(senses).map(([key, value]) => {
      if (typeof value === 'number') {
        return `${key}: ${value} ft.`;
      }
      if (typeof value === 'string') {
        return `${key}: ${value}`;
      }
      return key;
    });
  }

  advantageItems(): { text: string; isDisadvantage: boolean }[] {
    const advantages = this.character()?.advantageOn ?? [];
    if (!advantages.length) return [];
    return advantages.map((adv) => {
      const typeLabel = this.advantageTypeLabel(adv.aType);
      const scope = adv.appliesTo ? ` (${adv.appliesTo})` : '';
      const condition = adv.condition ? ` - ${adv.condition}` : '';
      return {
        text: `${typeLabel}${scope}${condition}`,
        isDisadvantage: !!adv.isDisadvantage,
      };
    });
  }

  advantageTypeLabel(type: string): string {
    switch (type) {
      case 'attack_roll':
        return 'Attack Roll';
      case 'saving_throw':
        return 'Saving Throw';
      case 'skill_check':
        return 'Skill Check';
      case 'ability_check':
        return 'Ability Check';
      case 'initiative':
        return 'Initiative';
      case 'death_save':
        return 'Death Save';
      default:
        return 'Other';
    }
  }

  resistanceEntries(): string[] {
    const resistances = this.character()?.resistances ?? [];
    return resistances.length ? resistances : [];
  }

  getActionTypeLabel(actionType?: string): string {
    switch (actionType) {
      case 'ACTION':
        return 'Action';
      case 'BONUS':
        return 'Bonus Action';
      case 'REACTION':
        return 'Reaction';
      case 'OTHER':
      default:
        return 'Other';
    }
  }

  getCombatActionAnchorId(action: any): string | null {
    const linkedResourceType = action.linkedResourceType;
    const sheet = this.characterData();
    if (!sheet || !linkedResourceType || linkedResourceType === 'OTHER') return null;
    const linkedResource = resolveCombatResource(sheet, action);
    if (!linkedResource?.name) return null;
    const identity = linkedResource.editorId ?? this.helpers.sourceId(`${linkedResource.name}-${linkedResource.source ?? ''}`);

    // Map linkedResourceType to page prefix
    switch (linkedResourceType) {
      case 'CLASS_FEATURE':
      case 'FEAT':
      case 'OPTIONAL_FEATURE':
        return `feature-${identity}`;
      case 'SPECIES':
        return 'species-section';
      case 'SPELL':
        return `spell-${identity}`;
      case 'ITEM':
        return `item-${identity}`;
      case 'MONSTER':
        return `monster-${identity}`;
      default:
        return null;
    }
  }

  isActionClickable(action: any): boolean {
    return this.getCombatActionAnchorId(action) !== null;
  }

  getCombatActionLinkType(action: any): 'feature' | 'species' | 'spell' | 'item' | 'monster' | null {
    const anchorId = this.getCombatActionAnchorId(action);
    if (!anchorId) return null;

    if (anchorId === 'species-section') return 'species';
    if (anchorId.startsWith('spell-')) return 'spell';
    if (anchorId.startsWith('item-')) return 'item';
    if (anchorId.startsWith('monster-')) return 'monster';
    if (anchorId.startsWith('feature-')) return 'feature';
    return null;
  }


  navigateToCombatAction(action: any) {
    const anchorId = this.getCombatActionAnchorId(action);
    if (anchorId) {
      this.navigateToFeatures.emit(anchorId);
    }
  }

  toggleInspiration() {
    const char = this.character();
    if (!char) return;
    const newValue = !char.hasInspiration;
    char.hasInspiration = newValue;
    // Emit the change so the parent can update the store
    this.inspirationChanged.emit(newValue);
  }

  performShortRest() {
    const data = this.characterData();
    if (!data) return;
    this.characterRested.emit('short');
  }

  performLongRest() {
    const data = this.characterData();
    if (!data) return;
    this.characterRested.emit('long');
  }

  startEditingAc() {
    const currentAc = this.armorClassInfo().ac;
    this.acOverrideInput.set(String(currentAc));
    this.isEditingAcOverride.set(true);
  }

  saveAcOverride() {
    const char = this.character();
    if (!char) return;

    const value = parseInt(this.acOverrideInput(), 10);
    if (!isNaN(value) && value >= 0) {
      this.acOverride.set(value);
      char.armorClassOverride = value;
    }

    this.isEditingAcOverride.set(false);
  }

  cancelAcOverride() {
    this.isEditingAcOverride.set(false);
    this.acOverrideInput.set('');
  }

  resetAcOverride() {
    const char = this.character();
    this.acOverride.set(null);
    if (char) {
      char.armorClassOverride = null;
    }
    this.isEditingAcOverride.set(false);
    this.acOverrideInput.set('');
  }

  handleAcKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter') {
      this.saveAcOverride();
    } else if (event.key === 'Escape') {
      this.cancelAcOverride();
    }
  }

  resetDeathSaves() {
    const char = this.character();
    if (!char) return;
    char.deathSavesFailures = 0;
    char.deathSavesSuccesses = 0;
  }

  toggleDeathSaveFailure(index: number) {
    const char = this.character();
    if (!char) return;
    const currentFailures = char.deathSavesFailures ?? 0;
    const isChecked = currentFailures > index;
    
    if (isChecked) {
      // Uncheck: remove this failure
      char.deathSavesFailures = index;
    } else {
      // Check: add this failure (must be in sequence)
      char.deathSavesFailures = index + 1;
    }
  }

  toggleDeathSaveSuccess(index: number) {
    const char = this.character();
    if (!char) return;
    const currentSuccesses = char.deathSavesSuccesses ?? 0;
    const isChecked = currentSuccesses > index;
    
    if (isChecked) {
      // Uncheck: remove this success
      char.deathSavesSuccesses = index;
    } else {
      // Check: add this success (must be in sequence)
      char.deathSavesSuccesses = index + 1;
    }
  }
}
import { BackgroundDetailsComponent } from '../background-details.component';
import { characterClasses } from '../character-description';
