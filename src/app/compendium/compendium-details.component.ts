import { Component, computed, input, output } from '@angular/core';
import { ContentRecord, ImportRevision, JsonObject, object as asObject } from '../content/content.model';
import { contentEntries, SourceEntries, tablePresentation } from '../content/content-entries';
import { EntryRendererComponent } from '../entries/entry-renderer.component';
import { SpellDetailsComponent } from '../sheet/spell-details.component';
import { MonsterStatBlockComponent } from '../sheet/monster-stat-block.component';
import { spellSnapshot } from '../editor/spell-selection';
import { createMonsterEntry } from '../editor/monster-selection';
import { PrerequisiteDetailsComponent } from '../sheet/prerequisite-details.component';
import { Prerequisite } from '../models/character.model';
import { ItemView } from '../content/item-resolver';
import { formatSpeciesMovement } from '../content/species-adapter';
import { ObjectStatBlockComponent } from '../sheet/object-stat-block.component';
import { ObjectCompanion } from '../models/companions';
import { FACET_LABELS, Facet, facetLabel, kindLabel, recordFacets } from './compendium-catalog';
import { FacilityInformationComponent } from '../sheet/facility-information.component';
import { facilitySnapshot } from '../editor/facility-selection';
import { VehicleItemDetailsComponent } from '../sheet/vehicle-item-details.component';
import { ItemVehicleDefinition } from '../content/item.model';
import { vehicleItemStatistics } from '../sheet/vehicle-item-presentation';

