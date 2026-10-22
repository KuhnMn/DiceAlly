import type { SourceEntry } from '../content/content-entries';
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

type SourceEntryOf<K extends string> = Extract<SourceEntry, { type: K }>;
// Android permits optional fields absent from a source branch (e.g. itemSpell.entries).
type RenderEntry<K extends string, Legacy> = Legacy
  | (SourceEntryOf<K> & Partial<Omit<Legacy, keyof SourceEntryOf<K>>>);

interface StyledTextSegment {
  text: string;
  type: 'normal' | 'tag' | 'bonus' | 'link';
  bold?: boolean;
}

type StyleType = 'TAG' | 'BONUS' | 'LINK' | 'BOLD';

@Component({
  selector: 'app-entry-renderer',
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[style.display]': "inline() ? 'inline' : null" },
  template: `
    @if (entries()) {
      <div class="space-y-2">
        @for (item of entries()!; track trackEntry(item, $index)) {
          <app-entry-renderer [entry]="item" [compact]="compact()"></app-entry-renderer>
        }
      </div>
    }

    @if (entry() !== null) {
      @switch (detectType(entry()!)) {
        @case ('list') {
          <ul class="space-y-1 mt-2 mb-2 list-none pl-0">
            @for (item of asListEntry(entry()!)?.items ?? []; track trackEntry(item, $index)) {
              <li class="flex items-baseline gap-2">
                <span class="mt-1 text-primary">•</span>
                <app-entry-renderer [entry]="item" [compact]="true"></app-entry-renderer>
              </li>
            }
          </ul>
        }
        @case ('table') {
          <div class="overflow-x-auto mt-2 mb-2">
            <table class="min-w-full text-sm border border-outline-variant">
              <thead class="bg-primary-container text-on-primary-container">
                <tr>
                  @for (label of asTableEntry(entry()!)?.colLabels ?? []; track label) {
                    <th class="px-2 py-1 text-left border-b border-outline-variant">{{ label }}</th>
                  }
                </tr>
              </thead>
              <tbody>
                @for (row of asTableEntry(entry()!)?.rows ?? []; track $index) {
                  <tr class="border-b border-outline-variant">
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
        @case ('quote') {
          @if (asQuoteEntry(entry()!); as quote) {
            <blockquote class="my-3 space-y-2 border-l-2 border-outline-variant pl-4">
              @if (quote.name) { <div class="font-semibold">{{ quote.name }}</div> }
              <div [class.italic]="!quote.skipItalics">
                <app-entry-renderer [entries]="quote.entries" [compact]="compact()" />
              </div>
              @if (quote.by || quote.from) {
                <footer class="text-sm text-on-surface-variant">
                  <app-entry-renderer [entry]="{text: quoteAttribution(quote)}" [compact]="true" />
                </footer>
              }
            </blockquote>
          }
        }
        @case ('inset') {
          <div class="border-l-4 border-outline-variant pl-3 py-1">
            <div class="font-semibold">{{ asInsetEntry(entry()!)?.name }}</div>
            <app-entry-renderer [entries]="asInsetEntry(entry()!)?.entries ?? []" [compact]="true"></app-entry-renderer>
          </div>
        }
        @case ('abilityDC') {
          <div class="text-sm text-on-surface-container">
            {{ asAbilityDcEntry(entry()!)?.name }} DC ({{ asAbilityDcEntry(entry()!)?.attributes?.join(', ') }})
          </div>
        }
        @case ('abilityAttackMod') {
          <div class="text-sm text-on-surface-container">
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
          <div class="text-sm text-secondary">Subclass Feature: {{ asRefSubclassEntry(entry()!)?.subclassFeature }}</div>
        }
        @case ('refClassFeature') {
          <div class="text-sm text-secondary">Class Feature: {{ asRefClassEntry(entry()!)?.classFeature }}</div>
        }
        @case ('refFeat') {
          <div class="text-sm text-secondary">Feat: {{ asRefFeatEntry(entry()!)?.feat }}</div>
        }
        @case ('refOptionalfeature') {
          <div class="text-sm text-secondary">Optional Feature: {{ asRefOptionalEntry(entry()!)?.optionalfeature }}</div>
        }
        @default {
          <div class="whitespace-pre-wrap" [class.text-sm]="!inline()" [class.inline]="inline()">
            @for (segment of parseStyledText(asStringEntry(entry()!)?.text ?? fallbackText(entry()!)); track $index) {
              @if (segment.type === 'normal') {
                <span [class.font-bold]="segment.bold">{{ segment.text }}</span>
              }
              @if (segment.type === 'tag') {
                <span class="text-primary font-bold">{{ segment.text }}</span>
              }
              @if (segment.type === 'bonus') {
                <span class="text-tertiary font-bold">{{ segment.text }}</span>
              }
              @if (segment.type === 'link') {
                <span class="text-secondary font-bold">{{ segment.text }}</span>
              }
            }
          </div>
        }
      }
    }
  `,
})
export class EntryRendererComponent {
  entries = input<Entry[] | null>(null);
  entry = input<Entry | null>(null);
  compact = input(false);
  inline = input(false);

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

