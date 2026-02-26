import { Component, inject, computed, input, effect, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CharacterHelpersService } from './character-helpers.service';
import { ExportedCharacter, HitDieEntry } from '../models/character.model';

@Component({
  selector: 'app-character-info-page',
  imports: [CommonModule],
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
  `],
  template: `
    <div
      class="character-sheet bg-gradient-to-br from-blue-50 to-purple-50 p-6 rounded-lg border-4 border-gray-800"
    >
      <!-- Header Banner -->
      <header class="grid grid-cols-2 md:grid-cols-5 gap-2 mb-6">
        <div class="col-span-1 border-2 border-gray-700 rounded-lg p-2 bg-white text-center overflow-wrap order-2 md:order-1">
          <div class="text-xs text-gray-600 uppercase font-semibold overflow-wrap">Level / XP</div>
          <div class="text-2xl font-bold">{{ character()?.level ?? 1 }}</div>
        </div>
        <div class="col-span-1 border-2 border-gray-700 rounded-lg p-2 bg-white text-center overflow-wrap order-3 md:order-2">
          <div class="text-xs text-gray-600 uppercase font-semibold">Description</div>
          <div class="text-sm font-medium">{{ character()?.description || '—' }}</div>
        </div>
        <div class="col-span-2 md:col-span-1 border-2 border-gray-700 rounded-lg p-2 bg-white text-center overflow-wrap order-1 md:order-3">
          <div class="text-xs text-gray-600 uppercase font-semibold">Character Name</div>
          <div class="text-lg font-bold">{{ character()?.name }}</div>
        </div>
        <div class="col-span-1 border-2 border-gray-700 rounded-lg p-2 bg-white text-center overflow-wrap order-4 md:order-4">
          <div class="text-xs text-gray-600 uppercase font-semibold">Species</div>
          @if (characterData()?.species?.name) {
            <button
              type="button"
              class="text-sm font-medium text-sky-700 underline"
              (click)="goToSpecies()"
            >
              {{ characterData()?.species?.name }}
            </button>
          } @else {
            <div class="text-sm font-medium">—</div>
          }
        </div>
        <div class="col-span-1 border-2 border-gray-700 rounded-lg p-2 bg-white text-center overflow-wrap order-5 md:order-5">
          <div class="text-xs text-gray-600 uppercase font-semibold">Inspiration</div>
          <input
            id="default-checkbox"
            type="checkbox"
            value=""
            class="w-4 h-4 border border-default-medium rounded-xs bg+-neutral-secondary-medium focus:ring-2 focus:ring-brand-soft text-orange-500"
            [checked]="character()?.hasInspiration ?? false"
          />
        </div>
      </header>

      <!-- Main Content Grid -->
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <!-- Left Column: Ability Scores & Skills -->
        <div class="space-y-4 order-2 md:order-1" >
          <!-- Ability Scores -->
          <div class="grid grid-cols-3 gap-3">
            @for (ability of abilities(); track ability.name) {
              <div class="border-4 border-gray-700 rounded-2xl p-3 bg-white text-center shadow-lg">
                <div class="text-xs font-bold text-gray-600 uppercase">{{ ability.abbr }}</div>
                <div class="text-3xl font-bold my-1">{{ ability.score }}</div>
                <div class="text-lg font-semibold text-gray-700">
                  {{ helpers.formatSigned(ability.modifier) }}
                </div>
                <div class="mt-2 pt-2 border-t-2 border-gray-300">
                  <div class="text-xs">
                      @if (ability.proficient) {
                      <span
                        title="Proficient">●
                    </span>
                    }  
                  Save</div>
                  <div class="flex items-center justify-center gap-1">
                    <div class="text-sm font-bold">
                      {{ helpers.formatSigned(ability.savingThrowValue) }}
                    </div>
                  </div>
                </div>
              </div>
            }
          </div>

          <!-- Skills -->
          <div class="border-4 border-gray-700 rounded-lg p-4 bg-white shadow-lg">
            <h3 class="text-sm font-bold uppercase text-center mb-3 border-b-2 border-gray-300 pb-2">
              Skills
            </h3>
            <ul class="space-y-1 text-sm">
              @for (s of skillList(); track s.name) {
                <li class="flex items-center gap-2">
                  <span
                    class="w-6 h-6 border-2 border-gray-400 rounded-full flex items-center justify-center text-xs font-bold"
                  >
                    {{
                      s.levelLabel === 'NONE'
                        ? ''
                        : s.levelLabel === 'PROF.'
                          ? '●'
                          : s.levelLabel === 'EXP.'
                            ? '★'
                            : '◐'
                    }}
                  </span>
                  <span class="font-mono font-bold w-8">{{ s.value }}</span>
                  <span class="flex-1">{{ s.name }}</span>
                  <span class="text-xs text-gray-500">({{ helpers.getSkillAbility(s.name) }})</span>
                </li>
              }
            </ul>
          </div>

          <!-- Proficiency & Perception -->
          <div class="grid grid-cols-2 gap-3">
            <div
              class="border-4 border-gray-700 rounded-full aspect-square p-4 bg-white text-center flex flex-col items-center justify-center shadow-lg"
            >
              <div class="text-xs text-gray-600 uppercase font-semibold">Proficiency</div>
              <div class="text-3xl font-bold">{{ helpers.formatSigned(proficiencyBonus()) }}</div>
            </div>
            <div
              class="border-4 border-gray-700 rounded-full aspect-square p-4 bg-white text-center flex flex-col items-center justify-center shadow-lg"
            >
              <div class="text-xs text-gray-600 uppercase font-semibold">Passive Per.</div>
              <div class="text-3xl font-bold">{{ passivePerception() }}</div>
            </div>
          </div>

          <!-- Languages & Proficiencies -->
          <div class="border-4 border-gray-700 rounded-lg p-4 bg-white shadow-lg">
            <h3 class="text-sm font-bold uppercase text-center mb-2 border-b-2 border-gray-300 pb-2">
              Languages & Proficiencies
            </h3>
            <div class="text-sm space-y-1">
              @if (character()?.proficiencies?.custom?.length ?? 0 > 0) {
                @for (prof of character()!.proficiencies!.custom!; track prof) {
                  <div>{{ prof }}</div>
                }
              } @else {
                <div class="text-gray-400 italic">None listed</div>
              }
            </div>
          </div>
        </div>

        <!-- Center Column: Combat Stats & HP -->
        <div class="space-y-4 order-1 md:order-2">
          <!-- Top Combat Stats -->
          <div class="flex justify-center gap-4 mb-4">
            <div
              class="border-4 border-gray-700 rounded-full w-24 h-24 bg-white flex flex-col items-center justify-center shadow-lg ac-display relative"
            >
              <div class="text-xs text-gray-600 uppercase font-semibold">AC</div>
              <div class="text-3xl font-bold">{{ armorClassInfo().ac }}</div>
              <div class="ac-tooltip">{{ armorClassInfo().source }}</div>
            </div>
            <div
              class="border-4 border-gray-700 rounded-full w-24 h-24 bg-white flex flex-col items-center justify-center shadow-lg speed-display relative"
            >
              <div class="text-xs text-gray-600 uppercase font-semibold">
                <span class="inline-flex items-center gap-1">
                  <span
                    class=""
                  >
                    Walk
                  </span>
                  @if (getSpeedsTooltip()) {
                    <span
                      class="inline-flex h-4 w-4 items-end justify-center rounded-full border border-emerald-400 text-grey-600"
                      aria-hidden="true"
                    >
                      +
                    </span>
                  }
                </span>
              </div>
              <div class="text-2xl font-bold">{{ character()?.speeds?.['walk'] ?? 30 }}</div>
              @if (getSpeedsTooltip()) {
                <div class="speed-tooltip">{{ getSpeedsTooltip() }}</div>
              }
            </div>
            <div
              class="border-4 border-gray-700 rounded-full w-24 h-24 bg-white flex flex-col items-center justify-center shadow-lg"
            >
              <div class="text-xs text-gray-600 uppercase font-semibold">Initiative</div>
              <div class="text-3xl font-bold">{{ helpers.formatSigned(initiative()) }}</div>
            </div>
          </div>

          <!-- HP Tracker -->
          <div class="border-4 border-gray-700 rounded-3xl p-6 bg-white shadow-lg">
            <div class="text-center">
              <div class="text-xs text-gray-600 uppercase font-semibold mb-2">Hit Points</div>
              <div class="flex items-center justify-center gap-2">
                <div class="text-sm text-gray-600">HP Max</div>
                <div class="text-4xl font-bold">{{ getEffectiveMaxHp() }}</div>
              </div>
              <div class="mt-2 flex items-center justify-center gap-4 text-xs text-gray-600">
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
                    class="w-20 px-2 py-1 border border-gray-300 rounded-md text-center"
                    min="0"
                  />
                </label>
                <button
                  type="button"
                  class="px-2 py-1 border border-gray-300 rounded-md text-gray-600 hover:bg-gray-100"
                  (click)="clearMaxHpOverride()"
                >
                  Clear
                </button>
              </div>

              <div class="mt-4">
                <div class="text-xs text-gray-600 uppercase font-semibold mb-1">Current HP</div>
                <input
                  type="number"
                  [value]="character()?.currentHp ?? 0"
                  (input)="updateCurrentHp($any($event.target).value)"
                  class="w-32 text-center text-4xl font-bold border-2 border-gray-300 rounded-lg py-1"
                  min="0"
                />
              </div>

              <div class="mt-4">
                <div class="text-xs text-gray-600 uppercase font-semibold mb-1">Temp HP</div>
                <input
                  type="number"
                  [value]="character()?.tempHp ?? 0"
                  (input)="updateTempHp($any($event.target).value)"
                  class="w-28 text-center text-2xl font-bold text-sky-600 border border-gray-300 rounded-lg py-1"
                  min="0"
                />
              </div>

              <div class="mt-4 pt-4 border-t-2 border-gray-300">
                <div class="text-xs text-gray-600 uppercase font-semibold">Hit Dice</div>
                @if (hasHitDiceList()) {
                  <div class="mt-2 space-y-2 text-sm">
                    @for (die of hitDiceList(); track die.dieType) {
                      <div class="flex items-center justify-between gap-2">
                        <div class="font-semibold">{{ die.dieType }}</div>
                        <div class="text-xs text-gray-500">Total: {{ die.total }}</div>
                        <label class="flex items-center gap-1 text-xs text-gray-600">
                          <span>Avail</span>
                          <input
                            type="number"
                            [value]="getHitDieAvailable(die)"
                            (input)="updateHitDieAvailable(die, $any($event.target).value)"
                            class="w-16 px-2 py-1 border border-gray-300 rounded-md text-center"
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
            </div>
          </div>

          <!-- Combat Actions -->
          <div class="border-4 border-gray-700 rounded-lg p-4 bg-white shadow-lg">
            <h3 class="text-sm font-bold uppercase text-center mb-3 border-b-2 border-gray-300 pb-2">
              Combat
            </h3>
            @if (combatActions().length > 0) {
              <div class="space-y-3 text-sm max-h-[800px] overflow-y-auto pr-3">
                @for (actionType of ['ACTION', 'BONUS', 'REACTION', 'OTHER']; track actionType) {
                  @if ((groupedCombatActions()[actionType]?.length ?? 0) > 0) {
                    <div>
                      <h4 class="text-xs font-bold uppercase text-gray-600 mb-2 pt-2 border-t border-gray-200">
                        {{ getActionTypeLabel(actionType) }}
                      </h4>
                      <div class="space-y-1">
                        @for (action of groupedCombatActions()[actionType]; track action.name) {
                          <button
                            type="button"
                            [disabled]="!isActionClickable(action)"
                            (click)="navigateToCombatAction(action)"
                            class="w-full text-left p-2 rounded transition-colors border-2"
                            [class.border-sky-400]="getCombatActionLinkType(action) === 'feature'"
                            [class.border-rose-400]="getCombatActionLinkType(action) === 'species'"
                            [class.border-purple-400]="getCombatActionLinkType(action) === 'spell'"
                            [class.border-green-400]="getCombatActionLinkType(action) === 'item'"
                            [class.border-gray-400]="getCombatActionLinkType(action) === 'monster'"
                            [class.border-gray-200]="getCombatActionLinkType(action) === null"
                            [class.hover:border-sky-500]="getCombatActionLinkType(action) === 'feature'"
                            [class.hover:border-rose-500]="getCombatActionLinkType(action) === 'species'"
                            [class.hover:border-purple-500]="getCombatActionLinkType(action) === 'spell'"
                            [class.hover:border-green-500]="getCombatActionLinkType(action) === 'item'"
                            [class.hover:border-gray-500]="getCombatActionLinkType(action) === 'monster'"
                            [class.hover:bg-sky-50]="getCombatActionLinkType(action) === 'feature'"
                            [class.hover:bg-rose-50]="getCombatActionLinkType(action) === 'species'"
                            [class.hover:bg-purple-50]="getCombatActionLinkType(action) === 'spell'"
                            [class.hover:bg-green-50]="getCombatActionLinkType(action) === 'item'"
                            [class.hover:bg-gray-50]="getCombatActionLinkType(action) === 'monster'"
                            [class.cursor-pointer]="isActionClickable(action)"
                            [class.text-sky-700]="getCombatActionLinkType(action) === 'feature'"
                            [class.text-rose-700]="getCombatActionLinkType(action) === 'species'"
                            [class.text-purple-700]="getCombatActionLinkType(action) === 'spell'"
                            [class.text-green-700]="getCombatActionLinkType(action) === 'item'"
                            [class.text-gray-700]="getCombatActionLinkType(action) === 'monster'"
                            [class.cursor-default]="!isActionClickable(action)"
                            [class.text-gray-600]="!isActionClickable(action)"
                          >
                            <div class="grid grid-cols-[2fr_1fr_2fr] gap-2 text-sm">
                              <div class="font-semibold">{{ action.name }}</div>
                              <div class="text-center font-mono text-xs">{{ action.hitOrDc }}</div>
                              <div class="text-right font-mono text-xs">{{ action.damageOrHeal }}</div>
                            </div>
                          </button>
                        }
                      </div>
                    </div>
                  }
                }
              </div>
            } @else {
              <div class="text-gray-400 italic text-sm text-center py-4">No combat actions</div>
            }
          </div>
        </div>

        <!-- Right Column: Overview + Features -->
        <div class="space-y-4 order-3 md:order-3">
          <div class="border-4 border-gray-700 rounded-lg p-4 bg-white shadow-lg">
            <h3 class="text-sm font-bold uppercase text-center mb-3 border-b-2 border-gray-300 pb-2">
              General Stats
            </h3>
            <div class="space-y-3 text-sm">
              <div>
                <div class="text-xs text-gray-600 uppercase font-semibold mb-1">Speeds</div>
                @if (speedEntries().length > 0) {
                  <div class="space-y-1">
                    @for (speed of speedEntries(); track speed) {
                      <div>{{ speed }}</div>
                    }
                  </div>
                } @else {
                  <div class="text-gray-400 italic">None listed</div>
                }
              </div>

              <div>
                <div class="text-xs text-gray-600 uppercase font-semibold mb-1">Senses</div>
                @if (senseEntries().length > 0) {
                  <div class="space-y-1">
                    @for (sense of senseEntries(); track sense) {
                      <div>{{ sense }}</div>
                    }
                  </div>
                } @else {
                  <div class="text-gray-400 italic">None listed</div>
                }
              </div>

              <div>
                <div class="text-xs text-gray-600 uppercase font-semibold mb-1">Resistances</div>
                @if (resistanceEntries().length > 0) {
                  <div class="space-y-1">
                    @for (resist of resistanceEntries(); track resist) {
                      <div>{{ resist }}</div>
                    }
                  </div>
                } @else {
                  <div class="text-gray-400 italic">None listed</div>
                }
              </div>

              <div>
                <div class="text-xs text-gray-600 uppercase font-semibold mb-1">Advantage On</div>
                @if (advantageItems().length > 0) {
                  <div class="space-y-1">
                    @for (adv of advantageItems(); track adv.text) {
                      <div class="flex items-center gap-2">
                        <span
                          class="inline-block h-2.5 w-2.5 rounded-full"
                          [class.bg-emerald-500]="!adv.isDisadvantage"
                          [class.bg-red-500]="adv.isDisadvantage"
                        ></span>
                        <span>{{ adv.text }}</span>
                      </div>
                    }
                  </div>
                } @else {
                  <div class="text-gray-400 italic">None listed</div>
                }
              </div>
            </div>
          </div>

          <div class="border-4 border-gray-700 rounded-lg p-4 bg-white shadow-lg">
            <h3 class="text-sm font-bold uppercase text-center mb-3 border-b-2 border-gray-300 pb-2">
              Features & Abilities
            </h3>
            <div class="space-y-3 text-sm max-h-[800px] overflow-y-auto  pr-3">
              @if (features().length > 0) {
                @for (feature of features(); track feature.name) {
                  <div class="pb-2 border-b border-gray-200">
                    <button
                      type="button"
                      class="font-bold text-sky-800 underline"
                      (click)="goToFeature(feature)"
                    >
                      {{ feature.name }}
                    </button>
                    <div>
                      @if (feature.featureType !== undefined) {
                        <span class="text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded">{{ helpers.featureTypeLabel(feature) }}</span>
                      }
                    @if (feature.source) {
                      <span class="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded">{{ feature.source }}</span>
                    }
                    </div>

                  </div>
                }
              } @else {
                <div class="text-gray-400 italic text-center py-4">No features yet</div>
              }
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
})
export class CharacterInfoPageComponent {
  characterData = input.required<ExportedCharacter | null>();
  helpers = inject(CharacterHelpersService);
  navigateToFeatures = output<string>();

  character = computed(() => this.characterData()?.character ?? null);
  inventory = computed(() => this.characterData()?.inventory ?? []);
  maxHpOverrideInput = signal('');
  isEditingMaxHpOverride = signal(false);

  constructor() {
    effect(() => {
      const char = this.character();
      if (!char) return;

      if (char.maxHpOverride === null || char.maxHpOverride === undefined) {
        if (typeof char.maxHp === 'number') {
          char.maxHpOverride = char.maxHp;
        }
      }

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
      console.log(`Processing ability score: ${key} with value ${value}`);
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
    console.log('Raw skills from character data:', skills);
    return this.helpers.skillDefinitions.map((skill) => {
      const rawProf = skills[skill.name.toUpperCase().replace(/\s+/g, '_')] ?? 'NONE';
      const level = this.helpers.skillProficiencyLevel(rawProf);
      const abilityScore = this.helpers.abilityScoreValue(this.character(), skill.ability);
      const base = this.helpers.modifierNumber(abilityScore);
      const profBonus = this.helpers.proficiencyBonusValue(this.character(), level);
      return {
        name: skill.name,
        level,
        levelLabel: this.helpers.proficiencyLabel(level),
        value: this.helpers.formatSigned(base + profBonus),
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
      grouped[type].sort((a, b) => (a.orderIndex ?? 999) - (b.orderIndex ?? 999));
    }
    
    return grouped;
  });
  
  features = computed(() => this.characterData()?.features ?? []);

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
    char.maxHpOverride = char.maxHp ?? 0;
    if (typeof char.currentHp === 'number' && char.currentHp > char.maxHpOverride) {
      char.currentHp = char.maxHpOverride;
    }
    this.maxHpOverrideInput.set(String(char.maxHpOverride ?? 0));
  }

  goToFeature(feature: { name?: string; source?: string }) {
    if (!feature?.name) return;
    const base = `${feature.name}-${feature.source ?? ''}`;
    this.navigateToFeatures.emit(`feature-${this.helpers.sourceId(base)}`);
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
    const linkedResource = action.linkedResource;
    
    if (!linkedResource?.name) return null;
    if (linkedResourceType === 'OTHER' || !linkedResourceType) return null;
    
    // Map linkedResourceType to page prefix
    switch (linkedResourceType) {
      case 'CLASS_FEATURE':
      case 'FEAT':
      case 'OPTIONAL_FEATURE':
        return `feature-${this.helpers.sourceId(`${linkedResource.name}-${linkedResource.source ?? ''}`)}`;
      case 'SPECIES':
        return 'species-section';
      case 'SPELL':
        return `spell-${this.helpers.sourceId(`${linkedResource.name}-${linkedResource.source ?? ''}`)}`;
      case 'ITEM':
        return `item-${this.helpers.sourceId(`${linkedResource.name}-${linkedResource.source ?? ''}`)}`;
      case 'MONSTER':
        return `monster-${this.helpers.sourceId(`${linkedResource.name}-${linkedResource.source ?? ''}`)}`;
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

  getBorderColorClass(linkType: 'feature' | 'species' | 'spell' | 'item' | 'monster' | null): string {
    switch (linkType) {
      case 'feature':
        return 'border-sky-400 hover:border-sky-500';
      case 'species':
        return 'border-rose-400 hover:border-rose-500';
      case 'spell':
        return 'border-purple-400 hover:border-purple-500';
      case 'item':
        return 'border-green-400 hover:border-green-500';
      case 'monster':
        return 'border-gray-400 hover:border-gray-500';
      default:
        return 'border-gray-200';
    }
  }

  navigateToCombatAction(action: any) {
    const anchorId = this.getCombatActionAnchorId(action);
    if (anchorId) {
      this.navigateToFeatures.emit(anchorId);
    }
  }
}