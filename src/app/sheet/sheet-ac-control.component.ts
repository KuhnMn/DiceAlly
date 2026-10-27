import { afterRenderEffect, Component, ElementRef, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CharacterInfoPageComponent } from './character-info-page.component';
import { SheetStatBadgeComponent } from './sheet-stat-badge.component';
import { UiIconComponent } from '../ui-icon.component';

/** Compact presentation of the desktop AC editor, using its exact editing actions. */
@Component({
  selector: 'app-sheet-ac-control',
  imports: [FormsModule, SheetStatBadgeComponent, UiIconComponent],
  styleUrl: './sheet-stat-sizing.css',
  template: `
    <div class="relative">
      @if (isEditingAcOverride()) {
        <label class="stat-badge-frame stat-editor-caption flex flex-col items-center justify-center gap-1 rounded-lg border border-primary bg-surface-container">AC
          <input #acInput type="number" inputmode="numeric" [(ngModel)]="acOverrideInput" (keydown)="handleAcKeydown($event)" (blur)="saveAcOverride()" aria-label="Armor class override" class="stat-number-input stat-value min-w-0 border-b border-primary bg-transparent text-center font-bold text-primary outline-none" />
        </label>
      } @else {
        <button type="button" (click)="startEditingAc()" aria-label="Set armor class override" [title]="armorClassInfo().source + ' — click to override'" class="block rounded-lg focus-visible:outline-2 focus-visible:outline-primary"><app-sheet-stat-badge label="AC" [value]="armorClassInfo().ac" [overridden]="acOverride() !== null" /></button>
        @if (acOverride() !== null) {
          <button type="button" (click)="resetAcOverride()" aria-label="Reset armor class override" title="Reset AC" class="absolute z-20 -right-2 -top-1 flex h-7 w-7 items-center justify-center rounded-full bg-teal text-sm text-on-teal"><app-ui-icon name="close" /></button>
        }
      }
    </div>
  `,
})
export class SheetAcControlComponent extends CharacterInfoPageComponent {
  private readonly acInput = viewChild<ElementRef<HTMLInputElement>>('acInput');
  constructor() {
    super();
    afterRenderEffect(() => {
      const input = this.acInput()?.nativeElement;
      if (input) { input.focus(); input.select(); }
    });
  }
}
