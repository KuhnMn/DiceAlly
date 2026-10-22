import { MobileSheetActionsComponent } from './mobile-sheet-actions.component';
import { ConcentrationService } from '../services/concentration.service';
import { CharacterStore } from '../stores/character.store';
import { SheetAcControlComponent } from './sheet-ac-control.component';
import { SheetSpeedControlComponent } from './sheet-speed-control.component';
import { SheetHealthDetailsComponent } from './sheet-health-details.component';
import { SheetStatBadgeComponent } from './sheet-stat-badge.component';
import { HitDiceTrackerComponent } from './hit-dice-tracker.component';
import { Component, ElementRef, inject, input, output, signal, viewChild, OnDestroy } from '@angular/core';
import { ExportedCharacter } from '../models/character.model';
import { CharacterHelpersService } from './character-helpers.service';
import { ConditionsComponent } from './conditions.component';
import { UiIconComponent } from '../ui-icon.component';
import { applyHealthAdjustment, HealthAction } from './sheet-health';
import { DialogScrollLockService } from '../editor/dialog-scroll-lock.service';

@Component({
  selector: 'app-mobile-sheet-status',
  imports: [MobileSheetActionsComponent, SheetSpeedControlComponent, SheetAcControlComponent, SheetHealthDetailsComponent, SheetStatBadgeComponent, HitDiceTrackerComponent, ConditionsComponent, UiIconComponent],
  host: { class: 'block sm:hidden', '(document:pointerdown)': 'dismissRest($event)', '(document:keydown.escape)': 'closeRest()' },
  template: `
    @if (sheet().character; as character) {
      <div class="grid grid-cols-[minmax(0,1fr)_4rem_minmax(0,1fr)] items-center gap-3 pb-2" aria-label="Character status">
        <div class="grid min-w-0 grid-cols-[repeat(2,3.25rem)] items-center justify-center gap-x-4 gap-y-1">
          <app-sheet-ac-control class="justify-self-center" [characterData]="sheet()" />
          <app-sheet-stat-badge class="justify-self-center" label="Init." shape="octagon" tone="rose" [value]="helpers.formatSigned(helpers.initiative(character))" [proficient]="character.proficiencies?.initiative ?? false" />
          <app-sheet-stat-badge class="justify-self-center" label="PB" shape="rounded" tone="teal" [value]="helpers.formatSigned(helpers.proficiencyBonus(character))" />
          <app-sheet-speed-control class="justify-self-center" [sheet]="sheet()" [compact]="true" />
        </div>
        <div class="flex min-w-0 flex-col items-center gap-1 self-end">
          <div class="flex aspect-square w-full max-w-16 items-center justify-center overflow-hidden rounded-full border-2 border-outline bg-secondary-container text-2xl text-on-secondary-container">
            @if (sheet().portaitUrl) {
              <img [src]="sheet().portaitUrl" [alt]="'Portrait of ' + (character.name || 'Unnamed Character')" class="h-full w-full object-cover" />
            } @else { <app-ui-icon name="image" /> }
          </div>
          <p class="text-center text-[10px] text-on-surface-variant">Level <strong class="text-on-surface">{{ character.level ?? 1 }}</strong></p>
          <button type="button" (click)="character.hasInspiration = !character.hasInspiration" [attr.aria-pressed]="character.hasInspiration ?? false" [title]="character.hasInspiration ? 'Use Inspiration' : 'Gain Inspiration'" aria-label="Toggle Inspiration" class="flex h-8 w-full max-w-12 items-center justify-center rounded-lg border border-outline-variant text-base" [class.bg-tertiary-container]="character.hasInspiration" [class.text-on-tertiary-container]="character.hasInspiration" [class.text-on-surface-variant]="!character.hasInspiration"><app-ui-icon name="sparkles" [filled]="character.hasInspiration ?? false" /></button>
        </div>
        <div class="min-w-0 space-y-1 self-end">
          <button type="button" (click)="openHealth()" class="min-h-18 w-full min-w-0 rounded-xl bg-surface-container-high px-2 py-2 text-center" [attr.aria-label]="'Adjust health and conditions: ' + (character.currentHp ?? 0) + ' of ' + maxHp() + ' HP, ' + temporaryHp() + ' temporary HP'">
            <div class="text-xs font-semibold text-on-surface-variant">Health</div>
            <div class="mt-0.5 text-base font-bold tabular-nums">{{ character.currentHp ?? 0 }} / {{ maxHp() }}</div>
            <div class="mt-1.5 flex h-1.5 overflow-hidden rounded-full bg-surface" aria-hidden="true"><div class="h-full shrink-0 bg-rose transition-[width] duration-300" [style.width.%]="healthPercent()"></div><div class="h-full shrink-0 bg-green transition-[width] duration-300" [style.width.%]="temporaryHealthPercent()"></div></div>
          </button>
          <div class="flex items-center gap-1">
            <details #restMenu name="sheet-actions" class="relative flex-1">
              <summary aria-label="Rest" title="Rest" class="flex h-10 min-w-8 cursor-pointer list-none items-center justify-center rounded-full bg-purple-container text-base text-on-purple-container [&::-webkit-details-marker]:hidden"><app-ui-icon name="moon" /></summary>
              <div class="absolute right-0 top-full z-50 mt-1 w-44 rounded-lg border border-outline-variant bg-surface-container-high p-1 shadow-lg">
                <button type="button" [disabled]="saving()" (click)="restMenu.open = false; shortRest.emit()" class="min-h-11 w-full rounded px-3 py-2 text-left text-sm hover:bg-surface-container"><app-ui-icon name="campfire" /> Short Rest</button>
                <button type="button" [disabled]="saving()" (click)="restMenu.open = false; longRest.emit()" class="min-h-11 w-full rounded px-3 py-2 text-left text-sm hover:bg-surface-container"><app-ui-icon name="rest" /> Long Rest</button>
              </div>
            </details>
            <app-mobile-sheet-actions class="min-w-0 flex-[2]" [actionsOnly]="true" [saving]="saving()" [openingEditor]="openingEditor()" [dirty]="dirty()" (save)="save.emit()" (edit)="edit.emit()" />
          </div>
        </div>
      </div>
      <button type="button" (click)="openHealth()" class="mb-1 flex min-h-8 w-full items-center gap-2 rounded-lg bg-surface-container px-2 text-left text-xs" aria-label="Manage active conditions"><app-ui-icon name="info" /><span class="font-semibold">Conditions & Effects</span><span class="min-w-0 flex-1 truncate text-primary">{{ sheet().conditions?.join(' \u00b7 ') || 'None' }}</span><app-ui-icon name="chevron" /></button>
      <dialog #healthDialog (close)="releaseScroll()" (click)="closeOnBackdrop($event)" class="fixed inset-x-0 bottom-0 top-auto m-0 max-h-[85dvh] w-full max-w-none overflow-hidden rounded-t-2xl border border-outline-variant bg-surface p-0 text-on-surface open:flex open:flex-col backdrop:bg-black/50 sm:inset-0 sm:m-auto sm:max-w-md sm:rounded-2xl" aria-labelledby="mobile-health-title">
        <div class="flex shrink-0 items-center justify-between gap-2 border-b border-outline-variant px-4 py-2"><h2 id="mobile-health-title" class="text-lg font-bold">Health, Hit Dice & Conditions</h2><button type="button" (click)="healthDialog.close()" class="flex min-h-11 min-w-11 items-center justify-center rounded-lg bg-surface-container" aria-label="Close health panel"><app-ui-icon name="close" /></button></div>
        <div data-health-content class="min-h-0 min-w-0 flex-1 overflow-auto overscroll-contain p-4">
        <div class="mb-4 text-2xl font-bold" aria-live="polite">{{ character.currentHp ?? 0 }} / {{ maxHp() }} HP <span class="text-sm font-normal">{{ character.tempHp ?? 0 }} temp</span></div>
        <label class="block text-sm font-semibold">Amount<input type="number" inputmode="numeric" min="0" [value]="amount()" (input)="amount.set($any($event.target).value)" class="mt-1 block min-h-11 w-full rounded-lg border border-outline bg-surface-container px-3 py-2 text-base" /></label>
        <div class="my-3 grid grid-cols-3 gap-2">
          <button type="button" (click)="adjust('damage')" class="min-h-11 rounded-lg bg-error-container px-2 py-2 text-sm font-semibold text-on-error-container">Damage</button>
          <button type="button" (click)="adjust('heal')" class="min-h-11 rounded-lg bg-primary-container px-2 py-2 text-sm font-semibold text-on-primary-container">Heal</button>
          <button type="button" (click)="adjust('temp')" class="min-h-11 rounded-lg bg-secondary-container px-2 py-2 text-sm font-semibold text-on-secondary-container">Set temp HP</button>
        </div>
        <p class="mb-4 text-xs text-on-surface-variant" role="status">{{ dirty() ? feedback() || 'Save the sheet to keep your changes.' : 'Changes are saved.' }}</p>
        <app-sheet-health-details [characterData]="sheet()" />
        <app-hit-dice-tracker [character]="character" />
        <h3 class="mb-2 text-sm font-semibold">Conditions & Effects ({{ sheet().conditions?.length ?? 0 }})</h3>
        <app-conditions [activeConditions]="sheet().conditions ?? []" [descriptions]="sheet().referenceDescriptions?.conditions ?? []" (conditionsChanged)="sheet().conditions = $event" />
        </div>
        <div data-health-footer class="flex shrink-0 justify-end border-t border-outline-variant bg-surface px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <button type="button" [disabled]="saving() || !dirty()" (click)="save.emit()" class="min-h-11 rounded-lg bg-primary-container px-4 py-2 text-sm font-semibold text-on-primary-container disabled:opacity-50">{{ saving() ? 'Saving…' : dirty() ? 'Save changes' : 'Saved' }}</button>
        </div>
      </dialog>
    }
  `,
})
export class MobileSheetStatusComponent implements OnDestroy {
  private readonly store = inject(CharacterStore);
  private readonly concentration = inject(ConcentrationService);
  readonly sheet = input.required<ExportedCharacter>();
  readonly openingEditor = input(false);
  readonly edit = output<void>();
  readonly saving = input(false);
  readonly dirty = input(false);
  readonly save = output<void>();
  readonly shortRest = output<void>();
  readonly longRest = output<void>();
  private readonly restMenu = viewChild<ElementRef<HTMLDetailsElement>>('restMenu');
  closeRest() {
    const menu = this.restMenu()?.nativeElement;
    if (menu) menu.open = false;
  }
  dismissRest(event: Event) {
    if (!(event.target instanceof Node)) return;
    if (!this.restMenu()?.nativeElement.contains(event.target)) {
      const menu = this.restMenu()?.nativeElement;
      if (menu) menu.open = false;
    }
  }
  readonly helpers = inject(CharacterHelpersService);
  readonly amount = signal('');
  readonly feedback = signal('');
  private readonly dialog = viewChild<ElementRef<HTMLDialogElement>>('healthDialog');
  private readonly scrollLock = inject(DialogScrollLockService);
  private locked = false;
  maxHp() { return this.sheet().character?.maxHpOverride ?? this.sheet().character?.maxHp ?? 0; }
  temporaryHp() { return Math.max(0, this.sheet().character?.tempHp ?? 0); }
  private healthBarTotal() { return Math.max(0, this.maxHp()) + this.temporaryHp(); }
  healthPercent() {
    const hp = Math.max(0, Math.min(this.maxHp(), this.sheet().character?.currentHp ?? 0));
    return this.healthBarTotal() > 0 ? hp / this.healthBarTotal() * 100 : 0;
  }
  temporaryHealthPercent() { return this.healthBarTotal() > 0 ? this.temporaryHp() / this.healthBarTotal() * 100 : 0; }
  armorClass() {
    const character = this.sheet().character;
    if (!character) return 10;
    return character.armorClassOverride ?? (character.calculateAC ? this.helpers.calculateArmorClass(character, this.sheet().inventory ?? []).ac : character.armorClass ?? 10);
  }
  openHealth() {
    const dialog = this.dialog()?.nativeElement;
    if (!dialog || dialog.open) return;
    this.feedback.set('');
    dialog.showModal();
    this.scrollLock.lock();
    this.locked = true;
  }
  releaseScroll() { if (this.locked) { this.scrollLock.unlock(); this.locked = false; } }
  ngOnDestroy() { const dialog = this.dialog()?.nativeElement; if (dialog?.open) dialog.close(); this.releaseScroll(); }
  closeOnBackdrop(event: MouseEvent) {
    const dialog = this.dialog()?.nativeElement;
    if (!dialog || event.target !== dialog) return;
    const bounds = dialog.getBoundingClientRect();
    if (event.clientY < bounds.top || event.clientY > bounds.bottom || event.clientX < bounds.left || event.clientX > bounds.right) dialog.close();
  }
  adjust(action: HealthAction) {
    const character = this.sheet().character;
    const amount = Number(this.amount());
    if (!character || !this.amount().trim() || !Number.isFinite(amount) || amount < 0) return;
    applyHealthAdjustment(character, action, amount);
    this.store.setCharacter({ ...this.sheet() });
    if (action === 'damage') void this.concentration.remindAfterDamage(this.sheet(), amount);
    this.amount.set('');
    this.feedback.set('Health updated. Save the sheet to keep your changes.');
  }
}
