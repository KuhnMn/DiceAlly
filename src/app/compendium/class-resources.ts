import { ABILITY_NAMES, abilityName } from '../models/character-references';
import type { BrewSourceByKind } from '../content/generated/brew-source';
import { ContentRecord, normalize } from '../content/content.model';
import { ClassCasting } from '../content/class.model';
import { classDefinition } from '../content/class-adapter';
import { SourceEntries, SourceEntry } from '../content/content-entries';
import { additionalSpells, SPELL_GRANT_LISTS, visitSpellGrantGroups } from '../content/additional-spells';
import { belongsToClass } from './class-compendium';

type TableGroup = NonNullable<BrewSourceByKind['class']['classTableGroups']>[number];
type FixedSpellRank = keyof NonNullable<ClassCasting['spellsKnownProgressionFixedByLevel']>[string];
export interface ResourceTable {
  id: string; title: string; owner: string; publication: string; subclass: boolean;
  labels: string[]; rows: SourceEntries[]; note?: string;
  spellSlots?: boolean;
}
export interface CastingNote { owner: string; label: string; text: string; }
export interface GrantedSpellGroup { id: string; listId: string; owner: string; title: string; requirement: string; requirementShort: string; frequency: string; entries: SourceEntries; expanded: boolean; }
export interface GrantedSpellList { id: string; owner: string; title: string; groups: GrantedSpellGroup[]; expanded: boolean; }

/** Keep alternative lists, owners and grant kinds separate while sharing one heading per list. */
export function groupGrantedSpells(groups: GrantedSpellGroup[]): GrantedSpellList[] {
  const lists = new Map<string, GrantedSpellList>();
  for (const group of groups) {
    if (!lists.has(group.listId)) lists.set(group.listId, { id: group.listId, owner: group.owner, title: group.title, expanded: group.expanded, groups: [] });
    lists.get(group.listId)!.groups.push(group);
  }
  return [...lists.values()];
}

/** The shared prose renderer does not format the schema's specialized numeric table cells. */
export function resourceCell(value: SourceEntry | undefined): SourceEntry {
  if (value == null) return '—';
  if (typeof value !== 'object') return value;
  if (value.type === 'dice') return value.toRoll?.map(die => `${die.number}d${die.faces}${die.modifier && !die.hideModifier ? `${die.modifier > 0 ? '+' : ''}${die.modifier}` : ''}`).join(' + ') || '—';
  if (value.type === 'bonus' || value.type === 'bonusSpeed') return `${value.value > 0 ? '+' : ''}${value.value}${value.type === 'bonusSpeed' ? ' ft.' : ''}`;
  if (value.type === 'cell') {
    if (value.entry != null) return resourceCell(value.entry);
    if (value.roll && 'exact' in value.roll) return String(value.roll.exact);
    if (value.roll && 'min' in value.roll) return `${value.roll.min}–${value.roll.max}`;
    return '—';
  }
  return value;
}

/** The tables remain source values, including dice and rich entries; no character rules are evaluated. */
function tableApplies(group: TableGroup, selected: ContentRecord | null): boolean {
  if (!group.subclasses?.length) return true;
  if (!selected) return false;
  const names = [selected.name, classDefinition(selected).shortName ?? selected.name].map(normalize);
  return group.subclasses.some(subclass => names.includes(normalize(subclass.name)) && normalize(subclass.source) === normalize(selected.publication));
}
const plain = (label: string) => label.replace(/\{@\w+ ([^{}]*)\}/g, (_match, body: string) => body.split('|')[0]).toLowerCase();
const sameSeries = (values: readonly number[], table: ResourceTable, column: number) => values.length === table.rows.length
  && values.every((value, index) => String(value) === String(table.rows[index][column]));

