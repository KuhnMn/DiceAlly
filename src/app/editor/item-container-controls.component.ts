import { Component, input, output, signal } from '@angular/core';
import { SheetDetailDialogComponent } from '../sheet/sheet-detail-dialog.component';
import { UiIconComponent } from '../ui-icon.component';
import { ExportedCharacter, InventoryItem } from '../models/character.model';
import { containerTargets, isContainer, moveInventoryItem, setContainer } from '../models/inventory-layout';

@Component({
  selector: 'app-item-container-controls',
  imports: [SheetDetailDialogComponent, UiIconComponent],
  styleUrls: ['./editor-annotations.css'],
  host: { class: 'inline-flex min-w-0 max-w-full flex-wrap items-center gap-1.5 align-middle' },
  template: `
    @if (editing()) {
      <button type="button" class="annotation-button" [class.bg-secondary-container]="container()"
        [class.text-on-secondary-container]="container()" [attr.aria-pressed]="container()"
        title="Use this item as a container" (click)="setContainer(!container())">
        <app-ui-icon name="box" /> Container
      </button>
    }
    @if (targets().length || parent()) {
      <button type="button" [class]="editing() ? 'annotation-button' : 'flex h-8 w-8 items-center justify-center rounded text-xl text-green hover:bg-green-container focus-visible:outline-2 focus-visible:outline-primary'"
        [attr.aria-label]="'Move ' + item().name" [title]="moveTitle()" aria-haspopup="dialog" [attr.aria-expanded]="open()" (click)="open.set(true)">
        <app-ui-icon name="right" /> @if (editing()) { Move }
      </button>
    }
    @if (open()) {
      <app-sheet-detail-dialog [title]="'Move ' + item().name" (closed)="open.set(false)">
        <p class="text-sm text-on-surface-variant">Choose a container or keep this item outside a container.</p>
        <div class="overflow-hidden rounded-lg border border-outline-variant divide-y divide-outline-variant" role="group" aria-label="Move destinations">
          <button type="button" class="flex min-h-11 w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-surface-container-high focus-visible:outline-2 focus-visible:outline-primary"
            [attr.aria-pressed]="!parent()" (click)="move('')">
            <app-ui-icon name="list" class="text-on-surface-variant" /> <span class="min-w-0 flex-1">Outside a container</span>
            @if (!parent()) { <app-ui-icon name="check" class="text-green" /> }
          </button>
          @for (target of targets(); track target.editorId) {
            <button type="button" class="flex min-h-11 w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-surface-container-high focus-visible:outline-2 focus-visible:outline-primary"
              [attr.aria-label]="'Move to ' + target.name" [attr.aria-pressed]="parent() === target.editorId" (click)="move(target.editorId!)">
              <app-ui-icon name="box" class="text-green" /> <span class="min-w-0 flex-1 break-words">{{ target.name }}</span>
              @if (target.hidden) { <span class="rounded bg-surface-container-high px-1.5 py-0.5 text-xs text-on-surface-variant">Hidden</span> }
              @if (parent() === target.editorId) { <app-ui-icon name="check" class="text-green" /> }
            </button>
          }
        </div>
      </app-sheet-detail-dialog>
    }
  `,
})
export class ItemContainerControlsComponent {
  readonly sheet = input.required<ExportedCharacter>();
  readonly item = input.required<InventoryItem>();
  readonly edited = output<void>();
  readonly editing = input(false);
  readonly open = signal(false);
  container() { return isContainer(this.sheet(), this.item()); }
  targets() { return containerTargets(this.sheet(), this.item()); }
  parent() { return this.sheet().inventoryLayout?.parentByItemId[this.item().editorId ?? ''] ?? ''; }
  moveTitle() {
    const current = this.sheet().inventory?.find(item => item.editorId === this.parent());
    return current ? 'Move item (Currently in ' + current.name + ')' : 'Move item to a container';
  }
  setContainer(enabled: boolean) { setContainer(this.sheet(), this.item(), enabled); this.edited.emit(); }
  move(parent: string) {
    if (!moveInventoryItem(this.sheet(), this.item(), parent)) return;
    this.open.set(false);
    this.edited.emit();
  }
}
