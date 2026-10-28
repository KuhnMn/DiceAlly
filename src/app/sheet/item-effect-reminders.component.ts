import { Component, computed, inject, input, output, signal } from '@angular/core';
import { ExportedCharacter, InventoryItem } from '../models/character.model';
import { isSheetPageVisible } from '../models/sheet-pages';
import { HorizontalRowDirective } from './horizontal-row.directive';
import { itemEffectReminders, itemReminderKey, ItemReminderScope } from './item-effect-reminders';
import { EquipmentPageComponent } from './equipment-page.component';
import { CharacterHelpersService } from './character-helpers.service';
import { UiIconComponent } from '../ui-icon.component';

@Component({
  selector: 'app-item-effect-reminders',
  imports: [HorizontalRowDirective, EquipmentPageComponent, UiIconComponent],
  host: { class: 'block min-w-0 max-w-full' },
  template: `
    @if (reminders().length) {
      <section [attr.aria-label]="heading()" class="mb-3 mt-2 min-w-0 border-t border-outline-variant pt-2">
        <h4 class="mb-2 text-xs font-semibold text-on-surface-variant">{{ heading() }}</h4>
        <div appHorizontalRow class="flex flex-wrap items-stretch gap-2">
          @for (entry of reminders(); track entry.key) {
            <button type="button" (click)="openedKey.set(entry.key)" aria-haspopup="dialog"
              [attr.aria-label]="'Details for ' + entry.name" [attr.aria-expanded]="openedKey() === entry.key"
              class="max-w-full rounded-lg border-2 border-tertiary bg-tertiary-container px-3 py-2 text-center text-on-tertiary-container transition-colors hover:brightness-110 focus-visible:outline-2 focus-visible:outline-primary max-sm:w-max"
              [title]="entry.source ? entry.name + ' (' + entry.source + ')' : entry.name">
              <div class="max-w-64 whitespace-normal break-words text-sm font-semibold">{{ entry.name }}</div>
              <div class="mt-1 flex max-w-64 flex-wrap items-baseline justify-center gap-x-2 gap-y-0.5 text-xs">
                @for (bonus of entry.bonuses; track bonus.label) {
                  <span class="whitespace-nowrap">{{ bonus.label }} <strong>{{ bonus.value }}</strong></span>
                }
              </div>
            </button>
          }
        </div>
      </section>
    }
    @if (openedItem(); as item) {
      <ng-template #navigation>
        @if (canNavigate()) {
          <button type="button" (click)="goToSource(item)" [attr.aria-label]="'Go to source for ' + item.name"
            class="inline-flex min-h-11 items-center gap-2 rounded-lg border border-outline-variant px-3 py-2 text-sm text-primary">
            Go to Source <app-ui-icon name="right" />
          </button>
        }
      </ng-template>
      <app-equipment-page [characterData]="sheet()" [detailEntry]="item" [detailNavigation]="navigation" (detailClosed)="openedKey.set(null)" />
    }
  `,
})
export class ItemEffectRemindersComponent {
  readonly sheet = input<ExportedCharacter | null>(null);
  readonly scope = input<ItemReminderScope>('combat');
  readonly navigateToSource = output<string>();
  readonly openedKey = signal<string | null>(null);
  private readonly helpers = inject(CharacterHelpersService);
  readonly heading = computed(() => this.scope() === 'spells' ? 'Item Spell Bonuses' : 'Magic Item Bonuses');
  readonly reminders = computed(() => itemEffectReminders(this.sheet()?.inventory ?? [], this.scope()));
  // Changing equipment or attunement hides the card, but must not destroy its open modal.
  readonly openedItem = computed(() => this.sheet()?.inventory?.find(
    (item, index) => itemReminderKey(item, index) === this.openedKey(),
  ));
  readonly canNavigate = computed(() => isSheetPageVisible(this.sheet(), 4));

  goToSource(item: InventoryItem) {
    if (!this.canNavigate()) return;
    this.openedKey.set(null);
    this.navigateToSource.emit(`item-${item.editorId ?? this.helpers.sourceId(`${item.name}-${item.source ?? ''}`)}`);
  }
}