function ownerTables(owner: ContentRecord, selected: ContentRecord | null, subclass: boolean): ResourceTable[] {
  const groups = owner.data[subclass ? 'subclassTableGroups' : 'classTableGroups'] as TableGroup[] | undefined;
  const tables: ResourceTable[] = (groups ?? []).filter(group => tableApplies(group, selected)).map((group, index) => ({
    id: `${owner.key}:source:${index}`, title: group.title || (subclass ? 'Subclass Resources' : 'Class Resources'),
    owner: owner.name, publication: owner.publication, subclass, labels: [...group.colLabels],
    rows: ('rows' in group ? group.rows : group.rowsSpellProgression) as SourceEntries[], spellSlots: 'rowsSpellProgression' in group,
  }));
  const casting = classDefinition(owner).casting;
  const columns: { label: string; values: (number | string)[] }[] = [];
  const add = (label: string, values: readonly number[] | undefined, matches: RegExp) => {
    if (!values?.length || tables.some(table => table.labels.some((label, column) => matches.test(plain(label)) && sameSeries(values, table, column)))) return;
    columns.push({ label, values: [...values] });
  };
  add('Cantrips Known', casting.cantripProgression, /cantrip/);
  add('Spells Known', casting.spellsKnownProgression, /spells? known|known spells?/);
  add('Prepared Spells', casting.preparedSpellsProgression, /prepared spells?|spells? prepared/);
  add('Spells Learned at This Level', casting.spellsKnownProgressionFixed, /spells? learned|spells? gained/);
  if (columns.length) tables.push({ id: `${owner.key}:casting`, title: 'Spellcasting Progression', owner: owner.name,
    publication: owner.publication, subclass, labels: columns.map(column => column.label),
    rows: Array.from({ length: Math.max(...columns.map(column => column.values.length)) }, (_, level) => columns.map(column => column.values[level] ?? '—')),
    note: casting.spellsKnownProgressionFixed ? 'Spells learned at this level are new additions, not the total number of spells known.' : undefined,
  });
  const fixed = casting.spellsKnownProgressionFixedByLevel;
  if (fixed && Object.keys(fixed).length) {
    const ranks = [...new Set(Object.values(fixed).flatMap(row => Object.keys(row)))].sort((a, b) => Number(a) - Number(b)) as FixedSpellRank[];
    const count = Math.max(20, ...Object.keys(fixed).map(Number));
    tables.push({ id: `${owner.key}:fixed`, title: 'Fixed Spells by Spell Level', owner: owner.name, publication: owner.publication, subclass,
      labels: ranks.map(rank => `Spell Level ${rank}`),
      rows: Array.from({ length: count }, (_, index) => ranks.map(rank => fixed[String(index + 1)]?.[rank] ?? '—')),
      note: 'Counts are shown at the class levels specified by this source. A dash means no value was supplied for that level.' });
  }
  for (const [index, option] of classDefinition(owner).optionalFeatures.entries()) {
    const progression = option.progression;
    if (!Array.isArray(progression) && '*' in progression) continue;
    const byLevel = new Map(Object.entries(progression));
    const values = Array.isArray(progression) ? progression : Array.from({ length: 20 }, (_, level) => byLevel.get(String(level + 1)) ?? '—');
    if (Array.isArray(progression) && tables.some(table => table.labels.some((_label, column) =>
      sameSeries(progression, table, column) && plain(table.labels[column]).includes(plain(option.name).replace(/eldritch\s+/g, ''))))) continue;
    tables.push({ id: `${owner.key}:optional:${index}`, title: option.name, owner: owner.name, publication: owner.publication, subclass,
      labels: [Array.isArray(progression) ? option.name : `${option.name} Gained`], rows: values.map(value => [value]),
      note: Array.isArray(progression) ? 'Total selections available at each class level.' : 'Selections gained at the exact levels specified; values are not cumulative.' });
  }
  return tables;
}

export function classResourceTables(owner: ContentRecord, selected: ContentRecord | null): ResourceTable[] {
  const subclass = selected && belongsToClass(selected, owner) ? selected : null;
  return [...ownerTables(owner, subclass, false), ...(subclass ? ownerTables(subclass, subclass, true) : [])];
}

