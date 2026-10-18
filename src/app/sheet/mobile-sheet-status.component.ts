import { ConcentrationService } from '../services/concentration.service';
import { CharacterStore } from '../stores/character.store';
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
  host: { class: 'block sm:hidden', '(document:pointerdown)': 'dismissRest($event)', '(document:keydown.escape)': 'closeRest()' },
  template: `
    @if (sheet().character; as character) {
      <div class="grid grid-cols-12 items-center gap-2 pb-2" aria-label="Character status">
        <button type="button" (click)="openHealth()" class="col-span-10 min-w-0 rounded-lg bg-primary-container px-3 py-2 text-left text-on-primary-container" [attr.aria-label]="'Adjust health and conditions: ' + (character.currentHp ?? 0) + ' of ' + maxHp() + ' HP, ' + temporaryHp() + ' temporary HP'">
          <div class="text-sm font-semibold">HP {{ character.currentHp ?? 0 }} / {{ maxHp() }}</div>
          <div class="mt-1.5 flex h-1.5 overflow-hidden rounded-full bg-surface-container" aria-hidden="true"><div class="h-full shrink-0 bg-primary transition-[width] duration-300" [style.width.%]="healthPercent()"></div><div class="h-full shrink-0 bg-green transition-[width] duration-300" [style.width.%]="temporaryHealthPercent()"></div></div>
        </button>
        <button type="button" (click)="character.hasInspiration = !character.hasInspiration" [attr.aria-pressed]="character.hasInspiration ?? false" [title]="character.hasInspiration ? 'Use Inspiration' : 'Gain Inspiration'" aria-label="Toggle Inspiration" class="col-span-2 flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-outline-variant text-xl" [class.bg-tertiary-container]="character.hasInspiration" [class.text-on-tertiary-container]="character.hasInspiration" [class.text-on-surface-variant]="!character.hasInspiration"><app-ui-icon name="sparkles" [filled]="character.hasInspiration ?? false" /></button>
        <div class="col-span-12 grid grid-cols-5 items-center gap-1">
        <app-sheet-ac-control class="justify-self-center" [characterData]="sheet()" />
        <div #speedControl class="relative justify-self-center">
          <button type="button" (click)="speedOpen.set(!speedOpen())" [disabled]="!additionalSpeeds().length" [attr.aria-expanded]="additionalSpeeds().length ? speedOpen() : null" [attr.aria-label]="'Walking speed: ' + (character.speeds?.walk ?? 30) + ' feet' + (additionalSpeeds().length ? '. Show other speeds' : '')" class="relative flex h-14 w-14 flex-col items-center justify-center rounded-full border-2 border-primary bg-surface-container-low focus-visible:outline-2 focus-visible:outline-primary">
            <span class="text-lg font-bold leading-tight text-on-surface">{{ character.speeds?.walk ?? 30 }}</span>
            <span class="text-[10px] font-semibold text-primary">Walk</span>
            @if (additionalSpeeds().length) {
              <span class="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-green text-sm text-on-green"><app-ui-icon name="plus" /></span>
            }
          </button>
          @if (speedOpen() && additionalSpeeds().length) {
            <div class="absolute left-1/2 top-full z-50 mt-2 w-40 -translate-x-1/2 rounded-lg border border-outline-variant bg-surface-container-high p-3 text-sm shadow-lg" role="region" aria-label="Other speeds">
              @for (speed of additionalSpeeds(); track speed.name) {
                <p class="py-1"><span class="capitalize">{{ speed.name }}</span>: {{ speed.value }} ft.</p>
              }
            </div>
          }
        </div>
        <app-sheet-stat-badge class="justify-self-center" label="Init." shape="octagon" [value]="helpers.formatSigned(helpers.initiative(character))" [proficient]="character.proficiencies?.initiative ?? false" />
        <app-sheet-stat-badge class="justify-self-center" label="PB" shape="octagon" [value]="helpers.formatSigned(helpers.proficiencyBonus(character))" />
        <details #restMenu name="sheet-actions" class="relative justify-self-center">
          <summary aria-label="Rest" title="Rest" class="flex min-h-11 min-w-11 cursor-pointer list-none items-center justify-center rounded-lg bg-surface-container text-xl text-primary [&::-webkit-details-marker]:hidden"><app-ui-icon name="moon" /></summary>
          <div class="absolute right-0 top-full z-50 mt-1 w-44 rounded-lg border border-outline-variant bg-surface-container-high p-1 shadow-lg">
            <button type="button" [disabled]="saving()" (click)="restMenu.open = false; shortRest.emit()" class="min-h-11 w-full rounded px-3 py-2 text-left text-sm hover:bg-surface-container"><app-ui-icon name="campfire" /> Short Rest</button>
            <button type="button" [disabled]="saving()" (click)="restMenu.open = false; longRest.emit()" class="min-h-11 w-full rounded px-3 py-2 text-left text-sm hover:bg-surface-container"><app-ui-icon name="rest" /> Long Rest</button>
          </div>
        </details>
        </div>
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
  private readonly store = inject(CharacterStore);
  private readonly concentration = inject(ConcentrationService);
  readonly sheet = input.required<ExportedCharacter>();
  readonly saving = input(false);
  readonly dirty = input(false);
  readonly save = output<void>();
  readonly shortRest = output<void>();
  readonly longRest = output<void>();
  private readonly restMenu = viewChild<ElementRef<HTMLDetailsElement>>('restMenu');
  private readonly speedControl = viewChild<ElementRef<HTMLElement>>('speedControl');
  readonly speedOpen = signal(false);
  additionalSpeeds() {
    return Object.entries(this.sheet().character?.speeds ?? {})
      .filter(([name, value]) => name !== 'walk' && typeof value === 'number' && value > 0)
      .map(([name, value]) => ({ name, value }));
  }
  closeRest() {
    const menu = this.restMenu()?.nativeElement;
    if (menu) menu.open = false;
    this.speedOpen.set(false);
  }
  dismissRest(event: Event) {
    if (!(event.target instanceof Node)) return;
    if (!this.restMenu()?.nativeElement.contains(event.target)) {
      const menu = this.restMenu()?.nativeElement;
      if (menu) menu.open = false;
    }
    if (!this.speedControl()?.nativeElement.contains(event.target)) this.speedOpen.set(false);
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
