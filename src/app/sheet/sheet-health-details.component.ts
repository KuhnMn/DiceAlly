import { Component } from '@angular/core';
import { UiIconComponent } from '../ui-icon.component';
import { CharacterInfoPageComponent } from './character-info-page.component';

/** Uses the same HP, override and death-save actions as the desktop sheet. */
@Component({
  selector: 'app-sheet-health-details',
  imports: [UiIconComponent],
  template: `
    @if (character(); as c) {
      <section class="my-4 space-y-4 rounded-xl border border-outline-variant bg-surface-container p-3" aria-label="Health details and death saves">
        <div>
          <h3 class="mb-3 border-b border-outline-variant pb-2 text-sm font-bold">Maximum HP</h3>
          <div class="flex flex-wrap items-end gap-3 text-sm">
            <p class="flex-1 pb-3 text-on-surface-variant">Base HP <strong class="text-on-surface">{{ c.maxHp ?? 0 }}</strong></p>
            <label class="text-xs font-semibold text-on-surface-variant">Override
              <input type="number" inputmode="numeric" min="0" aria-label="Maximum HP override" [value]="maxHpOverrideInput()" (focus)="startMaxHpOverrideEdit()" (input)="onMaxHpOverrideInput($any($event.target).value)" (change)="commitMaxHpOverride()" (blur)="commitMaxHpOverride()" class="mt-1 block min-h-11 w-20 rounded-lg border border-outline-variant bg-surface px-3 text-base text-on-surface" />
            </label>
            <button type="button" (click)="clearMaxHpOverride()" class="min-h-11 rounded-lg px-3 text-primary">Reset</button>
          </div>
        </div>
        <div>
          <h3 class="mb-3 border-b border-outline-variant pb-2 text-sm font-bold">Death Saves</h3>
          <div class="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-1">
            <div class="min-w-0 rounded-lg bg-surface p-2">
              <p class="flex items-center justify-center gap-2 text-xs font-semibold text-primary"><app-ui-icon name="candle" /> Failures</p>
              <div class="flex flex-row-reverse justify-center">
                @for (i of [0, 1, 2]; track i) {
                  <label class="flex min-h-11 min-w-0 flex-1 cursor-pointer items-center justify-center"><input type="checkbox" [checked]="(c.deathSavesFailures ?? 0) > i" (change)="toggleDeathSaveFailure(i)" [attr.aria-label]="'Death save failure ' + (i + 1)" class="h-5 w-5 rounded border-2 border-primary accent-primary" /></label>
                }
              </div>
            </div>
            <button type="button" (click)="resetDeathSaves()" aria-label="Reset death saves" title="Reset death saves" class="flex h-9 w-9 items-center justify-center rounded-lg text-on-surface-variant hover:bg-primary-container hover:text-on-primary focus-visible:outline-2 focus-visible:outline-primary"><app-ui-icon name="reset" /></button>
            <div class="min-w-0 rounded-lg bg-surface p-2">
              <p class="flex items-center justify-center gap-2 text-xs font-semibold text-tertiary"><app-ui-icon name="heart" /> Successes</p>
              <div class="flex justify-center">
                @for (i of [0, 1, 2]; track i) {
                  <label class="flex min-h-11 min-w-0 flex-1 cursor-pointer items-center justify-center"><input type="checkbox" [checked]="(c.deathSavesSuccesses ?? 0) > i" (change)="toggleDeathSaveSuccess(i)" [attr.aria-label]="'Death save success ' + (i + 1)" class="h-5 w-5 rounded border-2 border-tertiary accent-tertiary" /></label>
                }
              </div>
            </div>
          </div>
        </div>
      </section>
    }
  `,
})
export class SheetHealthDetailsComponent extends CharacterInfoPageComponent {}