  asListEntry(entry: Entry): RenderEntry<'list', ListEntry> | null {
    return this.detectType(entry) === 'list' ? (entry as RenderEntry<'list', ListEntry>) : null;
  }

  asTableEntry(entry: Entry): RenderEntry<'table', TableEntry> | null {
    return this.detectType(entry) === 'table' ? (entry as RenderEntry<'table', TableEntry>) : null;
  }

  asEntriesEntry(entry: Entry): RenderEntry<'entries', EntriesEntry> | null {
    return this.detectType(entry) === 'entries' ? (entry as RenderEntry<'entries', EntriesEntry>) : null;
  }

  asQuoteEntry(entry: Entry): SourceEntryOf<'quote'> | null {
    return this.detectType(entry) === 'quote' ? entry as SourceEntryOf<'quote'> : null;
  }

  quoteAttribution(quote: SourceEntryOf<'quote'>): string {
    const authors = Array.isArray(quote.by) ? quote.by.join(', ') : quote.by ?? '';
    return `— ${[authors, quote.from].filter(Boolean).join(', ')}`;
  }

  asListItemEntry(entry: Entry): RenderEntry<'item', ListItemEntry> | null {
    return this.detectType(entry) === 'item' ? (entry as RenderEntry<'item', ListItemEntry>) : null;
  }

  asListItemSpellEntry(entry: Entry): RenderEntry<'itemSpell', ListItemSpellEntry> | null {
    return this.detectType(entry) === 'itemSpell' ? (entry as RenderEntry<'itemSpell', ListItemSpellEntry>) : null;
  }

  asInsetEntry(entry: Entry): RenderEntry<'inset', InsetEntry> | null {
    return this.detectType(entry) === 'inset' ? (entry as RenderEntry<'inset', InsetEntry>) : null;
  }

  asAbilityDcEntry(entry: Entry): RenderEntry<'abilityDC', AbilityDCEntry> | null {
    return this.detectType(entry) === 'abilityDC' ? (entry as RenderEntry<'abilityDC', AbilityDCEntry>) : null;
  }

  asAbilityAttackModEntry(entry: Entry): RenderEntry<'abilityAttackMod', AbilityAttackModEntry> | null {
    return this.detectType(entry) === 'abilityAttackMod' ? (entry as RenderEntry<'abilityAttackMod', AbilityAttackModEntry>) : null;
  }

  asOptionsEntry(entry: Entry): RenderEntry<'options', OptionsEntry> | null {
    return this.detectType(entry) === 'options' ? (entry as RenderEntry<'options', OptionsEntry>) : null;
  }

  asSectionEntry(entry: Entry): RenderEntry<'section', SectionEntry> | null {
    return this.detectType(entry) === 'section' ? (entry as RenderEntry<'section', SectionEntry>) : null;
  }

  asRefSubclassEntry(entry: Entry): RenderEntry<'refSubclassFeature', RefSubclassEntry> | null {
    return this.detectType(entry) === 'refSubclassFeature' ? (entry as RenderEntry<'refSubclassFeature', RefSubclassEntry>) : null;
  }

