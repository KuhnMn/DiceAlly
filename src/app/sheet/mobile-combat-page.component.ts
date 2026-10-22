import { ConcentrationControlComponent } from './concentration-control.component';
import { Component } from '@angular/core';
import { CharacterInfoPageComponent } from './character-info-page.component';
import { UiIconComponent } from '../ui-icon.component';
import { BasicCombatActionsComponent } from './basic-combat-actions.component';

@Component({
  selector: 'app-mobile-combat-page',
  imports: [BasicCombatActionsComponent, UiIconComponent, ConcentrationControlComponent],
  template: `
    @if (character(); as c) {
          <!-- Combat Actions -->
          <div class="border-4 border-surface rounded-lg p-4 bg-surface-container-low shadow-lg">
            <h3 class="text-sm font-bold uppercase text-center mb-3 border-b-2 border-outline-variant pb-2">
              Combat
            </h3>
            <div class="mb-4 flex flex-wrap items-center gap-2" role="group" aria-label="Concentration &amp; Round Tracker">
              <h4 class="w-full text-xs font-semibold tracking-wide text-on-surface-variant">Concentration &amp; Round Tracker</h4>
              @if (characterData(); as sheet) { <app-concentration-control class="min-w-0 flex-1 border-r border-outline-variant pr-3" [sheet]="sheet" /> }
              <div class="inline-flex shrink-0 items-center gap-1">
                <div class="inline-flex items-center gap-1 rounded-xl border border-outline-variant bg-surface-container p-1 shadow-sm">
                <button type="button" (click)="adjustRoundTracker(-1)" [disabled]="(c.roundTracker ?? 0) <= 0" class="flex h-11 w-10 items-center justify-center rounded-lg bg-surface-container-high text-lg text-primary transition-colors hover:bg-primary-container hover:text-on-primary-container focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-35" aria-label="Decrease round"><app-ui-icon name="minus" /></button>
                <input id="mobile-combat-round" type="number" inputmode="numeric" min="0" [value]="c.roundTracker ?? 0" (input)="updateRoundTracker($any($event.target).value)" class="h-11 w-9 appearance-none rounded-lg bg-surface text-center text-lg font-bold tabular-nums text-on-surface focus-visible:outline-2 focus-visible:outline-primary [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none [appearance:textfield]" aria-label="Round tracker value" />
                <button type="button" (click)="adjustRoundTracker(1)" class="flex h-11 w-10 items-center justify-center rounded-lg bg-primary-container text-lg text-on-primary-container transition-colors hover:brightness-110 focus-visible:outline-2 focus-visible:outline-primary" aria-label="Increase round"><app-ui-icon name="plus" /></button>
                </div>
                <button type="button" (click)="resetRoundTracker()" [class.invisible]="(c.roundTracker ?? 0) === 0" [disabled]="(c.roundTracker ?? 0) === 0" title="Reset" aria-label="Reset round tracker" class="flex h-11 w-10 items-center justify-center rounded-lg border border-outline-variant bg-surface-container-high text-lg text-on-surface transition-colors hover:bg-primary-container hover:text-on-primary-container focus-visible:outline-2 focus-visible:outline-primary"><app-ui-icon name="reset" /></button>
              </div>
            </div>
            @if (combatActions().length > 0 || characterData()?.basicActions?.length) {
              <div class="space-y-3 text-sm ">
                @for (actionType of ['ACTION', 'BONUS', 'REACTION', 'OTHER']; track actionType) {
                  @if ((groupedCombatActions()[actionType]?.length ?? 0) > 0 || (groupedBasicActions()[actionType]?.length ?? 0) > 0) {
                    <div>
                      <h4 class="text-xs font-bold uppercase text-on-surface-variant mb-2 pt-2 border-t border-outline-variant">
                        {{ getActionTypeLabel(actionType) }}
                      </h4>
                      <div class="space-y-1">
                        @if (groupedBasicActions()[actionType]?.length) {
                          <app-basic-combat-actions [actions]="groupedBasicActions()[actionType]" />
                        }
                        @for (action of groupedCombatActions()[actionType]; track action) {
                          <button
                            type="button"
                            data-page-swipe
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
                              <div class="min-w-0 line-clamp-5 text-right font-mono text-xs [overflow-wrap:anywhere]" [title]="action.damageOrHeal">{{ action.damageOrHeal }}</div>
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
    }
  `,
})
export class MobileCombatPageComponent extends CharacterInfoPageComponent {}
