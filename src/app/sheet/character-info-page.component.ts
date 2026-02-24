import { Component, inject, computed, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CharacterHelpersService } from './character-helpers.service';
import { ExportedCharacter } from '../models/character.model';

@Component({
  selector: 'app-character-info-page',
  imports: [CommonModule],
  template: `
    <div
      class="character-sheet bg-gradient-to-br from-blue-50 to-purple-50 p-6 rounded-lg border-4 border-gray-800"
    >
      <!-- Header Banner -->
      <header class="grid grid-cols-5 gap-2 mb-6">
        <div class="col-span-1 border-2 border-gray-700 rounded-lg p-2 bg-white text-center">
          <div class="text-xs text-gray-600 uppercase font-semibold">Level / XP</div>
          <div class="text-2xl font-bold">{{ character()?.level ?? 1 }}</div>
        </div>
        <div class="col-span-1 border-2 border-gray-700 rounded-lg p-2 bg-white text-center">
          <div class="text-xs text-gray-600 uppercase font-semibold">Description</div>
          <div class="text-sm font-medium">{{ character()?.description || '—' }}</div>
        </div>
        <div class="col-span-1 border-2 border-gray-700 rounded-lg p-2 bg-white text-center">
          <div class="text-xs text-gray-600 uppercase font-semibold">Character Name</div>
          <div class="text-lg font-bold">{{ character()?.name }}</div>
        </div>
        <div class="col-span-1 border-2 border-gray-700 rounded-lg p-2 bg-white text-center">
          <div class="text-xs text-gray-600 uppercase font-semibold">Species</div>
          <div class="text-sm font-medium">{{ characterData()?.species?.name || '—' }}</div>
        </div>
        <div class="col-span-1 border-2 border-gray-700 rounded-lg p-2 bg-white text-center">
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
      <div class="grid grid-cols-[300px_1fr_350px] gap-4">
        <!-- Left Column: Ability Scores & Skills -->
        <div class="space-y-4">
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
                  <div class="text-xs text-gray-600">Save</div>
                  <div class="text-sm font-bold">
                    {{ helpers.formatSigned(ability.savingThrowValue) }}
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
                            ? '●●'
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
        <div class="space-y-4">
          <!-- Top Combat Stats -->
          <div class="flex justify-center gap-4 mb-4">
            <div
              class="border-4 border-gray-700 rounded-full w-24 h-24 bg-white flex flex-col items-center justify-center shadow-lg"
            >
              <div class="text-xs text-gray-600 uppercase font-semibold">AC</div>
              <div class="text-3xl font-bold">{{ character()?.armorClass ?? '—' }}</div>
            </div>
            <div
              class="border-4 border-gray-700 rounded-full w-24 h-24 bg-white flex flex-col items-center justify-center shadow-lg"
            >
              <div class="text-xs text-gray-600 uppercase font-semibold">Speed</div>
              <div class="text-2xl font-bold">{{ character()?.speeds?.['walk'] ?? 30 }}</div>
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
              <div class="flex items-center justify-center gap-2 mb-4">
                <div class="text-sm text-gray-600">HP Max</div>
                <div class="text-4xl font-bold">{{ character()?.maxHp ?? 0 }}</div>
              </div>
              <div class="text-6xl font-bold mb-4">{{ character()?.currentHp ?? 0 }}</div>
              <div class="text-sm text-gray-600 mb-2">Temp HP</div>
              <div class="text-2xl font-bold text-sky-600">{{ character()?.tempHp ?? 0 }}</div>
              <div class="mt-4 pt-4 border-t-2 border-gray-300">
                <div class="text-xs text-gray-600">Hit Dice</div>
                <div class="text-lg font-semibold">{{ character()?.hitDice ?? 'N/A' }}</div>
              </div>
            </div>
          </div>

          <!-- Combat Actions -->
          <div class="border-4 border-gray-700 rounded-lg p-4 bg-white shadow-lg">
            <h3 class="text-sm font-bold uppercase text-center mb-3 border-b-2 border-gray-300 pb-2">
              Attacks
            </h3>
            @if (combatActions().length > 0) {
              <div class="space-y-2">
                @for (action of combatActions(); track action.name) {
                  <div class="grid grid-cols-[2fr_1fr_2fr] gap-2 p-2 border-b border-gray-200 text-sm">
                    <div class="font-semibold">{{ action.name }}</div>
                    <div class="text-center font-mono">{{ action.hitOrDc }}</div>
                    <div class="text-center font-mono">{{ action.damageOrHeal }}</div>
                  </div>
                }
              </div>
            } @else {
              <div class="text-gray-400 italic text-sm text-center py-4">No combat actions</div>
            }
          </div>
        </div>

        <!-- Right Column: Features & Abilities -->
        <div class="border-4 border-gray-700 rounded-lg p-4 bg-white shadow-lg">
          <h3 class="text-sm font-bold uppercase text-center mb-3 border-b-2 border-gray-300 pb-2">
            Features & Abilities
          </h3>
          <div class="space-y-3 text-sm max-h-[800px] overflow-y-auto">
            @if (features().length > 0) {
              @for (feature of features(); track feature.name) {
                <div class="pb-2 border-b border-gray-200">
                  <div class="font-bold text-sky-800">{{ feature.name }}</div>
                  @if (feature.source) {
                    <div class="text-xs text-gray-500">{{ feature.source }}</div>
                  }
                </div>
              }
            } @else {
              <div class="text-gray-400 italic text-center py-4">No features yet</div>
            }
          </div>
        </div>
      </div>
    </div>
  `,
})
export class CharacterInfoPageComponent {
  characterData = input.required<ExportedCharacter | null>();
  helpers = inject(CharacterHelpersService);

  character = computed(() => this.characterData()?.character ?? null);

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
      const rawProf = skills[skill.name.toUpperCase()] ?? 'NONE';
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
}
