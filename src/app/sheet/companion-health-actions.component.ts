import { Component, input, signal } from '@angular/core';
import { Companion, companionHitPoints } from '../models/companions';
import { applyHealthAdjustment, HealthAction } from './sheet-health';
import { UiIconComponent } from '../ui-icon.component';

@Component({
  selector: 'app-companion-health-actions',
  imports: [UiIconComponent],
  template: `
    <section [class]="embedded() ? 'min-w-0' : 'min-w-0 rounded-lg border border-outline-variant bg-surface-container-high px-3 py-2'" [attr.aria-label]="'Quick HP actions for ' + (companion().name || 'companion')">
      <div class="flex flex-nowrap items-center gap-2 overflow-x-auto overscroll-x-contain py-1" data-horizontal-row>
        @if (embedded()) {
          <span aria-hidden="true" class="shrink-0 text-outline-variant">|</span>
        }
        <span role="img" aria-label="Apply damage or healing" title="Apply Damage or Healing" class="inline-flex shrink-0 text-lg"><app-ui-icon name="down" class="text-error" /><app-ui-icon name="up" class="text-primary" /></span>
        <input type="number" inputmode="numeric" min="0" step="1" placeholder="Amount" [value]="amount()" (input)="amount.set($any($event.target).value)" [attr.aria-label]="(companion().name || 'Companion') + ' HP adjustment amount'" class="min-h-11 w-20 shrink-0 rounded-lg border border-outline-variant bg-surface px-2 py-1 text-base text-on-surface" />
        <button type="button" (click)="adjust('damage')" [disabled]="!validAmount()" class="min-h-11 shrink-0 whitespace-nowrap rounded-md border border-outline-variant bg-error-container px-2 py-2 text-xs font-semibold text-on-error-container disabled:opacity-40 sm:px-3 sm:text-sm">Deal Damage</button>
        <button type="button" (click)="adjust('heal')" [disabled]="!validAmount()" class="min-h-11 shrink-0 whitespace-nowrap rounded-md border border-outline-variant bg-primary-container px-2 py-2 text-xs font-semibold text-on-primary-container disabled:opacity-40 sm:px-3 sm:text-sm">Heal</button>
        <button type="button" (click)="adjust('temp')" [disabled]="!validAmount()" class="min-h-11 shrink-0 whitespace-nowrap rounded-md border border-outline-variant bg-secondary-container px-2 py-2 text-xs font-semibold text-on-secondary-container disabled:opacity-40 sm:px-3 sm:text-sm">Set Temp HP</button>
      </div>
    </section>
  `,
})
export class CompanionHealthActionsComponent {
  readonly companion = input.required<Companion>();
  readonly maximum = input.required<number>();
  readonly embedded = input(false);
  readonly amount = signal('');

  validAmount() {
    const value = Number(this.amount());
    return !!this.amount().trim() && Number.isSafeInteger(value) && value >= 0;
  }

  adjust(action: HealthAction) {
    const health = companionHitPoints(this.companion());
    if (!health.enabled || !this.validAmount()) return;
    const values = { currentHp: health.current ?? this.maximum(), tempHp: health.temporary ?? 0, maxHp: this.maximum() };
    applyHealthAdjustment(values, action, Number(this.amount()));
    health.current = values.currentHp;
    health.temporary = values.tempHp;
    this.amount.set('');
  }
}
