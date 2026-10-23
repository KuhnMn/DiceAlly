import { NgClass, NgTemplateOutlet } from '@angular/common';
import { Component, computed, input, output, signal } from '@angular/core';
import { CombatAction, ExportedCharacter, FeatureEntryFull, InventoryItem, SpellEntryFull } from '../models/character.model';
import { Companion } from '../models/companions';
import { COMBAT_TYPES, resolveCombatResource } from '../editor/combat-actions';
import { EntryRendererComponent } from '../entries/entry-renderer.component';
import { UiIconComponent } from '../ui-icon.component';
import { SheetDetailDialogComponent } from './sheet-detail-dialog.component';
import { SpellsPageComponent } from './spells-page.component';
import { FeaturesPageComponent } from './features-page.component';
import { EquipmentPageComponent } from './equipment-page.component';
import { MonstersPageComponent } from './monsters-page.component';

const LINK_STYLES = {
  feature: 'border-blue text-blue hover:bg-blue-container',
  species: 'border-rose text-rose hover:bg-rose-container',
  spell: 'border-purple text-purple hover:bg-purple-container',
  item: 'border-green text-green hover:bg-green-container',
  monster: 'border-teal text-teal hover:bg-teal-container',
};

/** Reading a bookmark stays in combat; navigating to its source is a separate action. */
@Component({
  selector: 'app-combat-action',
  host: { class: 'block min-w-0' },
  imports: [NgClass, NgTemplateOutlet, UiIconComponent, SheetDetailDialogComponent, EntryRendererComponent, SpellsPageComponent, FeaturesPageComponent, EquipmentPageComponent, MonstersPageComponent],
  template: `
    <div class="flex min-w-0 items-stretch rounded border-2 bg-surface-container transition-colors" [ngClass]="style()">
      <button type="button" data-page-swipe (click)="opened.set(true)" aria-haspopup="dialog" [attr.aria-label]="'Details for ' + (action().name || 'Combat Action')" [attr.aria-expanded]="opened()"
        class="min-h-11 min-w-0 flex-1 rounded p-2 text-left focus-visible:outline-2 focus-visible:outline-primary">
        <span class="grid grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,2fr)] gap-2 text-sm">
          <span class="font-semibold [overflow-wrap:anywhere]">{{ action().name || 'Combat Action' }}@if (action().range) { <span class="block text-xs font-normal text-on-surface-variant">{{ action().range }}</span> }</span>
          <span class="min-w-0 line-clamp-2 text-center font-mono text-xs [overflow-wrap:anywhere]" [title]="action().hitOrDc">{{ action().hitOrDc }}</span>
          <span class="min-w-0 line-clamp-5 text-right font-mono text-xs [overflow-wrap:anywhere]" [title]="action().damageOrHeal">{{ action().damageOrHeal }}</span>
        </span>
      </button>
      @if (navigable()) {
        <button type="button" (click)="goToSource()" [attr.aria-label]="'Go to source for ' + (action().name || 'Combat Action')" title="Go to source"
          class="flex min-h-11 w-11 shrink-0 items-center justify-center rounded border-l border-current/20 focus-visible:outline-2 focus-visible:outline-primary"><app-ui-icon name="right" /></button>
      }
    </div>
    <ng-template #navigation>
      @if (navigable()) { <button type="button" (click)="goToSource()" [attr.aria-label]="'Go to source for ' + (action().name || 'Combat Action')" class="inline-flex min-h-11 items-center gap-2 rounded-lg border border-outline-variant px-3 py-2 text-sm text-primary">Go to Source <app-ui-icon name="right" /></button> }
    </ng-template>
    @if (opened()) {
      @if (resource()) {
        @switch (action().linkedResourceType) {
          @case ('SPELL') { <app-spells-page [characterData]="sheet()" [detailEntry]="spell()!" [detailNavigation]="navigation" (detailClosed)="opened.set(false)" /> }
          @case ('ITEM') { <app-equipment-page [characterData]="sheet()" [detailEntry]="item()!" [detailNavigation]="navigation" (detailClosed)="opened.set(false)" /> }
          @case ('MONSTER') { <app-monsters-page [characterData]="sheet()" [detailEntry]="companion()!" [detailNavigation]="navigation" (detailClosed)="opened.set(false)" /> }
          @case ('OBJECT') { <app-monsters-page [characterData]="sheet()" [detailEntry]="companion()!" [detailNavigation]="navigation" (detailClosed)="opened.set(false)" /> }
          @case ('SPECIES') { <app-features-page [characterData]="sheet()" [detailSpecies]="true" [detailNavigation]="navigation" (detailClosed)="opened.set(false)" /> }
          @case ('CLASS_FEATURE') { <app-features-page [characterData]="sheet()" [detailEntry]="feature()!" [detailNavigation]="navigation" (detailClosed)="opened.set(false)" /> }
          @case ('FEAT') { <app-features-page [characterData]="sheet()" [detailEntry]="feature()!" [detailNavigation]="navigation" (detailClosed)="opened.set(false)" /> }
          @case ('OPTIONAL_FEATURE') { <app-features-page [characterData]="sheet()" [detailEntry]="feature()!" [detailNavigation]="navigation" (detailClosed)="opened.set(false)" /> }
          @default { <ng-container [ngTemplateOutlet]="customDetail" /> }
        }
      } @else { <ng-container [ngTemplateOutlet]="customDetail" /> }
    }
    <ng-template #customDetail>
      <app-sheet-detail-dialog [title]="action().name || 'Combat Action'" (closed)="opened.set(false)">
        <dl class="grid gap-3 rounded-lg bg-surface-container p-3 text-sm sm:grid-cols-2" aria-label="Combat action details">
          <div><dt class="font-semibold text-on-surface-variant">Action Type</dt><dd>{{ actionType() }}</dd></div>
          @if (action().range) { <div><dt class="font-semibold text-on-surface-variant">Range</dt><dd>{{ action().range }}</dd></div> }
          @if (action().hitOrDc) { <div><dt class="font-semibold text-on-surface-variant">Attack / Save</dt><dd><app-entry-renderer [entry]="{text: action().hitOrDc}" /></dd></div> }
          @if (action().damageOrHeal) { <div><dt class="font-semibold text-on-surface-variant">Damage / Effect</dt><dd><app-entry-renderer [entry]="{text: action().damageOrHeal}" /></dd></div> }
        </dl>
        @if (action().linkedResource) {
          <p class="text-sm text-on-surface-variant">The linked entry is no longer on this character. The saved combat action is shown above.</p>
        } @else if (!action().damageOrHeal) {
          <p class="text-sm text-on-surface-variant">No effect description is included in this action.</p>
        }
        @if (navigable()) { <button type="button" (click)="goToSource()" [attr.aria-label]="'Go to source for ' + (action().name || 'Combat Action')" class="inline-flex min-h-11 items-center gap-2 rounded-lg border border-outline-variant px-3 py-2 text-sm text-primary">Go to Source <app-ui-icon name="right" /></button> }
      </app-sheet-detail-dialog>
    </ng-template>
  `,
})
export class CombatActionComponent {
  readonly action = input.required<CombatAction>();
  readonly sheet = input.required<ExportedCharacter>();
  readonly linkType = input<keyof typeof LINK_STYLES | null>(null);
  readonly navigable = input(false);
  readonly navigated = output<void>();
  readonly opened = signal(false);
  readonly style = computed(() => this.linkType() ? LINK_STYLES[this.linkType()!] : 'border-outline-variant text-on-surface hover:bg-surface-container-high');
  readonly actionType = computed(() => COMBAT_TYPES.find(type => type.value === this.action().actionType)?.label ?? 'Other');
  readonly resource = computed(() => resolveCombatResource(this.sheet(), this.action()));
  readonly spell = computed(() => this.action().linkedResourceType === 'SPELL' ? this.resource() as SpellEntryFull | undefined : undefined);
  readonly feature = computed(() => ['CLASS_FEATURE', 'FEAT', 'OPTIONAL_FEATURE'].includes(this.action().linkedResourceType ?? '') ? this.resource() as FeatureEntryFull | undefined : undefined);
  readonly companion = computed(() => ['MONSTER', 'OBJECT'].includes(this.action().linkedResourceType ?? '') ? this.resource() as Companion | undefined : undefined);
  readonly item = computed(() => this.action().linkedResourceType === 'ITEM' ? this.resource() as InventoryItem | undefined : undefined);
  goToSource() { this.opened.set(false); this.navigated.emit(); }
}