export function preparedSpellFormula(formula: string): string {
  return formula.replace(/<\$(\w+)\$>/g, (_match, token: string) => token === 'level' ? 'Class Level'
    : token.endsWith('_mod') && Object.hasOwn(ABILITY_NAMES, token.slice(0, -4)) ? `${abilityName(token.slice(0, -4))} Modifier` : token.replaceAll('_', ' '));
}
export function classCastingNotes(owner: ContentRecord, selected: ContentRecord | null): CastingNote[] {
  const notes: CastingNote[] = [];
  for (const record of [owner, ...(selected && belongsToClass(selected, owner) ? [selected] : [])]) {
    const casting: ClassCasting = classDefinition(record).casting;
    const add = (label: string, text: string) => notes.push({ owner: record.name, label, text });
    if (casting.progression) add('Spellcasting', ({ full: 'Full Caster', '1/2': 'Half Caster', '1/3': 'Third Caster', artificer: 'Artificer Spellcasting', pact: 'Pact Magic' } as const)[casting.progression]);
    if (casting.ability) add('Spellcasting Ability', abilityName(casting.ability));
    if (casting.preparedSpells) add('Prepared Spells', preparedSpellFormula(casting.preparedSpells));
    if (casting.preparedSpellsChange) add('Change Prepared Spells', ({ restShort: 'After a Short Rest', restLong: 'After a Long Rest', level: 'On Gaining a Level' } as const)[casting.preparedSpellsChange]);
    if (casting.spellsKnownProgressionFixedAllowLowerLevel) add('Spell Choices', 'Spells learned can include lower-level spells.');
    for (const option of classDefinition(record).optionalFeatures) {
      if (!Array.isArray(option.progression) && '*' in option.progression) add(option.name, `${option.progression['*']} selections when this progression is granted.`);
    }
  }
  return notes;
}

const LIST_NAMES = { innate: 'Innate Spells', known: 'Known Spells', prepared: 'Prepared Spells', expanded: 'Expanded Spell List' };
const FREQUENCIES: Record<string, string> = { daily: 'Per Day', rest: 'Per Rest', resource: 'Resource Uses', limited: 'Limited Uses', will: 'At Will', ritual: 'Ritual', others: 'Other' };
const spellTag = (reference: string) => `{@spell ${reference.split('#')[0]}}`;
function grantEntry(value: import('../content/additional-spells').SpellGrantEntries[number]): string {
  if (typeof value === 'string') return spellTag(value);
  if ('choose' in value && typeof value.choose === 'object') return `Choose ${value.choose.count ?? 1}: ${value.choose.from.map(spellTag).join(', ')}`;
  const filter = 'all' in value ? value.all : 'choose' in value ? value.choose : '';
  const count = 'count' in value ? value.count : 1;
  return `${'all' in value ? 'All matching spells' : `Choose ${count} spell(s)`}: ${String(filter).split('|').map(part => part.replace('=', ': ')).join(' · ')}`;
}
export function classGrantedSpells(owner: ContentRecord, selected: ContentRecord | null): GrantedSpellGroup[] {
  const result: GrantedSpellGroup[] = [];
  for (const record of [owner, ...(selected && belongsToClass(selected, owner) ? [selected] : [])]) {
    const blocks = additionalSpells(record) ?? [];
    blocks.forEach((block, blockIndex) => {
      for (const list of SPELL_GRANT_LISTS) {
        for (const [requirement, values] of Object.entries(block[list] ?? {})) {
          visitSpellGrantGroups(values, `${blockIndex}.${list}.${requirement}`, (entries, path, frequency, count) => {
            result.push({ id: `${record.key}:${path}`, listId: `${record.key}:${blockIndex}.${list}`, owner: record.name,
              title: `${LIST_NAMES[list]}${block.name ? ` · ${block.name}` : blocks.length > 1 ? ` · Option ${blockIndex + 1}` : ''}`,
              requirement: requirement === '_' ? 'On Gaining This Class or Subclass' : requirement.startsWith('s') ? `When Spell Level ${requirement.slice(1)} Is Available` : `Class Level ${requirement}`,
              requirementShort: requirement === '_' ? 'On Selection' : requirement.startsWith('s') ? `Spell Lv. ${requirement.slice(1)}` : `Class Lv. ${requirement}`,
              frequency: frequency ? `${FREQUENCIES[frequency] ?? frequency}${count ? ` · ${count.replace(/e$/, ' Each')}` : ''}` : '',
              entries: entries.map(grantEntry), expanded: list === 'expanded' });
          });
        }
      }
    });
  }
  return result;
}