  asRefClassEntry(entry: Entry): RenderEntry<'refClassFeature', RefClassEntry> | null {
    return this.detectType(entry) === 'refClassFeature' ? (entry as RenderEntry<'refClassFeature', RefClassEntry>) : null;
  }

  asRefFeatEntry(entry: Entry): RenderEntry<'refFeat', RefFeatEntry> | null {
    return this.detectType(entry) === 'refFeat' ? (entry as RenderEntry<'refFeat', RefFeatEntry>) : null;
  }

  asRefOptionalEntry(entry: Entry): RenderEntry<'refOptionalfeature', RefOptionalEntry> | null {
    return this.detectType(entry) === 'refOptionalfeature' ? (entry as RenderEntry<'refOptionalfeature', RefOptionalEntry>) : null;
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
    return typeof entry === 'string' ? entry : JSON.stringify(entry, null, 2);
  }

  /** Match complete outer tags, keeping nested reference/formatting tags in their payload. */
  private inlineTagMatches(text: string): RegExpMatchArray[] {
    const matches: RegExpMatchArray[] = [];
    for (let start = text.indexOf('{@'); start >= 0;) {
      let depth = 1, end = start + 2;
      for (; end < text.length && depth; end++) {
        if (text[end] === '{') depth++;
        else if (text[end] === '}') depth--;
      }
      if (depth) break;
      const match = /^\{@(\w*)\s*([\s\S]*)\}$/.exec(text.slice(start, end));
      if (match) { match.index = start; matches.push(match); }
      start = text.indexOf('{@', end);
    }
    return matches;
  }
  private readonly bonusRegex = /\{=(\w*)\}/g;
  private readonly linkRegex = /\{#(\w*)\s*([^}]*)\}/g;

  parseStyledText(text: string, depth = 0): StyledTextSegment[] {
    if (!text) return [];
    if (depth > 32) return [{ text, type: 'normal' }];

    const segments: StyledTextSegment[] = [];
    const tagMatches = this.inlineTagMatches(text).map(match => ({ match, type: 'TAG' as StyleType }));
    const bonusMatches = Array.from(text.matchAll(this.bonusRegex)).map(m => ({ match: m, type: 'BONUS' as StyleType }));
    const linkMatches = Array.from(text.matchAll(this.linkRegex)).map(m => ({ match: m, type: 'LINK' as StyleType }));
    const boldMatches = Array.from(text.matchAll(/\*\*([^*]+)\*\*/g)).map(m => ({ match: m, type: 'BOLD' as StyleType }));

    // Combine and sort by start position
    const allMatches = [...tagMatches, ...bonusMatches, ...linkMatches, ...boldMatches].sort(
      (a, b) => a.match.index! - b.match.index!
    );

    let lastIndex = 0;

    for (const { match, type } of allMatches) {
      // Append normal text before the match
      if (match.index! > lastIndex) {
        segments.push({
          text: text.substring(lastIndex, match.index!),
          type: 'normal',
        });
      }

      // Skip overlapping matches
      if (match.index! < lastIndex) continue;

      if (type === 'BOLD') {
        segments.push(...this.parseStyledText(match[1], depth + 1).map(segment => ({ ...segment, bold: true })));
        lastIndex = match.index! + match[0].length;
        continue;
      }
      if (type === 'TAG' && match[1] === 'note') {
        segments.push(...this.parseStyledText(match[2], depth + 1));
        lastIndex = match.index! + match[0].length;
        continue;
      }
      const styledText = this.processMatch(match, type);
      if (styledText) {
        segments.push({
          text: styledText,
          type: this.mapStyleType(type),
        });
      }

      lastIndex = match.index! + match[0].length;
    }

    // Append remaining text
    if (lastIndex < text.length) {
      segments.push({
        text: text.substring(lastIndex),
        type: 'normal',
      });
    }

    return segments;
  }

  private mapStyleType(type: StyleType): 'tag' | 'bonus' | 'link' {
    return type === 'TAG' ? 'tag' : type === 'BONUS' ? 'bonus' : 'link';
  }

  private processMatch(matchResult: RegExpMatchArray, type: Exclude<StyleType, 'BOLD'>): string | null {
    switch (type) {
      case 'TAG':
        return this.processTagMatch(matchResult);
      case 'BONUS':
        return this.processBonusMatch(matchResult);
      case 'LINK':
        return this.processLinkMatch(matchResult);
    }
  }

  private processTagMatch(matchResult: RegExpMatchArray): string {
    const classifier = matchResult[1];
    let tagName = matchResult[2] || '';

    if (tagName) {
      const parts = tagName.split('|');
      tagName = parts.length > 2 && (classifier === 'scaledamage' || classifier === 'variantrule')
        ? parts[2]
        : parts[0];
    } else {
      tagName = classifier;
    }

    const mappedTag = this.mapTagName(tagName, classifier);
    return this.capitalizeWords(mappedTag);
  }

  private mapTagName(tag: string, classifier: string): string {
    const suffixHandler = () => {
      if (classifier === 'atkr') return ' Attack Roll:';
      if (classifier === 'atk') return ' Attack:';
      return ':';
    };

    switch (tag) {
      case 'h':
        return 'Hit: ';
      case 'm,r':
        return 'Melee or Ranged' + suffixHandler();
      case 'm':
        return 'Melee' + suffixHandler();
      case 'r':
        return 'Ranged' + suffixHandler();
      case 'mw':
        return 'Melee Weapon' + suffixHandler();
      case 'rw':
        return 'Ranged Weapon' + suffixHandler();
      case 'mw,rw':
        return 'Melee or Ranged Weapon' + suffixHandler();
      case 'ms':
        return 'Melee Spell' + suffixHandler();
      case 'rs':
        return 'Ranged Spell' + suffixHandler();
      case 'ms,rs':
        return 'Melee or Ranged Spell' + suffixHandler();
      case 'hom':
        return 'Hit or Miss:';
      case 'actSaveFail':
        return 'Failure:';
      case 'actSaveSuccess':
        return 'Success:';
      case 'actSaveSuccessOrFail':
        return 'Success or Failure:';
      case 'actTrigger':
        return 'Trigger:';
      case 'actResponse':
        return 'Response:';
      default: {
        let prefix = '';
        if (classifier === 'hit') prefix = '+';
        else if (classifier === 'dc') prefix = 'DC ';
        else if (classifier === 'recharge' && tag !== 'recharge') prefix = 'Recharge: ';

        let suffix = '';
        if (classifier === 'actSave') suffix = ' Saving Throw:';
        else if (classifier === 'recharge' && tag !== 'recharge') suffix = '+';
        else if (tag === 'recharge') suffix = ': 6';

        let result = prefix + tag + suffix;
        // Replace placeholder text
        result = result
          .replace('summonSpellLevel', "the spell's level")
          .replace('hitYourSpellAttack', 'your spell attack modifier')
          .replace('saveYourSpellDC', 'your spell DC');

        return result;
      }
    }
  }

  private processBonusMatch(matchResult: RegExpMatchArray): string {
    const tag = matchResult[1];
    const bonusMapping: { [key: string]: string } = {
      'baseName/at': 'An',
      'baseName/a': 'an',
      'baseName/l': 'item',
      'baseName/lt': 'Item',
      'dmgType': 'X-type',
      'bonusWeaponAttack': '+X',
      'bonusWeapon': '+X',
      'bonusAc': '+X',
      'bonusSpellAttack': '+X',
      'bonusSpellDc': '+X',
      'bonusSpellDamage': '+X',
      'bonusSavingThrow': '+X',
    };

    return bonusMapping[tag] || tag;
  }

  private processLinkMatch(matchResult: RegExpMatchArray): string {
    const linkText = matchResult[2].split('|')[0];
    return `See ${linkText}`;
  }

  private capitalizeWords(text: string): string {
    return text
      .split(' ')
      .map(word => {
        if (word.length === 0) return word;
        return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
      })
      .join(' ');
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

