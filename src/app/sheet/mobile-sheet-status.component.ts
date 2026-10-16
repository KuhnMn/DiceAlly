import { SheetAcControlComponent } from './sheet-ac-control.component';
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
  imports: [SheetAcControlComponent, SheetHealthDetailsComponent, SheetStatBadgeComponent, HitDiceTrackerComponent, ConditionsComponent, UiIconComponent],
  host: { class: 'block sm:hidden' },
  template: `
    @if (sheet().character; as character) {
      <div class="grid grid-cols-6 items-stretch gap-2 pb-2" aria-label="Character status">
        <button type="button" (click)="openHealth()" class="order-4 col-span-5 min-w-0 rounded-lg bg-primary-container px-3 py-2 text-left text-on-primary-container" aria-label="Adjust health and conditions">
          <div class="flex items-baseline justify-between gap-2 text-sm"><span class="font-semibold">HP {{ character.currentHp ?? 0 }} / {{ maxHp() }}</span>@if (character.tempHp) { <span class="text-xs">+{{ character.tempHp }} temp</span> }</div>
          <div class="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-container" aria-hidden="true"><div class="h-full bg-primary" [style.width.%]="healthPercent()"></div></div>
        </button>
        <button type="button" (click)="character.hasInspiration = !character.hasInspiration" [attr.aria-pressed]="character.hasInspiration ?? false" [title]="character.hasInspiration ? 'Use Inspiration' : 'Gain Inspiration'" aria-label="Toggle Inspiration" class="order-5 flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-outline-variant text-xl" [class.bg-tertiary-container]="character.hasInspiration" [class.text-on-tertiary-container]="character.hasInspiration" [class.text-on-surface-variant]="!character.hasInspiration"><app-ui-icon name="sparkles" [filled]="character.hasInspiration ?? false" /></button>
        <app-sheet-ac-control class="order-1 col-span-2 justify-self-center" [characterData]="sheet()" />
        <app-sheet-stat-badge class="order-2 col-span-2 justify-self-center" label="Init." shape="octagon" [value]="helpers.formatSigned(helpers.initiative(character))" />
        <app-sheet-stat-badge class="order-3 col-span-2 justify-self-center" label="PB" shape="octagon" [value]="helpers.formatSigned(helpers.proficiencyBonus(character))" />
      </div>
      <button type="button" (click)="openHealth()" class="mb-2 flex min-h-9 w-full items-center gap-2 rounded-lg bg-surface-container px-2 text-left text-xs" aria-label="Manage active conditions"><app-ui-icon name="info" /><span class="font-semibold">Conditions & Effects</span><span class="min-w-0 flex-1 truncate text-primary">{{ sheet().conditions?.length ? sheet().conditions?.join(' · ') : 'None' }}</span><app-ui-icon name="chevron" /></button>
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
        @if (!sheet().conditions?.length) { <p class="mb-2 text-sm text-on-surface-variant">No active conditions or effects.</p> }
        <app-conditions [activeConditions]="sheet().conditions ?? []" (conditionsChanged)="sheet().conditions = $event" />
        </div>
        <div data-health-footer class="flex shrink-0 justify-end border-t border-outline-variant bg-surface px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <button type="button" [disabled]="saving() || !dirty()" (click)="save.emit()" class="min-h-11 rounded-lg bg-primary-container px-4 py-2 text-sm font-semibold text-on-primary-container disabled:opacity-50">{{ saving() ? 'Saving…' : dirty() ? 'Save changes' : 'Saved' }}</button>
        </div>
      </dialog>
    }
  `,
})
export class MobileSheetStatusComponent implements OnDestroy {
  readonly sheet = input.required<ExportedCharacter>();
  readonly saving = input(false);
  readonly dirty = input(false);
  readonly save = output<void>();
  readonly helpers = inject(CharacterHelpersService);
  readonly amount = signal('');
  readonly feedback = signal('');
  private readonly dialog = viewChild<ElementRef<HTMLDialogElement>>('healthDialog');
  private readonly scrollLock = inject(DialogScrollLockService);
  private locked = false;
  maxHp() { return this.sheet().character?.maxHpOverride ?? this.sheet().character?.maxHp ?? 0; }
  healthPercent() { return this.maxHp() > 0 ? Math.max(0, Math.min(100, (this.sheet().character?.currentHp ?? 0) / this.maxHp() * 100)) : 0; }
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
    this.amount.set('');
    this.feedback.set('Health updated. Save the sheet to keep your changes.');
  }
}
