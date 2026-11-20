import { Component, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ExportedCharacter, InventoryItem } from '../models/character.model';
import { containerTargets, isContainer, moveInventoryItem, setContainer } from '../models/inventory-layout';

@Component({
  selector: 'app-item-container-controls',
  imports: [FormsModule],
  template: `
    <div class="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg bg-surface-container-high p-2 text-sm">
      <label class="flex min-h-11 cursor-pointer items-center gap-2">
        <input type="checkbox" [checked]="container()" (change)="setContainer($any($event.target).checked)" /> Use as container
      </label>
      <label class="flex min-w-0 flex-wrap items-center gap-2"><span>Move to</span>
        <select class="min-h-11 max-w-full rounded border border-outline-variant bg-surface px-2 text-on-surface"
          [attr.aria-label]="'Move ' + item().name + ' to container'" [ngModel]="parent()" (ngModelChange)="move($event)">
          <option value="">Outside a container</option>
          @for (target of targets(); track target.editorId) {
            <option [value]="target.editorId">{{ target.name }}{{ target.hidden ? ' (Hidden)' : '' }}</option>
          }
        </select>
      </label>
    </div>
  `,
})
export class ItemContainerControlsComponent {
  readonly sheet = input.required<ExportedCharacter>();
  readonly item = input.required<InventoryItem>();
  readonly edited = output<void>();
  container() { return isContainer(this.sheet(), this.item()); }
  targets() { return containerTargets(this.sheet(), this.item()); }
  parent() { return this.sheet().inventoryLayout?.parentByItemId[this.item().editorId ?? ''] ?? ''; }
  setContainer(enabled: boolean) { setContainer(this.sheet(), this.item(), enabled); this.edited.emit(); }
  move(parent: string) { if (moveInventoryItem(this.sheet(), this.item(), parent)) this.edited.emit(); }
}
