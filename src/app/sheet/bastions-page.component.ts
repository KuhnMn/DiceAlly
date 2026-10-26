import { Component, computed, input, signal } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import type { ExportedCharacter, FeatureNotes } from '../models/character.model';
import type { FacilityEntry } from '../models/bastion';
import { compareSearchMatches } from '../search-ranking';
import { ListControlsComponent } from '../list-controls.component';
import { UiIconComponent } from '../ui-icon.component';
import { SheetListLayoutComponent } from './sheet-list-layout.component';
import { SheetDetailDialogComponent } from './sheet-detail-dialog.component';
import { FeatureNotesComponent } from './feature-notes.component';
import { BastionPlanComponent } from './bastion-plan.component';
import { FacilityDetailsComponent } from './facility-details.component';
import { facilityTypeLabel, facilityOrderLabel, emptyFacilityFilters, facilityFilterCount, matchesFacilityFilters } from '../models/bastion';
import { FacilityFiltersComponent } from '../facility-filters.component';

@Component({
  selector: 'app-bastions-page',
  imports: [NgTemplateOutlet, ListControlsComponent, UiIconComponent, SheetListLayoutComponent, SheetDetailDialogComponent,
    FeatureNotesComponent, BastionPlanComponent, FacilityDetailsComponent, FacilityFiltersComponent],
  host: { class: 'block min-w-0' },
  template: `
    <ng-template #facilityTags let-facility>
      @if (facility.entity.level != null) { <span class="rounded bg-teal-container px-2 py-0.5 text-xs font-normal text-on-teal-container">Level {{ facility.entity.level }}</span> }
      <span class="rounded bg-secondary-container px-2 py-0.5 text-xs font-normal text-on-secondary-container">{{ typeLabel(facility.entity) }}</span>
      @for (order of facility.entity.orders ?? []; track order) { <span class="rounded bg-surface-container-high px-2 py-0.5 text-xs font-normal text-on-surface">{{ orderLabel(order) }}</span> }
    </ng-template>
    <section class="rounded-lg border-2 border-outline bg-surface-container-highest p-3 shadow-lg sm:p-5">
      <header class="mb-3 flex items-center justify-between gap-2"><h2 class="text-xl font-bold sm:text-3xl">Bastions</h2><app-sheet-list-layout #layout /></header>
      <app-bastion-plan [value]="characterData()?.bastion?.planUrl" />
      <h3 class="mb-2 text-lg font-bold">Facilities</h3>
      <app-list-controls label="Search facilities" [query]="query()" (queryChange)="query.set($event)" [filterCount]="filterCount()" (cleared)="clearFilters()">
        <app-facility-filters [value]="filters()" [levels]="levels()" (changed)="filters.set($event)" />
      </app-list-controls>
      <div class="grid items-start gap-3" [style.grid-template-columns]="'repeat(' + layout.displayColumns() + ', minmax(0, 1fr))'">
        @for (facility of selected(); track facility.editorId) {
          <article class="min-w-0 rounded-lg border-2 border-outline-variant bg-surface-container px-3 py-1.5 sm:py-2">
            <button type="button" class="flex min-h-11 w-full min-w-0 items-center justify-between gap-2 text-left" aria-haspopup="dialog" (click)="detail.set(facility)">
              <span class="sheet-entry-heading text-lg font-bold text-primary"><span class="min-w-0 truncate" [title]="facility.name">{{ facility.name }}</span><span class="sheet-entry-heading-tags"><ng-container [ngTemplateOutlet]="facilityTags" [ngTemplateOutletContext]="{$implicit: facility}" /></span></span><app-ui-icon name="chevron" class="shrink-0 text-primary" />
            </button>
            @if (facility.source) { <span class="inline-block max-w-full truncate rounded bg-surface-container-highest px-2 py-0.5 text-xs text-on-surface" [title]="facility.source">{{ facility.source }}</span> }
            <app-feature-notes [notes]="facility.notes" (notesChanged)="updateNotes(facility, $event)" />
          </article>
        } @empty { <p class="text-sm text-on-surface-variant">{{ query() || filterCount() ? 'No facilities match your search or filters.' : 'No facilities yet. Add facilities in the editor.' }}</p> }
      </div>
    </section>
    @if (detail(); as facility) {
      <ng-template #dialogTags>
          <ng-container [ngTemplateOutlet]="facilityTags" [ngTemplateOutletContext]="{$implicit: facility}" />
          @if (facility.source) { <span class="inline-block max-w-full truncate rounded bg-surface-container-highest px-2 py-0.5 text-xs text-on-surface" [title]="facility.source">{{ facility.source }}</span> }
      </ng-template>
      <app-sheet-detail-dialog [title]="facility.name" [tags]="dialogTags" (closed)="detail.set(null)">
        <app-facility-details [facility]="facility" [showMetadata]="false" />
        <app-feature-notes [notes]="facility.notes" (notesChanged)="updateNotes(facility, $event)" />
      </app-sheet-detail-dialog>
    }
  `,
})
export class BastionsPageComponent {
  readonly characterData = input<ExportedCharacter | null>(null);
  readonly query = signal('');
  readonly detail = signal<FacilityEntry | null>(null);
  readonly typeLabel = facilityTypeLabel;
  readonly orderLabel = facilityOrderLabel;
  readonly filters = signal(emptyFacilityFilters());
  readonly filterCount = computed(() => facilityFilterCount(this.filters()));
  readonly levels = computed(() => [...new Set((this.characterData()?.bastion?.facilities ?? []).flatMap(entry => entry.entity.level == null ? [] : [entry.entity.level]))].sort((a, b) => a - b));
  clearFilters() { this.filters.set(emptyFacilityFilters()); }
  readonly selected = computed(() => [...this.characterData()?.bastion?.facilities ?? []]
    .filter(entry => entry.name.toLowerCase().includes(this.query().trim().toLowerCase()) && matchesFacilityFilters(entry.entity, this.filters()))
    .sort((a, b) => compareSearchMatches(a.name, b.name, this.query())));
  updateNotes(facility: FacilityEntry, notes: FeatureNotes[]) { facility.notes = notes; }
}
