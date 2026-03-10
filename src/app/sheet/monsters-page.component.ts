import { Component, computed, input, signal, inject, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  ExportedCharacter,
  Monster,
  MonsterCasting,
  MonsterSpellcasting,
} from '../models/character.model';
import { CapitalizeFirstPipe } from '../capitalize-first-pipe';
import { EntryRendererComponent } from "../entries/entry-renderer.component";
import { CharacterHelpersService } from './character-helpers.service';
import { CharacterStore } from '../stores/character.store';

@Component({
  selector: 'app-monsters-page',
  imports: [CommonModule, CapitalizeFirstPipe, EntryRendererComponent],
  styles: [`
    .flash-highlight {
      animation: monster-flash 1.6s ease-out;
    }

    @keyframes monster-flash {
      0% {
        background-color: rgba(79, 219, 216, 0.5);
        box-shadow: 0 0 0 0 rgba(79, 219, 216, 0.8);
      
      }
      40% {
        background-color: rgba(79, 219, 216, 0.25);
        box-shadow: 0 0 0 8px rgba(79, 219, 216, 0.2);
        border-color: rgb(79, 219, 216);
      }
      100% {
        background-color: transparent;
        box-shadow: 0 0 0 0 rgba(79, 219, 216, 0);
      
      }
    }
  `],
  template: `
    <div class="bg-surface-container-highest p-8 rounded-lg border-2 border-outline shadow-lg">
      <h2 class="text-3xl font-bold mb-6">Monsters & Companions</h2>
      
      @if (monsters().length > 0) {
        <div class="space-y-6">
          @for (monster of monsters(); track monster.name) {
            <div class="border-2 border-teal rounded-lg p-4 bg-surface-container hover:shadow-md transition-shadow\" [attr.id]=\"'monster-' + helpers.sourceId((monster.name ?? '') + '-' + (monster.source ?? ''))\" [class.flash-highlight]=\"highlightedId() === ('monster-' + helpers.sourceId((monster.name ?? '') + '-' + (monster.source ?? '')))\">
              <!-- Header (always visible, clickable) -->
              <button
                type="button"
                class="w-full text-left hover:bg-surface-container-low transition-colors rounded p-2 -m-2 mb-3"
                (click)="toggleExpanded('monster-' + monster.name)"
              >
                <div class="flex justify-between items-start">
                  <h3 class="text-2xl font-bold text-teal">{{ monster.name }}</h3>
                  <span class="text-2xl text-teal font-bold">{{ isExpanded('monster-' + monster.name) ? '−' : '+' }}</span>
                </div>
              </button>
              @if (monster.entity) {
                                              <!-- Size, Type, Alignment -->
                <div class="text-sm text-on-surface pb-2">
                  @if (monster.entity.size && monster.entity.size.length > 0) {
                    <span>
                      @for (size of monster.entity.size; track size) {
                        <span>{{ getSizeText(size) }}</span>
                        @if (!$last) {
                          <span>, </span>
                        }
                      }
                    </span>
                  }
                  @if (monster.entity.type && monster.entity.type.type) {
                    <span> {{ monster.entity.type.type | capitalizeFirst}}</span>
                  }
                  @if (monster.entity.alignment && monster.entity.alignment.length > 0) {
                    <span>, 
                      @for (align of monster.entity.alignment; track align) {
                        <span>{{ align }}</span>
                      }
                    </span>
                  }
                </div>
              }
              <!-- Source Tag -->
              @if (monster.source) {
                <div class="mb-4 pb-4 border-b border-outline-variant">
                  <span class="text-xs bg-surface-container-highest text-on-surface px-2 py-0.5 rounded ">{{ monster.source }}</span>
                </div>
              }

              @if (monster.entity) {
                <!-- HP Tracker -->
                @if (monster.hpEnabled) {
                  <div class="space-y-3 my-4">
                    <div class="space-y-1 p-3 bg-primary-container rounded-md border-2 border-primary">
                    <div class="flex flex-wrap gap-2 justify-between">
                      <div class="flex gap-3 items-center">
                      <div class="text-sm text-on-primary-container uppercase font-bold min-w-[3rem]">HP</div>
                      <input
                        type="number"
                        [value]="monster.monsterCurrentHP ?? getEffectiveMonsterMaxHP(monster)"
                        (input)="updateMonsterHP(monster, $any($event.target).value)"
                        class="text-on-primary-container w-20 p-2 border-2 border-primary rounded-md text-base font-bold focus:ring-2 focus:ring-primary focus:border-primary"
                        min="0"
                        [max]="getEffectiveMonsterMaxHP(monster)"
                      >
                      <div class="text-on-primary-container">/</div>
                      <div class="text-on-primary-container font-bold"
                      [class.text-teal]="monster.monsterMaxHpOverride !== null"
                      >{{ getEffectiveMonsterMaxHP(monster) }}</div>
                      </div>
                      <div class="flex flex-wrap items-center justify-center gap-3 text-xs text-on-primary-container">
                      <div>Base:</div>
                      <div>{{ monster.monsterMaxHP ?? 0 }}</div>
                      <label class="flex items-center gap-2 text-on-primary-container">
                        <span>Override</span>
                        <input
                          type="number"
                          [value]="getMonsterMaxHpOverrideInput(monster)"
                          (input)="onMonsterMaxHpOverrideInput(monster, $any($event.target).value)"
                          (change)="commitMonsterMaxHpOverride(monster)"
                          (blur)="commitMonsterMaxHpOverride(monster)"
                          class="w-20 px-2 py-1 border border-primary rounded-md text-center focus:ring-2 focus:ring-primary focus:border-primary"
                          min="0"
                        />
                      </label>
                      <button
                        type="button"
                        class="px-2 py-1 border border-primary rounded-md hover:bg-primary text-on-primary-containerhover:border-surface hover:text-on-primary transition-colors text-xs font-semibold "
                        [class.border-teal]="monster.monsterMaxHpOverride !== null"
                        (click)="clearMonsterMaxHpOverride(monster)"
                      >
                        Clear
                      </button>
                    </div>
    
                    </div>
                    <div class="flex flex-wrap gap-2 text-sm">
                      @if (monster.entity.hp) {
                        ≈
                        @if (monster.entity.hp.average) {
                        {{ monster.entity.hp.average }}
                        }
                        @if (monster.entity.hp.formula) {
                          <span> ({{ monster.entity.hp.formula }})</span>
                        }
                        @if (monster.entity.hp.special) {
                          <span class="italic"> {{ monster.entity.hp.special }}</span>
                        }
                      }
                    </div>
                  </div>
                </div>

                    
                    <!-- Max HP Override -->

                    
                    <!-- Temp HP -->
                    <div class="flex gap-3 items-center p-3 bg-secondary-container rounded-md border-2 border-green">
                      <div class="text-sm text-on-secondary-container uppercase font-bold min-w-[3rem]">Temp HP</div>
                      <input
                        type="number"
                        [value]="monster.monsterTempHP ?? 0"
                        (input)="updateMonsterTempHP(monster, $any($event.target).value)"
                        class="text-on-secondary-container w-24 p-2 border-2 border-green rounded-md text-base font-bold focus:ring-2 focus:ring-green focus:border-green"
                        min="0"
                      >
                      @if (monster.monsterTempHP && monster.monsterTempHP > 0) {
                        <button
                          (click)="clearMonsterTempHP(monster)"
                          class="px-2 py-1 bg-secondary-container border border-secondary text-on-secondary rounded text-xs font-semibold transition-colors hover:bg-secondary hover:text-on-secondary"
                          title="Clear temp HP"
                        >
                          Clear
                        </button>
                      }

                  </div>
                }  @else if (monster.entity.hp) {
                  <div class="space-y-3 my-4">
                    <div class="flex flex-wrap gap-2 justify-between p-3 bg-primary-container rounded-md border-2 border-primary">
                      <div class="flex gap-2 items-center">
                      <div class="text-sm text-on-primary-container uppercase font-bold min-w-[3rem]">HP</div>
                      <div class="text-sm text-on-primary-container">
                      @if (monster.entity.hp.average) {
                          {{ monster.entity.hp.average }}
                        }
                        @if (monster.entity.hp.formula) {
                          <span> ({{ monster.entity.hp.formula }})</span>
                        }
                        @if (monster.entity.hp.special) {
                          <span class="italic"> {{ monster.entity.hp.special }}</span>
                        }
                      </div>
                    </div>
                  </div>
                  </div>
                }
                <!-- AC, Speed, Initiative, CR -->
                <div class="grid grid-cols-2 lg:grid-cols-4 gap-3 my-4">
                  @if (monster.entity.ac && monster.entity.ac.length > 0) {
                    <div class="p-3 border-2 border-surface shadow-lg rounded-md bg-surface-container-high">
                      <div class="text-xs text-on-surface-variant uppercase font-bold tracking-wide">AC</div>
                      <div class="text-2xl font-bold text-primary">
                        @if (isNumber(monster.entity.ac[0])) {
                          {{ monster.entity.ac[0] }}
                        } @else if (hasAcProperty(monster.entity.ac[0])) {
                          @if (monster.entity.ac[0].ac === 0) {
                            ?
                          } @else {
                            {{ monster.entity.ac[0].ac }}
                          }
                          @if (monster.entity.ac[0].condition) {
                            <span class="text-xl"> ({{ monster.entity.ac[0].condition }})</span>
                          }
                        }
                      </div>
                    </div>
                  }
                  <div class="p-3 border-2 border-surface shadow-lg rounded-md bg-surface-container-high">
                    <div class="text-xs text-on-surface-variant uppercase font-bold tracking-wide">Initiative</div>
                    <div class="text-2xl font-bold text-tertiary">{{ getInitiative(monster) }}</div>
                  </div>
                  @if (monster.entity.speed) {
                    <div class="p-3 border-2 border-surface shadow-lg rounded-md bg-surface-container-high">
                      <div class="text-xs text-on-surface-variant uppercase font-bold tracking-wide">Speed</div>
                      <div class="text-xl font-bold text-on-surface-container-high">{{ formatSpeeds(monster.entity.speed) }}</div>
                    </div>
                  }
                  @if (monster.entity.cr) {
                    <div class="p-3 border-2 border-surface shadow-lg rounded-md bg-surface-container-high">
                      <div class="text-xs text-on-surface-variant uppercase font-bold tracking-wide">CR</div>
                      <div class="text-2xl font-bold text-tertiary">{{ typeof monster.entity.cr === 'string' ? monster.entity.cr : monster.entity.cr.cr }} 
                        <span class="text-xl">(PB +{{ getProficiencyBonusFromCR(typeof monster.entity.cr === 'string' ? monster.entity.cr : monster.entity.cr.cr) }})</span>
                      </div>
                    </div>
                  }
                </div>

                <!-- Expandable Content: Ability Scores and Beyond -->
                @if (isExpanded('monster-' + monster.name)) {
                  <div class="mt-4 pt-4 border-t border-outline-variant space-y-3">

                <!-- Ability Scores -->
                @if (hasAbilityScores(monster)) {
                  <div class="grid grid-cols-3 lg:grid-cols-6 gap-2 my-4">
                    <div class="text-center p-3 border-2 border-surface shadow-lg rounded-md bg-surface-container-high rounded-md">
                      <div class="text-xs uppercase font-bold text-on-surface-variant">STR</div>
                      <div class="text-xl font-bold text-primary">{{ monster.entity.str }}</div>
                      <div class="text-xs text-tertiary">{{ getModifier(monster.entity.str) }}</div>
                    </div>
                    <div class="text-center p-3 border-2 border-surface shadow-lg rounded-md bg-surface-container-high rounded-md">
                      <div class="text-xs uppercase font-bold text-on-surface-variant">DEX</div>
                      <div class="text-xl font-bold text-primary">{{ monster.entity.dex }}</div>
                      <div class="text-xs text-tertiary">{{ getModifier(monster.entity.dex) }}</div>
                    </div>
                    <div class="text-center p-3 border-2 border-surface shadow-lg rounded-md bg-surface-container-high rounded-md">
                      <div class="text-xs uppercase font-bold text-on-surface-variant">CON</div>
                      <div class="text-xl font-bold text-primary">{{ monster.entity.con }}</div>
                      <div class="text-xs text-tertiary">{{ getModifier(monster.entity.con) }}</div>
                    </div>
                    <div class="text-center p-3 border-2 border-surface shadow-lg rounded-md bg-surface-container-high rounded-md">
                      <div class="text-xs uppercase font-bold text-on-surface-variant">INT</div>
                      <div class="text-xl font-bold text-primary">{{ monster.entity.int }}</div>
                      <div class="text-xs text-tertiary">{{ getModifier(monster.entity.int) }}</div>
                    </div>
                    <div class="text-center p-3 border-2 border-surface shadow-lg rounded-md bg-surface-container-high rounded-md">
                      <div class="text-xs uppercase font-bold text-on-surface-variant">WIS</div>
                      <div class="text-xl font-bold text-primary">{{ monster.entity.wis }}</div>
                      <div class="text-xs text-tertiary">{{ getModifier(monster.entity.wis) }}</div>
                    </div>
                    <div class="text-center p-3 border-2 border-surface shadow-lg rounded-md bg-surface-container-high rounded-md">
                      <div class="text-xs uppercase font-bold text-on-surface-variant">CHA</div>
                      <div class="text-xl font-bold text-primary">{{ monster.entity.cha }}</div>
                      <div class="text-xs text-tertiary">{{ getModifier(monster.entity.cha) }}</div>
                    </div>
                  </div>
                }

                <!-- Saving Throws -->
                @if (monster.entity.save && Object.keys(monster.entity.save).length > 0) {
                  <div class="my-3 px-4 py-3 bg-surface border-l-4 border-secondary rounded-md ">
                    <span class="font-bold text-sm text-on-surface mr-2">Saving Throws:</span>
                    @for (saveEntry of Object.entries(monster.entity.save); track saveEntry[0]) {
                      <span class="text-sm text-on-surface-variant">{{ saveEntry[0] |capitalizeFirst}} {{ saveEntry[1] }}</span>
                      @if (!$last) {
                        <span class="text-on-surface-variant">, </span>
                      }
                    }
                  </div>
                }

                <!-- Skills -->
                @if (monster.entity.skill && Object.keys(monster.entity.skill).length > 0) {
                  <div class="my-3 px-4 py-3 bg-surface border-l-4 border-secondary rounded-md ">
                    <span class="font-bold text-sm text-on-surface mr-2">Skills:</span>
                    @for (skillEntry of Object.entries(monster.entity.skill); track skillEntry[0]) {
                      <span class="text-sm text-on-surface-variant">{{ skillEntry[0] | capitalizeFirst}} {{ skillEntry[1] }}</span>
                      @if (!$last) {
                        <span class="text-on-surface-variant">, </span>
                      }
                    }
                  </div>
                }

                <!-- Senses -->
                @if (monster.entity.senses && monster.entity.senses.length > 0) {
                  <div class="my-3 px-4 py-3 bg-surface border-l-4 border-secondary rounded-md ">
                    <span class="font-bold text-sm text-on-surface mr-2">Senses:</span>
                    @for (sense of monster.entity.senses; track sense) {
                      <span class="text-sm text-on-surface-variant">{{ sense }}</span>
                      @if (!$last) {
                        <span class="text-on-surface-variant">, </span>
                      }
                    }
                  </div>
                }

                <!-- Languages -->
                @if (monster.entity.languages && monster.entity.languages.length > 0) {
                  <div class="my-3 px-4 py-3 bg-surface border-l-4 border-secondary rounded-md ">
                    <span class="font-bold text-sm text-on-surface mr-2">Languages:</span>
                    @for (lang of monster.entity.languages; track lang) {
                      <span class="text-sm text-on-surface-variant">{{ lang }}</span>
                      @if (!$last) {
                        <span class="text-on-surface-variant">, </span>
                      }
                    }
                  </div>
                }

                <!-- Immunities, Resists, Vulnerabilities -->
                @if (monster.entity.immune && monster.entity.immune.length > 0) {
                  <div class="my-3 px-4 py-3 bg-surface border-l-4 border-secondary rounded-md ">
                    <span class="font-bold text-sm text-on-surface mr-2">Immunities:</span>
                    @for (immune of monster.entity.immune; track immune.text) {
                      <span class="text-sm text-on-surface-variant">{{ immune.text |capitalizeFirst}}</span>
                      @if (!$last) {
                        <span class="text-on-surface-variant">, </span>
                      }
                    }
                  </div>
                }

                @if (monster.entity.resist && monster.entity.resist.length > 0) {
                  <div class="my-3 px-4 py-3 bg-surface border-l-4 border-secondary rounded-md ">
                    <span class="font-bold text-sm text-on-surface mr-2">Resistances:</span>
                    @for (resist of monster.entity.resist; track resist.text) {
                      <span class="text-sm text-on-surface-variant">{{ resist.text }}</span>
                      @if (!$last) {
                        <span class="text-on-surface-variant">, </span>
                      }
                    }
                  </div>
                }

                @if (monster.entity.vulnerable && monster.entity.vulnerable.length > 0) {
                  <div class="my-3 px-4 py-3 bg-surface border-l-4 border-secondary rounded-md ">
                    <span class="font-bold text-sm text-on-surface mr-2">Vulnerabilities:</span>
                    @for (vuln of monster.entity.vulnerable; track vuln.text) {
                      <span class="text-sm text-on-surface-variant">{{ vuln.text }}</span>
                      @if (!$last) {
                        <span class="text-on-surface-variant">, </span>
                      }
                    }
                  </div>
                }

                @if (monster.entity.conditionImmune && monster.entity.conditionImmune.length > 0) {
                  <div class="my-3 px-4 py-3 bg-surface border-l-4 border-tertiary rounded-md ">
                    <span class="font-bold text-sm text-on-surface mr-2">Condition Immunities:</span>
                    @for (cond of monster.entity.conditionImmune; track cond.text) {
                      <span class="text-sm text-on-surface-variant">{{ cond.text }}</span>
                      @if (!$last) {
                        <span class="text-on-surface-variant">, </span>
                      }
                    }
                  </div>
                }

                <!-- Spellcasting -->
                @if (getMonsterSpellcastingBlocks(monster.entity.spellcasting).length > 0) {
                  <div class="mt-6 pt-4 border-t border-outline-variant">
                    <h4 class="font-bold text-lg mb-3 text-on-surface">Spellcasting</h4>
                    @for (spell of getMonsterSpellcastingBlocks(monster.entity.spellcasting); track spell.name) {
                      <div class="my-3 px-4 py-3 bg-surface border-l-4 border-purple rounded-md ">
                        @if (spell.headerEntries?.length) {
                          <div class="mt-2 space-y-1">
                            @for (line of spell.headerEntries; track $index) {
                              <div class="font-bold text-on-surface mb-1">{{ formatSpellText(line) }}</div>
                            }
                          </div>
                        }
                        @if (hasSpellList(spell.will)) {
                          <div class="mt-2 text-sm text-on-surface">
                            <span class="font-semibold">At will:</span>
                            <span> {{ formatSpellList(spell.will) }}</span>
                          </div>
                        }
                        @if (hasSpellMap(spell.daily)) {
                          <div class="mt-2 space-y-1 text-sm text-on-surface">
                            @for (key of getSortedSpellKeys(spell.daily); track key) {
                              <div>
                                <span class="font-semibold">{{ formatDailyLabel(key) }}:</span>
                                <span> {{ formatSpellArray(spell.daily?.[key]) }}</span>
                              </div>
                            }
                          </div>
                        }
                        @if (hasSpellMap(spell.known)) {
                          <div class="mt-2 space-y-1 text-sm text-on-surface">
                            @for (key of getSortedSpellKeys(spell.known); track key) {
                              <div>
                                <span class="font-semibold">{{ formatKnownLabel(key) }}:</span>
                                <span> {{ formatSpellArray(spell.known?.[key]) }}</span>
                              </div>
                            }
                          </div>
                        }
                      </div>
                    }
                  </div>
                }

                <!-- Traits -->
                @if (monster.entity.trait && monster.entity.trait.length > 0) {
                  <div class="mt-6 pt-4 border-t border-outline-variant">
                    <h4 class="font-bold text-lg mb-3 text-on-surface">Traits</h4>
                    @for (trait of monster.entity.trait; track trait.name) {
                      <div class="my-3 px-4 py-3 bg-surface border-l-4 border-blue rounded-md ">
                        <div class="font-bold text-on-surface mb-1">{{ trait.name }}</div>
                        @if (trait.entries && trait.entries.length > 0) {
                          @for (entry of trait.entries; track $index) {
                            <div class="text-sm leading-relaxed text-on-surface-variant">
                              <app-entry-renderer [entry]="entry"></app-entry-renderer>
                            </div>
                          }
                        }
                      </div>
                    }
                  </div>
                }

                <!-- Actions -->
                @if (monster.entity.action && monster.entity.action.length > 0) {
                  <div class="mt-6 pt-4 border-t border-outline-variant">
                    <h4 class="font-bold text-lg mb-3 text-on-surface">Actions</h4>
                    @for (action of monster.entity.action; track action.name) {
                      <div class="my-3 px-4 py-3 bg-surface border-l-4 border-tertiary rounded-md ">
                        <div class="font-bold text-on-surface mb-1">{{ action.name }}</div>
                        @if (action.entries && action.entries.length > 0) {
                          @for (entry of action.entries; track $index) {
                            <div class="text-sm leading-relaxed text-on-surface-variant">
                              <app-entry-renderer [entry]="entry"></app-entry-renderer>
                            </div>
                          }
                        }
                      </div>
                    }
                  </div>
                }

                <!-- Reactions -->
                @if (monster.entity.reaction && monster.entity.reaction.length > 0) {
                  <div class="mt-6 pt-4 border-t border-outline-variant">
                    <h4 class="font-bold text-lg mb-3 text-on-surface">Reactions</h4>
                    @for (reaction of monster.entity.reaction; track reaction.name) {
                      <div class="my-3 px-4 py-3 bg-surface border-l-4 border-tertiary rounded-md ">
                        <div class="font-bold text-on-surface mb-1">{{ reaction.name }}</div>
                        @if (reaction.entries && reaction.entries.length > 0) {
                          @for (entry of reaction.entries; track $index) {
                            <div class="text-sm leading-relaxed text-on-surface-variant">
                              <app-entry-renderer [entry]="entry"></app-entry-renderer>
                            </div>
                          }
                        }
                      </div>
                    }
                  </div>
                }

                <!-- Legendary Actions -->
                @if (monster.entity.legendary && monster.entity.legendary.length > 0) {
                  <div class="mt-6 pt-4 border-t border-outline-variant">
                    <h4 class="font-bold text-lg mb-3 text-on-surface">Legendary Actions</h4>
                    @for (action of monster.entity.legendary; track action.name) {
                      <div class="my-3 px-4 py-3 bg-surface border-l-4 border-tertiary rounded-md ">
                        <div class="font-bold text-on-surface mb-1">{{ action.name }}</div>
                        @if (action.entries && action.entries.length > 0) {
                          @for (entry of action.entries; track $index) {
                            <div class="text-sm leading-relaxed text-on-surface-variant">
                              <app-entry-renderer [entry]="entry"></app-entry-renderer>
                            </div>
                          }
                        }
                      </div>
                    }
                  </div>
                }

                <!-- Lair Actions -->
                @if (monster.entity.legendaryActionsLair && monster.entity.legendaryActionsLair.length > 0) {
                  <div class="mt-6 pt-4 border-t border-outline-variant">
                    <h4 class="font-bold text-lg mb-3 text-on-surface">Lair Actions</h4>
                    @for (action of monster.entity.legendaryActionsLair; track action.name) {
                      <div class="my-3 px-4 py-3 bg-surface border-l-4 border-tertiary rounded-md ">
                        <div class="font-bold text-on-surface mb-1">{{ action.name }}</div>
                        @if (action.entries && action.entries.length > 0) {
                          @for (entry of action.entries; track $index) {
                            <div class="text-sm leading-relaxed text-on-surface-variant">
                              <app-entry-renderer [entry]="entry"></app-entry-renderer>
                            </div>
                          }
                        }
                      </div>
                    }
                  </div>
                }
                  </div>
                }
              }
            </div>
          }
        </div>
      } @else {
        <div class="text-center py-10 px-5 text-on-surface-variant text-base">
          <p>No monsters or companions yet.</p>
        </div>
      }
    </div>
  `,
})
export class MonstersPageComponent {
  characterData = input.required<ExportedCharacter | null>();
  private store = inject(CharacterStore);
  helpers = inject(CharacterHelpersService);
  expandedItems = signal<Set<string>>(new Set());
  
