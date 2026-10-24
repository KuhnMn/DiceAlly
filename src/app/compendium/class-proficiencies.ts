import type { BrewSourceByKind } from '../content/generated/brew-source';
import { ContentRecord, object } from '../content/content.model';
import { classDefinition } from '../content/class-adapter';
import { ClassDefinition } from '../content/class.model';
import { SourceEntries } from '../content/content-entries';
import { spellSaveLabel } from '../content/spell-effects';
import { preparePrerequisites } from '../sheet/prerequisite-presentation';
import { Prerequisite } from '../models/character.model';

type ClassSource = BrewSourceByKind['class'];
type Proficiencies = NonNullable<ClassDefinition['proficiencies']['starting']>;
type Requirements = NonNullable<ClassSource['requirements']>;
export interface ClassInfoRow { label: string; entries: SourceEntries; }
export interface ClassProficiencyInfo { requirements: ClassInfoRow[]; proficiencies: ClassInfoRow[]; entries: SourceEntries; }
const title = (text: string) => text.replace(/\b\w/g, letter => letter.toUpperCase());
const POOLS: Record<string, string> = { anyArtisansTool: "Artisan's Tools", anyGamingSet: 'Gaming Sets', anyMusicalInstrument: 'Musical Instruments' };

function name(value: string, kind: string): string {
  if (value.includes('{@')) return value;
  if (POOLS[value]) return `Any ${POOLS[value]}`;
  if (kind === 'Armor') return ({ light: 'Light Armor', medium: 'Medium Armor', heavy: 'Heavy Armor', shield: 'Shields', shields: 'Shields' } as Record<string, string>)[value] ?? title(value);
  if (kind === 'Weapons' && ['simple', 'martial', 'improvised'].includes(value)) return `${title(value)} Weapons`;
  return title(value.split('|')[0]);
}
const filterText = (value: string) => value.split('|').map(part => part.replaceAll('=', ': ')).join(' · ');

/** Arrays describe alternative packages; fixed grants and choices inside one package are cumulative. */
function packages(values: unknown, kind: string): string {
  if (!Array.isArray(values)) return '';
  return values.map(value => {
    const data = object(value);
    if (!data) return typeof value === 'string' ? name(value, kind) : '';
    return Object.entries(data).flatMap(([key, value]) => {
      const choice = object(value);
      if (key === 'choose' && choice) {
        const from = Array.isArray(choice['from']) ? choice['from'].filter((entry): entry is string => typeof entry === 'string').map(entry => name(entry, kind)).join(', ')
          : typeof choice['fromFilter'] === 'string' ? `${kind.toLowerCase()} matching ${filterText(choice['fromFilter'])}` : kind.toLowerCase();
        return [`Choose ${choice['count'] ?? 1}: ${from}`];
      }
      if (key === 'all' && typeof choice?.['fromFilter'] === 'string') return [`All ${kind.toLowerCase()} matching ${filterText(choice['fromFilter'])}`];
      if (value === true) return [name(key, kind)];
      if (typeof value === 'number') return [`Choose ${value}: ${key === 'any' ? `Any ${kind.toLowerCase()}` : POOLS[key] ?? name(key, kind)}`];
      if (typeof value === 'string') return [key === 'entry' ? value : `${name(key, kind)}: ${value}`];
      return [];
    }).join('; ');
  }).filter(Boolean).map((text, _index, entries) => entries.length > 1 ? `(${text})` : text).join(' OR ');
}

function proficiencyRows(fields: Proficiencies | undefined): ClassInfoRow[] {
  if (!fields) return [];
  const rows: ClassInfoRow[] = [];
  const add = (label: string, text: string) => { if (text) rows.push({ label, entries: [text] }); };
  add('Armor', fields.armor?.length ? fields.armor.map(value => typeof value === 'string' ? name(value, 'Armor') : value.full || name(value.proficiency, 'Armor')).join(', ') : packages(fields.armorProficiencies, 'Armor'));
  add('Weapons', fields.weapons?.length ? fields.weapons.map(value => typeof value === 'string' ? name(value, 'Weapons') : `${name(value.proficiency, 'Weapons')}${value.optional ? ' (Optional)' : ''}`).join(', ') : packages(fields.weaponProficiencies, 'Weapons'));
  add('Tools', fields.tools?.length ? fields.tools.join(', ') : packages(fields.toolProficiencies, 'Tools'));
  add('Skills', packages(fields.skills, 'Skills'));
  return rows;
}

function requirementsRows(requirements: Requirements | undefined, special: string | undefined): ClassInfoRow[] {
  const rows: ClassInfoRow[] = [];
  if (requirements) {
    const { or, entries, ...fixed } = requirements;
    const options = (or?.length ? or : [{}]).map(option => {
      const result = { ...fixed };
      for (const [ability, score] of Object.entries(option)) {
        const key = ability as keyof typeof fixed;
        if (typeof score === 'number') result[key] = Math.max(result[key] ?? 0, score);
      }
      return result;
    }).filter(option => Object.keys(option).length);
    const format = (ability: typeof options) => ability.length ? preparePrerequisites([{ ability } as Prerequisite]).detailText : '';
    const fixedText = format(Object.keys(fixed).length ? [fixed] : []);
    const remaining = options.map(option => Object.fromEntries(Object.entries(option).filter(([key, value]) => fixed[key as keyof typeof fixed] !== value)));
    const alternativeText = remaining.some(option => !Object.keys(option).length) ? '' : format(remaining);
    const text = [fixedText, alternativeText && fixedText && remaining.length > 1 ? `(${alternativeText})` : alternativeText].filter(Boolean).join(' AND ');
    const content = [...(text ? [text] : []), ...(entries ?? [])] as SourceEntries;
    if (content.length) rows.push({ label: 'Requirements', entries: content });
  }
  if (special) rows.push({ label: 'Special', entries: [special] });
  return rows;
}

export function classProficiencies(record: ContentRecord, multiclass = false): ClassProficiencyInfo {
  const definition = classDefinition(record);
  const data = record.data as ClassSource;
  if (multiclass) {
    const rules = data.multiclassing;
    return { requirements: requirementsRows(rules?.requirements, rules?.requirementsSpecial),
      proficiencies: proficiencyRows(definition.proficiencies.multiclass), entries: (rules?.entries ?? []) as SourceEntries };
  }
  const proficiencies = proficiencyRows(definition.proficiencies.starting);
  if (definition.savingThrows.length) proficiencies.unshift({ label: 'Saving Throws', entries: [definition.savingThrows.map(spellSaveLabel).join(', ')] });
  if (definition.primaryAbilities.length) proficiencies.unshift({ label: 'Primary Ability', entries: [definition.primaryAbilities.map(option => option.map(spellSaveLabel).join(' AND ')).join(' OR ')] });
  return { requirements: requirementsRows(data.requirements, data.requirementsSpecial), proficiencies, entries: [] };
}
