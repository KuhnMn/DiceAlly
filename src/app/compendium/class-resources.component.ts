import { Component, computed, input, signal } from '@angular/core';
import { ContentRecord } from '../content/content.model';
import { EntryRendererComponent } from '../entries/entry-renderer.component';
import { classCastingNotes, classGrantedSpells, classResourceTables, resourceCell, ResourceTable } from './class-resources';

@Component({
  selector: 'app-class-resources',
  imports: [EntryRendererComponent],
  templateUrl: './class-resources.component.html',
  styles: [`
    :host { display: block; min-width: 0; margin-bottom: 1.5rem; }
    th, td { border-bottom: 1px solid var(--md-sys-color-outline-variant); padding: .5rem .65rem; text-align: center; vertical-align: middle; }
    th { font-weight: 600; background: var(--md-sys-color-surface-container-high); }
    .level-cell { position: sticky; left: 0; z-index: 1; min-width: 3.5rem; background: var(--md-sys-color-surface-container); }
    thead .level-cell { z-index: 2; background: var(--md-sys-color-surface-container-high); }
    tr.preview-level td, tr.preview-level th { background: var(--md-sys-color-secondary-container); color: var(--md-sys-color-on-secondary-container); }
    .table-scroll:focus-visible { outline: 2px solid var(--md-sys-color-primary); outline-offset: 2px; }
  `],
})
export class ClassResourcesComponent {
  readonly owner = input.required<ContentRecord>();
  readonly subclass = input<ContentRecord | null>(null);
  readonly selectedLevel = signal(1);
  readonly tables = computed(() => classResourceTables(this.owner(), this.subclass()));
  readonly notes = computed(() => classCastingNotes(this.owner(), this.subclass()));
  readonly grants = computed(() => classGrantedSpells(this.owner(), this.subclass()));
  readonly levels = computed(() => Array.from({ length: Math.max(20, ...this.tables().map(table => table.rows.length)) }, (_, index) => index + 1));
  cell(table: ResourceTable, level: number, column: number) { return resourceCell(table.rows[level]?.[column]); }
  levelChanged(value: string) { const level = Number(value); if (this.levels().includes(level)) this.selectedLevel.set(level); }
}