  highlightedId = signal<string | null>(null);

  monsters = computed(() => 
    (this.characterData()?.monsters ?? []).sort((a, b) => {
      // First: hpEnabled monsters first (true before false)
      const aHpEnabled = a.hpEnabled ? 1 : 0;
      const bHpEnabled = b.hpEnabled ? 1 : 0;
      
      if (aHpEnabled !== bHpEnabled) {
        return bHpEnabled - aHpEnabled; // true (1) sorts before false (0)
      }
      
      // Then: sort by CR (treating ? and no CR as -1)
      const getCRValue = (cr: any): number => {
        if (!cr) return -1;
        const crStr = typeof cr === 'string' ? cr : cr.cr;
        if (crStr === '?' || !crStr) return -1;
        
        // Handle fractions like "1/4", "1/2", etc.
        if (crStr.includes('/')) {
          const [numerator, denominator] = crStr.split('/').map(Number);
          if (!isNaN(numerator) && !isNaN(denominator) && denominator !== 0) {
            return numerator / denominator;
          }
          return -1;
        }
        
        const parsed = parseFloat(crStr);
        return isNaN(parsed) ? -1 : parsed;
      };
      
      const aCR = getCRValue(a.entity?.cr);
      const bCR = getCRValue(b.entity?.cr);
      
      return aCR - bCR;
    })
  );

