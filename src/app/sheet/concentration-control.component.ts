import { Component, inject, input } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ExportedCharacter } from '../models/character.model';
import { CharacterStore } from '../stores/character.store';
import { UiIconComponent } from '../ui-icon.component';
import { CatalogDialogComponent } from '../editor/catalog-dialog.component';
import { AppDialogService } from '../services/app-dialog.service';

@Component({
  selector: 'app-concentration-control',
  imports: [FormsModule, UiIconComponent, CatalogDialogComponent],
  host: { class: 'inline-flex min-w-0 items-center gap-2' },
  template: `
    <button type="button" class="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-tertiary text-xl transition-colors hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-tertiary"
      [class.bg-transparent]="!sheet().character?.concentrationEffect" [class.text-tertiary]="!sheet().character?.concentrationEffect"
      [class.bg-tertiary]="!!sheet().character?.concentrationEffect" [class.text-on-tertiary]="!!sheet().character?.concentrationEffect"
      [attr.aria-label]="sheet().character?.concentrationEffect ? 'Concentrating: ' + sheet().character?.concentrationEffect : 'Track concentration'"
      [title]="sheet().character?.concentrationEffect ? 'Concentrating: ' + sheet().character?.concentrationEffect : 'Track concentration'"
      [attr.aria-pressed]="!!sheet().character?.concentrationEffect" aria-haspopup="dialog" (click)="open = true">
      <app-ui-icon name="head" [filled]="!!sheet().character?.concentrationEffect" />
    </button>
    @if (sheet().character?.concentrationEffect; as effect) {
      <span class="min-w-0 truncate text-xs font-medium text-on-surface" [title]="'Concentrating on ' + effect" role="status">{{ effect }}</span>
    }
    @if (open) {
      <app-catalog-dialog title="Concentration" subtitle="" [compact]="true" (closed)="open = false">
        @if (sheet().character?.concentrationEffect; as effect) {
          <div class="mb-3 flex flex-wrap items-center justify-between gap-2"><strong class="min-w-0 text-sm [overflow-wrap:anywhere]">Concentrating: {{ effect }}</strong><button type="button" class="min-h-11 rounded bg-secondary-container px-3 text-sm text-on-secondary-container" (click)="setEffect(''); open = false">End Concentration</button></div>
        }
        <form class="flex flex-wrap items-end gap-2" (ngSubmit)="start()"><label class="min-w-0 flex-1 text-sm">Spell or Effect<input name="concentration-effect" [(ngModel)]="effectName" class="mt-1 min-h-11 w-full rounded border border-outline-variant bg-surface px-2 text-base" /></label><button type="submit" [disabled]="!effectName.trim()" class="min-h-11 rounded bg-primary px-3 text-sm text-on-primary disabled:opacity-40">{{ sheet().character?.concentrationEffect ? 'Replace' : 'Start' }}</button></form>
      </app-catalog-dialog>
    }
  `,
})
export class ConcentrationControlComponent {
  readonly sheet = input.required<ExportedCharacter>();
  private readonly store = inject(CharacterStore);
  private readonly dialogs = inject(AppDialogService);
  effectName = '';
  open = false;
  async start() {
    const name = this.effectName.trim();
    if (!name) return;
    const sheet = this.sheet();
    if (sheet.character?.concentrationEffect && !await this.dialogs.confirm(`End concentration on ${sheet.character.concentrationEffect} and start ${name}?`, 'Replace Concentration', 'Replace')) return;
    if (this.sheet() !== sheet) return;
    this.setEffect(name); this.effectName = ''; this.open = false;
  }
  setEffect(name: string) {
    const sheet = this.sheet();
    if (!sheet.character) return;
    this.store.setCharacter({ ...sheet, character: { ...sheet.character, concentrationEffect: name } });
  }
}
