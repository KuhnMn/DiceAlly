import { afterRenderEffect, Component, ElementRef, inject, input, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CharacterSpeed, defaultWalkingSpeed, effectiveSpeedFeet, primaryWalkingSpeed } from '../models/character-speed';
import { ExportedCharacter } from '../models/character.model';
import { CharacterStore } from '../stores/character.store';
import { UiIconComponent } from '../ui-icon.component';
import { SheetSpeedDescriptionComponent } from './sheet-speed-description.component';

@Component({
  selector: 'app-sheet-speed-control',
  imports: [FormsModule, UiIconComponent, SheetSpeedDescriptionComponent],
  styleUrl: './sheet-stat-tooltip.css',
  host: { class: 'inline-block relative', '(document:pointerdown)': 'outside($event)', '(document:keydown.escape)': 'dismiss()' },
  template: `
    <div class="relative stat-display" [class]="compact() ? 'h-13 w-13' : 'border-4 border-surface rounded-lg sm:rounded-full w-20 h-16 sm:w-20 sm:h-20 bg-surface-container-low flex flex-col items-center justify-center shadow-lg'">
      @if (editingId() === walk().id) {
        <label class="flex flex-col items-center justify-center" [class]="compact() ? 'h-13 w-13 rounded-lg border border-primary bg-surface-container text-xs' : 'h-full w-full'">
          <span [class]="compact() ? '' : 'text-xs text-on-surface-variant uppercase font-semibold'">Walk</span>
          <input #overrideInput type="number" min="0" step="1" [ngModel]="inputValue()" (ngModelChange)="inputValue.set('' + $event)" (blur)="saveOverride()" (keydown.enter)="$event.preventDefault(); saveOverride()" (keydown.escape)="cancelEdit(); $event.stopPropagation()" aria-label="Walking speed override" class="text-center font-bold bg-transparent outline-none" [class]="compact() ? 'w-12 border-b border-primary text-lg text-primary' : 'w-16 text-2xl border-b-2 border-primary'" [class.text-teal]="!compact() && walk().overrideFeet != null" [class.text-primary]="!compact() && walk().overrideFeet == null" />
        </label>
      } @else {
        <button type="button" (click)="edit(walk())" [attr.aria-label]="'Walking speed: ' + feet(walk()) + ' feet. Set override'" [attr.title]="walk().overrideFeet == null ? 'Click to override walking speed' : null"
          class="flex flex-col items-center justify-center focus-visible:outline-2 focus-visible:outline-primary"
          [class]="compact() ? 'h-13 w-13 rounded-full border-2 border-blue bg-transparent' : 'h-full w-full rounded-lg sm:rounded-full'">
          @if (compact()) {
            <span class="font-bold leading-tight text-lg" [class.text-teal]="walk().overrideFeet != null">{{ feet(walk()) }}</span>
            <span class="text-[10px] font-semibold text-blue">Walk</span>
          } @else {
            <div class="text-xs text-on-surface-variant uppercase font-semibold">Walk</div>
            <div class="text-2xl font-bold" [class.text-teal]="walk().overrideFeet != null" [class.text-primary]="walk().overrideFeet == null">{{ feet(walk()) }}</div>
          }
        </button>
      }
      @if (walk().overrideFeet != null && editingId() !== walk().id) { <div role="tooltip" class="stat-tooltip">Manual Override</div> }
      @if (alternatives().length) {
        <button type="button" (click)="open.set(!open())" [attr.aria-expanded]="open()" aria-label="Show other speeds" title="Other speeds" class="absolute z-10 -right-2 -bottom-2 flex h-6 w-6 items-center justify-center rounded-full bg-green text-xs text-on-green"><app-ui-icon name="plus" /></button>
      }
      @if (walk().overrideFeet != null) {
        <button type="button" (click)="reset(walk())" aria-label="Reset walking speed override" title="Reset walking speed" class="absolute z-20 -right-2 flex items-center justify-center rounded-full bg-teal text-on-teal hover:bg-error-container transition-colors" [class]="compact() ? '-top-1 h-7 w-7 text-sm' : '-top-2 h-6 w-6 text-xs'"><app-ui-icon name="close" /></button>
      }
      @if (open()) {
        <div role="region" aria-label="Other speeds" class="absolute -left-14 top-full z-50 mt-2 w-72 max-w-[calc(100vw_-_2rem)] space-y-2 rounded-lg border border-outline-variant bg-surface-container-high p-2 text-sm shadow-lg sm:left-1/2 sm:-translate-x-1/2">
          @for (speed of alternatives(); track speed.id) {
            <div class="flex items-start gap-2 rounded-md bg-surface-container-low p-2.5">
              @if (editingId() === speed.id) {
                <label class="min-w-0 flex-1 capitalize">{{ speed.type }} override (ft)
                  <input #overrideInput type="number" min="0" step="1" [ngModel]="inputValue()" (ngModelChange)="inputValue.set('' + $event)" (blur)="saveOverride()" (keydown.enter)="$event.preventDefault(); saveOverride()" (keydown.escape)="cancelEdit(); $event.stopPropagation()" [attr.aria-label]="speed.type + ' speed override'" class="mt-1 w-full rounded border border-primary bg-surface px-2 py-1 text-base" />
                </label>
              } @else {
                <button type="button" (click)="edit(speed)" [attr.aria-label]="'Override ' + speed.type + ' speed'" [attr.title]="speed.overrideFeet != null ? 'Manual Override' : null" class="min-w-0 flex-1 rounded text-left focus-visible:outline-2 focus-visible:outline-primary" [class.text-teal]="speed.overrideFeet != null"><app-sheet-speed-description [speed]="speed" [speeds]="sheet().character?.speeds ?? []" /></button>
              }
              @if (speed.overrideFeet != null) { <button type="button" (click)="reset(speed)" [attr.aria-label]="'Reset ' + speed.type + ' speed override'" class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-teal text-on-teal"><app-ui-icon name="close" /></button> }
            </div>
          }
        </div>
      }
    </div>
    @if (feedback()) { <p role="alert" class="mt-1 max-w-64 text-xs text-error">{{ feedback() }}</p> }
  `,
})
export class SheetSpeedControlComponent {
  readonly sheet = input.required<ExportedCharacter>();
  readonly compact = input(false);
  readonly open = signal(false);
  readonly editingId = signal<string | null>(null);
  readonly inputValue = signal('');
  readonly feedback = signal('');
  private readonly store = inject(CharacterStore);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly field = viewChild<ElementRef<HTMLInputElement>>('overrideInput');
  constructor() { afterRenderEffect(() => { const field = this.field()?.nativeElement; if (field) { field.focus(); field.select(); } }); }
  walk() { const speeds = this.sheet().character?.speeds ?? []; return primaryWalkingSpeed(speeds) ?? defaultWalkingSpeed(speeds); }
  alternatives() { return (this.sheet().character?.speeds ?? []).filter(speed => speed !== this.walk()); }
  feet(speed: CharacterSpeed) { return effectiveSpeedFeet(speed, this.sheet().character?.speeds); }
  edit(speed: CharacterSpeed) { this.feedback.set(''); this.inputValue.set(String(this.feet(speed))); this.editingId.set(speed.id); }
  cancelEdit() { this.editingId.set(null); this.feedback.set(''); }
  saveOverride() {
    const id = this.editingId(); if (!id) return;
    if (this.inputValue().trim() === '') { this.cancelEdit(); return; }
    const value = Number(this.inputValue());
    if (!Number.isSafeInteger(value) || value < 0) { this.feedback.set('Enter a nonnegative whole-number speed.'); return; }
    const character = this.sheet().character; if (!character) return;
    character.speeds ??= [];
    let speed = character.speeds.find(speed => speed.id === id);
    if (!speed && id === this.walk().id) { speed = this.walk(); character.speeds.unshift(speed); }
    if (!speed) { this.cancelEdit(); return; }
    speed.overrideFeet = value; this.cancelEdit(); this.publish();
  }
  reset(speed: CharacterSpeed) { delete speed.overrideFeet; this.cancelEdit(); this.publish(); }
  private publish() { this.store.setCharacter({ ...this.sheet() }); }
  dismiss() { this.cancelEdit(); this.open.set(false); }
  outside(event: Event) {
    if (event.target instanceof Node && !this.host.nativeElement.contains(event.target)) {
      this.saveOverride();
      if (!this.editingId()) this.open.set(false);
    }
  }
}