  constructor() {
    // Handle scroll/highlight on navigation
    effect(() => {
      const targetId = this.store.featureScrollTarget();
      if (!targetId) return;
      if (typeof document === 'undefined') return;
      setTimeout(() => {
        const el = document.getElementById(targetId);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'start' });
          this.highlightedId.set(targetId);
          setTimeout(() => this.highlightedId.set(null), 1600);
        }
        this.store.setFeatureScrollTarget(null);
      }, 0);
    });
  }

  hasAbilityScores(monster: Monster): boolean {
    const e = monster.entity;
    return !!(e && (e.str || e.dex || e.con || e.int || e.wis || e.cha));
  }

  getModifier(score: number | undefined): string {
    if (!score) return '+0';
    const mod = Math.floor((score - 10) / 2);
    return mod >= 0 ? `+${mod}` : `${mod}`;
  }

  updateMonsterHP(monster: Monster, value: string) {
    const numValue = Number(value);
    if (Number.isFinite(numValue)) {
      const maxHP = this.getEffectiveMonsterMaxHP(monster);
      monster.monsterCurrentHP = Math.max(0, Math.min(numValue, maxHP ?? 0));
    }
  }

  getEffectiveMonsterMaxHP(monster: Monster): number {
    if (monster.monsterMaxHpOverride !== null && monster.monsterMaxHpOverride !== undefined) {
      return monster.monsterMaxHpOverride;
    }
    return monster.monsterMaxHP ?? 0;
  }

  getMonsterMaxHpOverrideInput(monster: Monster): string {
    if (monster.monsterMaxHpOverride !== null && monster.monsterMaxHpOverride !== undefined) {
      return String(monster.monsterMaxHpOverride);
    }
    return String(monster.monsterMaxHP ?? 0);
  }

  onMonsterMaxHpOverrideInput(monster: Monster, value: string) {
    const trimmed = value.trim();
    if (!trimmed) {
      monster.monsterMaxHpOverride = monster.monsterMaxHP ?? 0;
    } else {
      const numValue = Number(trimmed);
      if (Number.isFinite(numValue) && numValue > 0) {
        monster.monsterMaxHpOverride = numValue;
      } else {
        monster.monsterMaxHpOverride = monster.monsterMaxHP ?? 0;
      }
    }
  }

  commitMonsterMaxHpOverride(monster: Monster) {
    // Adjust current HP if it exceeds new max
    const maxHP = this.getEffectiveMonsterMaxHP(monster);
    if (monster.monsterCurrentHP && monster.monsterCurrentHP > maxHP) {
      monster.monsterCurrentHP = maxHP;
    }
  }

  clearMonsterMaxHpOverride(monster: Monster) {
    monster.monsterMaxHpOverride = null;
    // Adjust current HP if it exceeds base max
    const baseMax = monster.monsterMaxHP ?? 0;
    if (monster.monsterCurrentHP && monster.monsterCurrentHP > baseMax) {
      monster.monsterCurrentHP = baseMax;
    }
  }

  updateMonsterTempHP(monster: Monster, value: string) {
    const numValue = Number(value);
    if (Number.isFinite(numValue)) {
      monster.monsterTempHP = Math.max(0, numValue);
    }
  }

  clearMonsterTempHP(monster: Monster) {
    monster.monsterTempHP = 0;
  }

  toggleExpanded(id: string) {
    const expanded = this.expandedItems();
    if (expanded.has(id)) {
      expanded.delete(id);
    } else {
      expanded.add(id);
    }
    this.expandedItems.set(new Set(expanded));
  }

  isExpanded(id: string): boolean {
    return this.expandedItems().has(id);
  }

  isNumber(value: unknown): value is number {
    return typeof value === 'number';
  }

  hasAcProperty(value: unknown): value is { ac: number; condition?: string } {
    return typeof value === 'object' && value !== null && 'ac' in value;
  }

  getEntryText(entry: unknown): string {
    if (typeof entry === 'string') {
      return entry;
    }
    if (typeof entry === 'object' && entry !== null && 'text' in entry) {
      return String((entry as { text: unknown }).text);
    }
    return '';
  }

  private isMonsterSpellcasting(value: unknown): value is MonsterSpellcasting {
    return typeof value === 'object' && value !== null && 'name' in value;
  }
  getMonsterSpellcastingBlocks(
    spellcasting: Array<MonsterSpellcasting | unknown> | null | undefined
  ): MonsterSpellcasting[] {
    if (!spellcasting || spellcasting.length === 0) return [];
    return spellcasting.filter((item) => this.isMonsterSpellcasting(item)) as MonsterSpellcasting[];
  }

  hasSpellList(list: MonsterCasting[] | undefined): boolean {
    return Array.isArray(list) && list.length > 0;
  }

  hasSpellMap(map: Record<string, string[]> | undefined): boolean {
    return !!map && Object.keys(map).length > 0;
  }

  formatSpellAbility(ability: string): string {
    const map: Record<string, string> = {
      str: 'Strength',
      dex: 'Dexterity',
      con: 'Constitution',
      int: 'Intelligence',
      wis: 'Wisdom',
      cha: 'Charisma',
    };
    const key = ability.toLowerCase();
    return map[key] ?? ability;
  }

  formatSpellList(list: MonsterCasting[] | undefined): string {
    if (!list) return '';
    const textList = list
      .map((casting) => (typeof casting === 'string' ? casting : casting.entry ?? ''))
      .map((text) => text.trim())
      .filter((text) => text.length > 0);
    return this.formatSpellArray(textList);
  }

  formatSpellArray(list: string[] | undefined): string {
    if (!list || list.length === 0) return '';
    return list.map((text) => this.formatSpellText(text)).join(', ');
  }

  getSortedSpellKeys(map: Record<string, string[]> | undefined): string[] {
    if (!map) return [];
    return Object.keys(map).sort((a, b) => this.dailyKeySort(a) - this.dailyKeySort(b));
  }

  formatSpeeds(speeds: Record<string, number> | undefined): string {
    if (!speeds) return '—';
    const orderedKeys: Array<keyof typeof speeds> = ['walk', 'climb', 'swim', 'fly', 'burrow'];
    const parts = orderedKeys
      .map((key) => {
        const value = speeds[key];
        if (typeof value !== 'number') return null;
        const keyText = String(key);
        const label = keyText === 'walk' ? 'Walk' : keyText.charAt(0).toUpperCase() + keyText.slice(1);
        return `${label} ${value} ft.`;
      })
      .filter((part): part is string => Boolean(part));
    return parts.length ? parts.join(', ') : '—';
  }

  formatDailyLabel(key: string): string {
    const isEach = key.endsWith('e');
    const value = isEach ? key.slice(0, -1) : key;
    const count = Number(value);
    const base = Number.isFinite(count) ? `${count}/day` : `${value}/day`;
    return isEach ? `${base} each` : base;
  }

  formatKnownLabel(level: string): string {
    const levelInt = Number(level);
    if (!Number.isFinite(levelInt)) return `Level ${level}`;
    if (levelInt === 0) return 'Cantrips';
    if (levelInt === 1) return '1st level';
    if (levelInt === 2) return '2nd level';
    if (levelInt === 3) return '3rd level';
    if (levelInt >= 4 && levelInt <= 9) return `${levelInt}th level`;
    return `Level ${level}`;
  }

  formatSpellText(text: string): string {
    return text
      .replace(/\{@spell\s([^|}]+)(?:\|[^}]+)?\}/g, '$1')
      .replace(/\{@skill\s([^|}]+)(?:\|[^}]+)?\}/g, '$1')
      .replace(/\{@action\s([^|}]+)(?:\|[^}]+)?\}/g, '$1')
      .replace(/\{@condition\s([^|}]+)(?:\|[^}]+)?\}/g, '$1')
      .replace(/\{@damage\s([^}]+)\}/g, '$1')
      .replace(/\{@dice\s([^}]+)\}/g, '$1')
      .replace(/\{@dc\s([^}]+)\}/g, 'DC $1')
      .replace(/\{@hit\s([^}]+)\}/g, '+$1')
      .replace(/\{@variantrule\s([^|}]+)(?:\|[^}]+)?\}/g, '$1')
      .replace(/\{@book\s([^|}]+)(?:\|[^}]+)?\}/g, '$1')
      .replace(/\{@i\s([^}]+)\}/g, '$1')
      .replace(/\{@b\s([^}]+)\}/g, '$1')
      .replace(/\{@recharge\s([^}]+)\}/g, 'Recharge $1')
      .replace(/\{@actSave\s([^}]+)\}/g, '$1 save')
      .replace(/\{@actSaveFail\s([^}]+)\}/g, 'On fail: $1')
      .replace(/\{@actSaveSuccess\s([^}]+)\}/g, 'On success: $1')
      .replace(/\{@actSaveSuccessOrFail\s([^}]+)\}/g, '$1');
  }

  private dailyKeySort(key: string): number {
    const numeric = Number(key.replace(/e$/, ''));
    return Number.isFinite(numeric) ? numeric : Number.MAX_SAFE_INTEGER;
  }

  getSizeText(size: string): string {
    const sizeMap: Record<string, string> = {
      'T': 'Tiny',
      'S': 'Small',
        'M': 'Medium',
        'L': 'Large',
        'H': 'Huge',
        'G': 'Gargantuan',
    };
    return sizeMap[size] || size;
  }

  getInitiative(monster: Monster): string {
    if (!monster.entity) return '+0';
    
    // Base initiative is DEX modifier
    const dexMod = Math.floor(((monster.entity.dex ?? 10) - 10) / 2);
    let initiative = dexMod;
    
    // Add initiative bonus if it exists
    if (monster.entity.initiative?.bonus) {
      initiative += monster.entity.initiative.bonus;
    }
    
    // Add proficiency bonus if it exists
    if (monster.entity.initiative?.proficiency && monster.entity.cr) {
      const crValue = typeof monster.entity.cr === 'string' ? monster.entity.cr : monster.entity.cr.cr;
      const profBonus = this.getProficiencyBonusFromCR(crValue);
      initiative += monster.entity.initiative.proficiency * profBonus;
    }
    
    let result = initiative >= 0 ? `+${initiative}` : `${initiative}`;
    
    // Append advantage mode if it exists
    if (monster.entity.initiative?.advantageMode === 'advantage') {
      result += ' (Adv.)';
    }
    
    return result;
  }

  getProficiencyBonusFromCR(cr: string | number): number {
    let crValue: number;
    
    if (typeof cr === 'number') {
      crValue = cr;
    } else {
      // Parse string CR (e.g., "1/4", "1/2", "5", "10")
      if (cr.includes('/')) {
        const [numerator, denominator] = cr.split('/').map(Number);
        crValue = numerator / denominator;
      } else if (cr.includes('?')) {
        crValue = 0;
      } else {
        crValue = Number(cr);
      }
    }
    
    // Calculate proficiency bonus: floor((CR + 7) / 4)
    return 1 + (Math.ceil((Math.max(1, crValue)) / 4));
  }

  Object = Object;
}