/** Read-only compendium projection: the sheet's renderers without character mutations. */
@Component({
  selector: 'app-compendium-details',
  host: { '[class.compact-reference]': 'compactReference()' },
  styles: [`
    :host { display: block; min-width: 0; }
    :host(.compact-reference) { font-size: .875rem; line-height: 1.4; }
    :host(.compact-reference) .mb-3, :host(.compact-reference) .mb-4 { margin-bottom: .5rem; }
    :host(.compact-reference) .mt-4, :host(.compact-reference) .mt-5 { margin-top: .75rem; }
    :host(.compact-reference) .p-3 { padding: .5rem; }
    :host(.compact-reference) .gap-x-4 { column-gap: .75rem; }
    :host(.compact-reference) .gap-3 { gap: .5rem; }
    :host(.compact-reference) .text-base { font-size: .875rem; line-height: 1.4; }
  `],
  imports: [VehicleItemDetailsComponent, EntryRendererComponent, SpellDetailsComponent, MonsterStatBlockComponent, ObjectStatBlockComponent, PrerequisiteDetailsComponent, FacilityInformationComponent],
  template: `
    @if (!overview()) {
    <p class="mb-3 text-sm text-on-surface-variant">{{ kindLabel(record().kind) }} · {{ record().publication }}
      @if (sourceData()['page']; as page) { · Page {{ page }} }
    </p>
    <dl class="mb-4 grid grid-cols-2 gap-x-4 gap-y-2 rounded-xl bg-surface-container p-3 text-sm">
      @for (field of metadata(); track field.label) {
        <div class="min-w-0"><dt class="text-xs text-on-surface-variant">{{ field.label }}</dt><dd class="font-medium [overflow-wrap:anywhere]">{{ field.value }}</dd></div>
      }
    </dl>
    }
    <app-prerequisite-details [prerequisites]="prerequisites()" />
    @if (vehicleItem(); as item) { <app-vehicle-item-details class="mb-3" [item]="item" /> }
    @if (facility(); as facility) { <app-facility-information [definition]="facility" /> }
    @if (!overview() && statistics().length) {
      <dl class="mb-4 grid grid-cols-2 gap-3 text-sm">
        @for (stat of statistics(); track stat.label) {
          <div><dt class="text-xs text-on-surface-variant">{{ stat.label }}</dt><dd><app-entry-renderer [entry]="{text: stat.value}" [compact]="true" /></dd></div>
        }
      </dl>
    }
    @if (spell(); as spell) { <app-spell-details [spell]="spell" /> }
    @if (monster(); as monster) {
      <app-monster-stat-block [value]="monster" [compact]="true" />
    } @else if (object(); as object) {
      <app-object-stat-block [value]="object" [compact]="true" />
    } @else {
      @for (section of sections(); track section.title) {
        <section class="min-w-0" [class.mt-4]="!overview()" [class.mt-2]="overview()">
          @if (section.title) { <h3 class="mb-2 text-base font-semibold">{{ section.title }}</h3> }
          <app-entry-renderer [entries]="section.entries" [compact]="compactReference()" />
        </section>
      }
      @if (!sections().length && !overview()) { <p class="mt-3 text-sm text-on-surface-variant">No description is included in this entry.</p> }
    }
    @if (related().length) {
      <section class="mt-5 border-t border-outline-variant pt-3"><h3 class="mb-2 font-semibold">Related Entries</h3>
        <div class="grid gap-1">
          @for (entry of related(); track entry.key) {
            <button type="button" (click)="opened.emit(entry)" class="min-h-11 rounded-lg bg-surface-container px-3 py-2 text-left text-sm text-primary hover:bg-surface-container-high">
              {{ entry.name }} <span class="text-xs text-on-surface-variant">· {{ kindLabel(entry.kind) }} · {{ entry.publication }}</span>
            </button>
          }
        </div>
      </section>
    }
  `,
})
export class CompendiumDetailsComponent {
  /** Class/subclass descriptions live beside their existing summary and resource information. */
  readonly overview = input(false);
  readonly facility = computed(() => this.record().kind === 'facility' ? facilitySnapshot(this.record()) : null);
  readonly compactReference = computed(() => ['monster', 'vehicle', 'object'].includes(this.record().kind));
  readonly record = input.required<ContentRecord>();
  readonly revision = input.required<ImportRevision>();
  readonly related = input<ContentRecord[]>([]);
  readonly itemView = input<ItemView | null>(null);
  readonly vehicleItem = computed(() => {
    const item = this.itemView()?.item as ItemVehicleDefinition | undefined;
    return vehicleItemStatistics(item).length ? item : null;
  });
  readonly opened = output<ContentRecord>();
  readonly kindLabel = kindLabel;
  readonly sourceData = computed<JsonObject>(() => ({ ...this.record().data, ...this.record().referenceDefinition }));
  readonly spell = computed(() => this.record().kind === 'spell' ? spellSnapshot(this.record()) : null);
  readonly monster = computed(() => this.record().kind === 'monster' ? createMonsterEntry(this.record(), this.revision()) : null);
  readonly object = computed<ObjectCompanion | null>(() => {
    const definition = this.record().referenceDefinition;
    return definition?.kind === 'object' ? { kind: 'object', name: this.record().name, source: this.record().publication,
      entity: definition, hitPoints: { enabled: false }, notes: [], uses: [] } : null;
  });
  readonly prerequisites = computed(() => (this.record().characterOption?.prerequisites ?? this.sourceData()['prerequisite'] ?? []) as Prerequisite[]);
  readonly statistics = computed(() => {
    const record = this.record();
    const rows: { label: string; value: string }[] = [];
    const add = (label: string, value: unknown) => { if (typeof value === 'string' || typeof value === 'number') rows.push({ label, value: String(value) }); };
    if (record.classDefinition) {
      const definition = record.classDefinition;
      if (definition.hitDice) add('Hit Dice', `${definition.hitDice.number}d${definition.hitDice.faces}`);
      if (definition.savingThrows.length) add('Saving Throws', definition.savingThrows.map(value => value.toUpperCase()).join(', '));
      if (definition.casting.ability) add('Spellcasting Ability', definition.casting.ability.toUpperCase());
    }
    if (record.species) add('Movement', formatSpeciesMovement(record.species));
    if (record.referenceDefinition) {
      const source = this.sourceData();
      for (const [field, label] of [['level', 'Level'], ['ac', 'Armor Class'], ['hp', 'Hit Points'],
        ['capCreature', 'Creature Capacity'], ['capCargo', 'Cargo Capacity'], ['cost', 'Cost']] as const) {
        if (field !== 'level' || record.kind !== 'facility') add(label, source[field]);
      }
    }
    const item = this.itemView()?.item;
    if (item) {
      add('Equipment Type', this.itemView()?.itemType);
      add('Armor Class', this.itemView()?.ac);
      if (typeof item['weight'] === 'number') add('Weight', `${item['weight']} lb.`);
      if (typeof item['value'] === 'number') add('Cost', `${item['value'] / 100} gp`);
      add('Damage', item['dmg1']); add('Versatile Damage', item['dmg2']); add('Range', item['range']);
      add('Attunement', item['reqAttune']);
    }
    return rows;
  });
  readonly metadata = computed(() => Object.entries(recordFacets(this.record()))
    .filter(([key]) => key !== 'source' && key !== 'kind' && key !== 'facilityOrder'
      && !(this.record().kind === 'monster' && ['size', 'creature', 'cr'].includes(key)))
    .map(([key, values]) => ({ label: FACET_LABELS[key as Facet], value: values!.map(value => facetLabel(key as Facet, value)).join(', ') })));
  readonly sections = computed(() => {
    const record = this.record();
    if (record.kind === 'table') {
      const table = tablePresentation(record);
      return [{ title: '', entries: [
        ...(table.intro ?? []),
        ...(table.tables ?? [{ type: 'table', ...table }]),
        ...(table.outro ?? []),
      ] as SourceEntries }];
    }
    const item = this.itemView();
    const sourceRecord = { ...record, data: this.sourceData() };
    const sections = [{ title: '', entries: item && Array.isArray(item.item['entries']) ? item.item['entries'] as SourceEntries : contentEntries(sourceRecord) },
      { title: '', entries: item?.typeEntries as SourceEntries ?? [] },
      { title: 'At Higher Levels', entries: contentEntries(sourceRecord, 'entriesHigherLevel') },
      { title: 'Template', entries: contentEntries(sourceRecord, 'entriesTemplate') }];
    if (record.kind === 'reward' && sourceRecord.data['abilityEntry'] != null) {
      sections.unshift({ title: 'Ability', entries: [sourceRecord.data['abilityEntry']] as SourceEntries });
    }
    // Species traits, reference actions and recipe descriptions use the same entry tree.
    for (const [field, title] of [['additionalEntries', 'Additional Details'], ['trait', 'Traits'], ['action', 'Actions'],
      ['bonus', 'Bonus Actions'], ['reaction', 'Reactions'], ['legendary', 'Legendary Actions'], ['actionEntries', 'Actions']] as const) {
      const entries = sourceRecord.data[field];
      if (Array.isArray(entries)) sections.push({ title, entries: entries as SourceEntries });
    }
    for (const rule of [...item?.properties ?? [], ...item?.masteries ?? []]) {
      sections.push({ title: rule.name, entries: [...rule.entries, ...rule.notes ?? []] as SourceEntries });
    }
    const inherited = asObject(sourceRecord.data['inherits'])?.['entries'];
    if (Array.isArray(inherited)) sections.push({ title: 'Magic Item Properties', entries: inherited as SourceEntries });
    return sections.filter(section => section.entries.length);
  });
}
