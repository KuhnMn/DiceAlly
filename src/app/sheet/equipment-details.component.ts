import { Component, computed, input } from '@angular/core';
import { DisplayItem } from '../models/character.model';
import { higherLevelEntries } from '../entries/entry-compatibility';
import { EntryRendererComponent } from '../entries/entry-renderer.component';
import { RuleDetailsComponent } from './rule-details.component';
import { SpellDetailsComponent } from './spell-details.component';
import { prepareEquipmentDetails } from './equipment-presentation';
import { VehicleItemDetailsComponent } from './vehicle-item-details.component';

@Component({
  selector: 'app-equipment-details',
  imports: [EntryRendererComponent, RuleDetailsComponent, SpellDetailsComponent, VehicleItemDetailsComponent],
  host: { class: 'block space-y-3' },
  template: `
    @if (details(); as detail) {
      <app-vehicle-item-details [item]="entity()?.item" />
      @if (detail.charges; as charges) {
        <section aria-label="Item charges" class="rounded-lg border border-outline-variant bg-surface-container p-3 text-sm">
          <div class="flex flex-wrap items-center gap-x-4 gap-y-2">
            <div><span class="font-semibold">Charges: </span><app-entry-renderer [entry]="{text: '' + charges.maximumCharges}" [inline]="true" /></div>
            @if (charges.recoveryTimingText) { <div><span class="font-semibold">Recovery: </span>{{ charges.recoveryTimingText }}</div> }
            @if (charges.recoveryAmount != null) { <div><span class="font-semibold">Amount: </span><app-entry-renderer [entry]="{text: '' + charges.recoveryAmount}" [inline]="true" /></div> }
          </div>
        </section>
      }
      @if (detail.attunementRequirementText) {
        <section class="rounded-lg border border-outline-variant bg-surface-container p-3 text-sm">
          <h4 class="mb-1 font-semibold">Attunement Requirement</h4>
          <app-entry-renderer [entry]="{text: detail.attunementRequirementText}" />
        </section>
      }
      <app-entry-renderer [entries]="detail.descriptionEntries" />
      @if (detail.properties.length) {
        <section class="space-y-2"><h4 class="text-sm font-semibold">Properties</h4>
          @for (property of detail.properties; track $index) { <app-rule-details [label]="property.name" [entry]="property.entry" [notes]="property.notes" /> }
        </section>
      }
      @if (detail.masteries.length) {
        <section class="space-y-2"><h4 class="text-sm font-semibold">Masteries</h4>
          @for (mastery of detail.masteries; track $index) { <app-rule-details [label]="mastery.name" [entry]="mastery.entry" [notes]="mastery.notes" /> }
        </section>
      }
      @if (detail.attachedSpells.length) {
        <section class="space-y-2">
          <h4 class="text-sm font-semibold">Attached Spells</h4>
          @if (detail.spellcastingAbilityDescription) { <p class="text-sm">Spellcasting ability: {{ detail.spellcastingAbilityDescription }}</p> }
          @for (reference of detail.attachedSpells; track $index) {
            <details class="rounded-lg border border-outline-variant bg-surface-container-low">
              <summary class="min-h-11 cursor-pointer px-3 py-2 text-sm">
                <span class="font-semibold">{{ reference.name }}</span>
                @if (reference.source) { <span class="ml-2 rounded bg-surface-container-high px-2 py-0.5 text-xs">{{ reference.source }}</span> }
                @for (usage of reference.usageNotes; track usage) { <span class="ml-2 inline-block rounded bg-purple-container px-2 py-0.5 text-xs text-on-purple-container">{{ usage }}</span> }
              </summary>
              <div class="space-y-3 px-3 pb-3">
                @if (reference.spell; as spell) {
                  <app-spell-details [spell]="spell" />
                  <app-entry-renderer [entries]="spell.entries" />
                  @if (spell.entriesHigherLevel?.length) {
                    <section class="space-y-2"><h5 class="text-sm font-semibold">At Higher Levels</h5>
                      @for (entry of spell.entriesHigherLevel; track $index) { <app-entry-renderer [entries]="higherLevelEntries(entry)" /> }
                    </section>
                  }
                } @else { <p class="text-sm text-on-surface-variant">No saved spell description available.</p> }
              </div>
            </details>
          }
        </section>
      }
    }
  `,
})
export class EquipmentDetailsComponent {
  readonly entity = input<DisplayItem | null>();
  readonly details = computed(() => { const entity = this.entity(); return entity ? prepareEquipmentDetails(entity) : null; });
  readonly higherLevelEntries = higherLevelEntries;
}
