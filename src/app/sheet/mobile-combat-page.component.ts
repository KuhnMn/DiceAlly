import { CombatActionColumnsComponent } from './combat-action-columns.component';
import { CombatActionComponent } from './combat-action.component';
import { ConcentrationControlComponent } from './concentration-control.component';
import { Component } from '@angular/core';
import { CharacterInfoPageComponent } from './character-info-page.component';
import { UiIconComponent } from '../ui-icon.component';
import { BasicCombatActionsComponent } from './basic-combat-actions.component';
import { SheetListLayoutComponent } from './sheet-list-layout.component';

@Component({
  selector: 'app-mobile-combat-page',
  imports: [CombatActionColumnsComponent, CombatActionComponent, BasicCombatActionsComponent, UiIconComponent, ConcentrationControlComponent, SheetListLayoutComponent],
  styles: [`
    :host { display: block; min-width: 0; }
    .combat-multiple-columns { display: grid; grid-template-columns: repeat(var(--combat-columns), minmax(0, 1fr)); gap: 1rem; align-items: start; }
    .combat-multiple-columns > div { min-width: 0; margin-top: 0; }
    .combat-multiple-columns > div:only-child { grid-column: 1 / -1; }
  `],
  template: `
    @if (character(); as c) {
          <!-- Combat Actions -->
          <div class="border-4 border-surface rounded-lg p-4 bg-surface-container-low shadow-lg">
            <div class="flex items-center gap-2 mb-3 border-b-2 border-outline-variant pb-2">
              <h3 class="flex-1 text-sm font-bold uppercase text-center">Combat</h3>
              <app-sheet-list-layout #listLayout />
            </div>
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
              <div class="combat-groups space-y-3 text-sm" [class.combat-multiple-columns]="listLayout.displayColumns() > 1" [style.--combat-columns]="listLayout.displayColumns()">
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
                        @if (groupedCombatActions()[actionType]?.length) { <app-combat-action-columns /> }
                        @for (action of groupedCombatActions()[actionType]; track action) {
                          <app-combat-action [action]="action" [sheet]="characterData()!" [linkType]="getCombatActionLinkType(action)" [navigable]="isActionClickable(action)" (navigated)="navigateToCombatAction(action)" />
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
