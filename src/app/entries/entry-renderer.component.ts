import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  AbilityAttackModEntry,
  AbilityDCEntry,
  CellTableRow,
  EntriesEntry,
  Entry,
  InsetEntry,
  ListEntry,
  ListItemEntry,
  ListItemSpellEntry,
  OptionsEntry,
  RefClassEntry,
  RefFeatEntry,
  RefOptionalEntry,
  RefSubclassEntry,
  SectionEntry,
  StringEntry,
  StructuredTableRow,
  TableEntry,
  TableRow,
} from '../models/character.model';

@Component({
  selector: 'app-entry-renderer',
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (entries()) {
      <div class="space-y-2">
        @for (item of entries()!; track trackEntry(item, $index)) {
          <app-entry-renderer [entry]="item" [compact]="compact()"></app-entry-renderer>
        }
      </div>
    }

    @if (entry()) {
      @switch (detectType(entry()!)) {
        @case ('list') {
          <ul class="space-y-1 mt-2 mb-2 list-none pl-0">
            @for (item of asListEntry(entry()!)?.items ?? []; track trackEntry(item, $index)) {
              <li class="flex items-baseline gap-2">
                <span class="mt-1 text-gray-700">•</span>
                <app-entry-renderer [entry]="item" [compact]="true"></app-entry-renderer>
              </li>
            }
          </ul>
        }
        @case ('table') {
          <div class="overflow-x-auto mt-2 mb-2">
            <table class="min-w-full text-sm border border-gray-300">
              <thead class="bg-gray-50">
                <tr>
                  @for (label of asTableEntry(entry()!)?.colLabels ?? []; track label) {
                    <th class="px-2 py-1 text-left border-b border-gray-300">{{ label }}</th>
                  }
                </tr>
              </thead>
              <tbody>
                @for (row of asTableEntry(entry()!)?.rows ?? []; track $index) {
                  <tr class="border-b border-gray-200">
                    @for (cell of normalizeTableRow(row); track $index) {
                      <td class="px-2 py-1 align-top">
                        <app-entry-renderer [entry]="cell" [compact]="true"></app-entry-renderer>
                      </td>
                    }
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
        @case ('entries') {
          <div class="space-y-2 mt-2">
            @if (asEntriesEntry(entry()!)?.name) {
              <div class="font-semibold">{{ asEntriesEntry(entry()!)?.name }}</div>
            }
            <app-entry-renderer [entries]="asEntriesEntry(entry()!)?.entries ?? []" [compact]="compact()"></app-entry-renderer>
          </div>
        }
        @case ('item') {
          <div class="space-y-1">
            <div class="font-semibold">{{ asListItemEntry(entry()!)?.name }}</div>
            @if (asListItemEntry(entry()!)?.entry) {
              <app-entry-renderer [entry]="asListItemEntry(entry()!)?.entry ?? null" [compact]="true"></app-entry-renderer>
            }
            @if (asListItemEntry(entry()!)?.entries?.length ?? 0 > 0) {
              <app-entry-renderer [entries]="asListItemEntry(entry()!)?.entries ?? []" [compact]="true"></app-entry-renderer>
            }
          </div>
        }
        @case ('itemSpell') {
          <div class="space-y-1">
            <div class="font-semibold">{{ asListItemSpellEntry(entry()!)?.name }}</div>
            @if (asListItemSpellEntry(entry()!)?.entry) {
              <app-entry-renderer [entry]="asListItemSpellEntry(entry()!)?.entry ?? null" [compact]="true"></app-entry-renderer>
            }
            @if (asListItemSpellEntry(entry()!)?.entries?.length ?? 0 > 0) {
              <app-entry-renderer [entries]="asListItemSpellEntry(entry()!)?.entries ?? []" [compact]="true"></app-entry-renderer>
            }
          </div>
        }
        @case ('inset') {
          <div class="border-l-4 border-gray-300 pl-3 py-1">
            <div class="font-semibold">{{ asInsetEntry(entry()!)?.name }}</div>
            <app-entry-renderer [entries]="asInsetEntry(entry()!)?.entries ?? []" [compact]="true"></app-entry-renderer>
          </div>
        }
        @case ('abilityDC') {
          <div class="text-sm text-gray-700">
            {{ asAbilityDcEntry(entry()!)?.name }} DC ({{ asAbilityDcEntry(entry()!)?.attributes?.join(', ') }})
          </div>
        }
        @case ('abilityAttackMod') {
          <div class="text-sm text-gray-700">
            {{ asAbilityAttackModEntry(entry()!)?.name }} Attack Mod ({{ asAbilityAttackModEntry(entry()!)?.attributes?.join(', ') }})
          </div>
        }
        @case ('options') {
          <app-entry-renderer [entries]="asOptionsEntry(entry()!)?.entries ?? []" [compact]="compact()"></app-entry-renderer>
        }
        @case ('section') {
          <app-entry-renderer [entries]="asSectionEntry(entry()!)?.entries ?? []" [compact]="compact()"></app-entry-renderer>
        }
        @case ('refSubclassFeature') {
          <div class="text-sm text-sky-700">Subclass Feature: {{ asRefSubclassEntry(entry()!)?.subclassFeature }}</div>
        }
        @case ('refClassFeature') {
          <div class="text-sm text-sky-700">Class Feature: {{ asRefClassEntry(entry()!)?.classFeature }}</div>
        }
        @case ('refFeat') {
          <div class="text-sm text-sky-700">Feat: {{ asRefFeatEntry(entry()!)?.feat }}</div>
        }
        @case ('refOptionalfeature') {
          <div class="text-sm text-sky-700">Optional Feature: {{ asRefOptionalEntry(entry()!)?.optionalfeature }}</div>
        }
        @default {
          <div class="text-sm whitespace-pre-wrap">{{ formatText(asStringEntry(entry()!)?.text ?? fallbackText(entry()!)) }}</div>
        }
      }
    }
  `,
})
export class EntryRendererComponent {
  entries = input<Entry[] | null>(null);
  entry = input<Entry | null>(null);
  compact = input(false);

  trackEntry(entry: Entry, index: number) {
    if (entry && typeof entry === 'object' && 'name' in entry && typeof entry.name === 'string') {
      return `${entry.name}-${index}`;
    }
    return index;
  }

  detectType(entry: Entry | null) {
    if (!entry || typeof entry !== 'object') return 'string';
    if ('type' in entry && typeof entry.type === 'string') {
      return this.normalizeType(entry.type);
    }
    if ('text' in entry) return 'string';
    return 'unknown';
  }

  private normalizeType(rawType: string): string {
    const type = rawType.trim();
    if (type === 'com.ltx.data.StringEntry') return 'string';
    if (type.startsWith('com.ltx.data.')) {
      return type.replace('com.ltx.data.', '');
    }
    return type;
  }

  asStringEntry(entry: Entry): StringEntry | null {
    return this.detectType(entry) === 'string' ? (entry as StringEntry) : null;
  }

  asListEntry(entry: Entry): ListEntry | null {
    return this.detectType(entry) === 'list' ? (entry as ListEntry) : null;
  }

  asTableEntry(entry: Entry): TableEntry | null {
    return this.detectType(entry) === 'table' ? (entry as TableEntry) : null;
  }

  asEntriesEntry(entry: Entry): EntriesEntry | null {
    return this.detectType(entry) === 'entries' ? (entry as EntriesEntry) : null;
  }

  asListItemEntry(entry: Entry): ListItemEntry | null {
    return this.detectType(entry) === 'item' ? (entry as ListItemEntry) : null;
  }

  asListItemSpellEntry(entry: Entry): ListItemSpellEntry | null {
    return this.detectType(entry) === 'itemSpell' ? (entry as ListItemSpellEntry) : null;
  }

  asInsetEntry(entry: Entry): InsetEntry | null {
    return this.detectType(entry) === 'inset' ? (entry as InsetEntry) : null;
  }

  asAbilityDcEntry(entry: Entry): AbilityDCEntry | null {
    return this.detectType(entry) === 'abilityDC' ? (entry as AbilityDCEntry) : null;
  }

  asAbilityAttackModEntry(entry: Entry): AbilityAttackModEntry | null {
    return this.detectType(entry) === 'abilityAttackMod' ? (entry as AbilityAttackModEntry) : null;
  }

  asOptionsEntry(entry: Entry): OptionsEntry | null {
    return this.detectType(entry) === 'options' ? (entry as OptionsEntry) : null;
  }

  asSectionEntry(entry: Entry): SectionEntry | null {
    return this.detectType(entry) === 'section' ? (entry as SectionEntry) : null;
  }

  asRefSubclassEntry(entry: Entry): RefSubclassEntry | null {
    return this.detectType(entry) === 'refSubclassFeature' ? (entry as RefSubclassEntry) : null;
  }

  asRefClassEntry(entry: Entry): RefClassEntry | null {
    return this.detectType(entry) === 'refClassFeature' ? (entry as RefClassEntry) : null;
  }

  asRefFeatEntry(entry: Entry): RefFeatEntry | null {
    return this.detectType(entry) === 'refFeat' ? (entry as RefFeatEntry) : null;
  }

  asRefOptionalEntry(entry: Entry): RefOptionalEntry | null {
    return this.detectType(entry) === 'refOptionalfeature' ? (entry as RefOptionalEntry) : null;
  }

  normalizeTableRow(row: TableRow): Entry[] {
    if (Array.isArray(row)) return row;
    if (this.isStructuredRow(row)) return row.row ?? [];
    if (this.isCellRow(row)) return [row.entry];
    return [];
  }

  isStructuredRow(row: TableRow): row is StructuredTableRow {
    return typeof row === 'object' && row !== null && 'type' in row && row.type === 'row';
  }

  isCellRow(row: TableRow): row is CellTableRow {
    return typeof row === 'object' && row !== null && 'type' in row && row.type === 'cell';
  }

  fallbackText(entry: Entry) {
    return JSON.stringify(entry, null, 2);
  }

  formatText(text: string) {
    if (!text) return '';
    return text
      .replace(/\{@spell\s([^|}]+)(?:\|[^}]+)?\}/g, '$1')
      .replace(/\{@skill\s([^|}]+)(?:\|[^}]+)?\}/g, '$1')
      .replace(/\{@action\s([^|}]+)(?:\|[^}]+)?\}/g, '$1')
      .replace(/\{@condition\s([^|}]+)(?:\|[^}]+)?\}/g, '$1')
      .replace(/\{@damage\s([^}]+)\}/g, '$1')
      .replace(/\{@dice\s([^}]+)\}/g, '$1')
      .replace(/\{@dc\s([^}]+)\}/g, 'DC $1')
      .replace(/\{@hit\s([^}]+)\}/g, '+$1')
      .replace(/\{@variantrule\s([^|}]+)(?:\|[^}]+)?\}/g, '$1')
      .replace(/\{@book\s([^|}]+)(?:\|[^}]+)?\}/g, '$1')
      .replace(/\{@i\s([^}]+)\}/g, '$1')
      .replace(/\{@b\s([^}]+)\}/g, '$1')
      .replace(/\{@recharge\s([^}]+)\}/g, 'Recharge $1')
      .replace(/\{@actSave\s([^}]+)\}/g, '$1 save')
      .replace(/\{@actSaveFail\s([^}]+)\}/g, 'On fail: $1')
      .replace(/\{@actSaveSuccess\s([^}]+)\}/g, 'On success: $1')
      .replace(/\{@actSaveSuccessOrFail\s([^}]+)\}/g, '$1');
  }


}

