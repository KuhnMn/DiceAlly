import { sourceProficiencyGrants, ProficiencyPackages, ProficiencyPackage, ExplicitProficiencyChoice } from '../content/proficiency-grants';
import { itemTypeCode } from '../content/item.model';
import { characterOption } from '../content/character-option-adapter';
import { classDefinition } from '../content/class-adapter';
import { entityKey } from '../content/content.model';
import { ContentClassSelection, ContentRulesIndex } from './feature-rules';
import { ProficiencyContribution, SKILL_ABILITIES } from './derived-stats';
export interface ProficiencyChoice { id: string; count: number; candidates: string[]; kind: ProficiencyContribution['kind']; ownerKey: string }
export interface ProficiencyPackageChoice { id: string; kind: ProficiencyContribution['kind']; ownerKey: string; options: { value: string; data: Record<string, unknown> }[] }
export type ProficiencyCatalogs = Partial<Record<ProficiencyContribution['kind'], Record<string, readonly string[]>>>;
/** Generate an origin-tagged proficiency ledger; manual entries remain separate from generated grants. */
export function deriveProficiencyGrants(selections: ContentClassSelection[], index: ContentRulesIndex,
  answers: Readonly<Record<string, readonly string[]>> = {}, speciesKey?: string, manual: ProficiencyContribution[] = [], catalogs: ProficiencyCatalogs = {}, sourceBooks: readonly string[] = [], backgroundKey?: string) {
  const generated: ProficiencyContribution[] = []; const choices: ProficiencyChoice[] = []; const packages: ProficiencyPackageChoice[] = []; const diagnostics: string[] = [];
  const ids = new Set<string>();
  const ownerKeys = new Map<string, string>();
  // Structured tool choices refer to the installed playable tools, not description text.
  const tools = [...index.records.values()].filter(record => record.kind === 'item'
    && record.derivation?.operation !== 'item-group');
  const toolKeys = (type?: string) => tools.filter(record =>
    type ? itemTypeCode(record) === type
      : ['T', 'AT', 'GS', 'INS'].includes(itemTypeCode(record))).map(record => record.key);
  const toolCatalog: Record<string, string[]> = {
    any: toolKeys(),
    anyArtisansTool: toolKeys('AT'), anyGamingSet: toolKeys('GS'), anyMusicalInstrument: toolKeys('INS')
  };
  const add = (kind: ProficiencyContribution['kind'], target: string, origin: string, rank: 0.5 | 1 | 2 = 1) => {
    if (!target) { diagnostics.push('Empty proficiency target.'); return; }
    if (!generated.some(c => c.kind === kind && c.target === target && c.origin === origin && c.rank === rank)) generated.push({ kind, target, origin, rank });
  };
  const choice = (from: unknown, count: unknown, kind: ProficiencyContribution['kind'], origin: string, path: string) => {
    if (!Array.isArray(from) || from.some(v => typeof v !== 'string' || !v) || !Number.isSafeInteger(count) || Number(count) < 1) {
      diagnostics.push(`Proficiency choice handler required: ${path}`); return;
    }
    if ((kind === 'skill' && from.some(v => !Object.hasOwn(SKILL_ABILITIES, v)))
      || (kind === 'save' && from.some(v => !['str', 'dex', 'con', 'int', 'wis', 'cha'].includes(v)))) {
      diagnostics.push(`Unsupported proficiency candidate: ${path}`); return;
    }
    const already = new Set(generated.filter(c => c.kind === kind && c.origin === origin).map(c => c.target));
    const candidates = [...new Set(from)].filter(target => !already.has(target)
      && (kind !== 'tool' || !sourceBooks.length || !index.records.has(target)
        || sourceBooks.includes(index.records.get(target)!.publication))) as string[];
    if (Number(count) > candidates.length) { diagnostics.push(`Insufficient proficiency candidates: ${path}`); }
    const id = JSON.stringify(['proficiency-choice', origin, path]); choices.push({ id, count: Number(count), candidates, kind, ownerKey: ownerKeys.get(origin)! });
    const answer = Object.hasOwn(answers, id) ? answers[id] : [];
    if (!Array.isArray(answer) || answer.length !== count || new Set(answer).size !== count || answer.some(v => !candidates.includes(v))) {
      diagnostics.push(`Select ${count} valid proficiencies: ${path}`); return;
    }
    answer.forEach(v => add(kind, v, origin));
  };
  const parseName = (value: string, kind: ProficiencyContribution['kind'], origin: string): void => {
    const tag = /^\{@item ([^{}]+)\}$/.exec(value.trim());
    if (tag) {
      const [name, source] = tag[1].split('|');
      const baseKey = entityKey('baseitem', { name, source: source || 'DMG' });
      const itemKey = entityKey('item', { name, source: source || 'DMG' });
      const record = index.records.get(baseKey) ?? index.records.get(itemKey);
      if (!record || record.kind === 'itemGroup') { diagnostics.push(`Missing exact proficiency item: ${value}`); return; }
      add(kind, record.key, origin); return;
    }
    if (kind === 'tool' && /choose|choice|any|\{@/i.test(value)) { diagnostics.push(`Descriptive tool choice requires a handler: ${value}`); return; }
    add(kind, value, origin);
  };
  const poolFields = new Set(['any', 'anyStandard', 'anyExotic', 'anyRare', 'anyArtisansTool', 'anyGamingSet', 'anyMusicalInstrument']);
  const isPool = (field: string, kind: ProficiencyContribution['kind']) => poolFields.has(field) || (kind === 'language' && field === 'other');
  const parsePackage = (data: ProficiencyPackage, kind: ProficiencyContribution['kind'], origin: string, path: string): void => {
    // Fixed grants precede choices, independently of source property order.
    const entries = Object.entries(data).sort(([a], [b]) => Number(a === 'choose' || isPool(a, kind)) - Number(b === 'choose' || isPool(b, kind)));
    for (const [field, entry] of entries) {
      if (field === 'choose') {
        const selection = entry as ExplicitProficiencyChoice | { fromFilter: string; count?: number };
        if (!('from' in selection)) { diagnostics.push(`Proficiency choice handler required: ${path}`); continue; }
        choice(selection.from, selection.count ?? 1, kind, origin, path);
      } else if (isPool(field, kind)) {
        const builtin = kind === 'skill' && field === 'any' ? Object.keys(SKILL_ABILITIES)
          : kind === 'tool' ? toolCatalog[field] : undefined;
        const catalog = catalogs[kind];
        const from = catalog && Object.hasOwn(catalog, field) ? catalog[field] : builtin;
        choice(from, entry === true ? 1 : entry, kind, origin, `${path}.${field}`);
      } else if (entry === true) add(kind, field, origin);
      else diagnostics.push(`Unsupported proficiency field: ${path}.${field}`);
    }
  };
  const parsePackages = (value: ProficiencyPackages | undefined, kind: ProficiencyContribution['kind'], origin: string, path: string): void => {
    if (value === undefined) return;
    if (value.length > 1 && ['skill', 'language', 'tool'].includes(kind)) {
      const id = JSON.stringify(['proficiency-package', origin, path]);
      const options = value.map((data, i) => ({ value: String(i), data: structuredClone(data) }));
      packages.push({ id, kind, options, ownerKey: ownerKeys.get(origin)! });
      const answer = Object.hasOwn(answers, id) ? answers[id] : [];
      if (!Array.isArray(answer) || answer.length !== 1 || !options.some(option => option.value === answer[0])) {
        diagnostics.push(`Select one proficiency package: ${path}`); return;
      }
      const selected = Number(answer[0]);
      parsePackage(value[selected], kind, origin, `${path}[${selected}]`); return;
    }
    value.forEach((data, i) => parsePackage(data, kind, origin, `${path}[${i}]`));
  };
  for (const [position, selection] of selections.entries()) {
    const record = index.records.get(selection.classKey);
    if (!selection.selectionId || ids.has(selection.selectionId) || !record || record.kind !== 'class'
      || !Number.isInteger(selection.level) || selection.level < 1 || selection.level > 20) { diagnostics.push('Invalid proficiency class selection.'); continue; }
    ids.add(selection.selectionId);
    const origin = JSON.stringify(['class-proficiency', index.sourceIdentity, selection.selectionId, record.key]);
    ownerKeys.set(origin, record.key);
    try {
      const definition = classDefinition(record);
      if (position === 0) definition.savingThrows.forEach(value => parseName(value, 'save', origin));
      const fields = position === 0 ? definition.proficiencies.starting : definition.proficiencies.multiclass;
      for (const [field, kind] of [['armor', 'armor'], ['weapons', 'weapon'], ['tools', 'tool'], ['skills', 'skill']] as const) {
        const path = `${position === 0 ? 'starting' : 'multiclass'}.${field}`;
        if (!fields) continue;
        // The schema distinguishes display wrappers from structured proficiency grants.
        if (field === 'armor') {
          if (fields.armorProficiencies !== undefined) parsePackages(fields.armorProficiencies, kind, origin, path);
          else for (const value of fields.armor ?? []) parseName(typeof value === 'string' ? value : value.proficiency, kind, origin);
        } else if (field === 'weapons') {
          if (fields.weaponProficiencies !== undefined) parsePackages(fields.weaponProficiencies, kind, origin, path);
          else for (const value of fields.weapons ?? []) {
            if (typeof value !== 'string' && value.optional) diagnostics.push(`Optional weapon proficiency requires a handler: ${path}`);
            else parseName(typeof value === 'string' ? value : value.proficiency, kind, origin);
          }
        } else if (field === 'tools') {
          if (fields.toolProficiencies !== undefined) parsePackages(fields.toolProficiencies, kind, origin, path);
          else fields.tools?.forEach(value => parseName(value, kind, origin));
        } else parsePackages(fields.skills, kind, origin, path);
      }
    } catch (error) { diagnostics.push(String(error)); }
  }
  if (speciesKey) {
    const species = index.records.get(speciesKey);
    if (!species || species.kind !== 'species') diagnostics.push('Missing materialized species proficiency source.');
    else {
      const origin = JSON.stringify(['species-proficiency', index.sourceIdentity, speciesKey]);
      ownerKeys.set(origin, speciesKey);
      try {
        const grants = sourceProficiencyGrants(species);
        parsePackages(grants.skills, 'skill', origin, 'skillProficiencies');
        parsePackages(grants.languages, 'language', origin, 'languageProficiencies');
        parsePackages(grants.tools, 'tool', origin, 'toolProficiencies');
        parsePackages(grants.armor, 'armor', origin, 'armorProficiencies');
        parsePackages(grants.weapons, 'weapon', origin, 'weaponProficiencies');
      } catch (error) { diagnostics.push(String(error)); }
    }
  }

  if (backgroundKey) {
    const background = index.records.get(backgroundKey);
    if (!background || background.kind !== 'background') diagnostics.push('Missing background proficiency source.');
    else {
      const origin = JSON.stringify(['background-proficiency', index.sourceIdentity, backgroundKey]);
      ownerKeys.set(origin, backgroundKey);
      try {
        const grants = characterOption(background).proficiencies;
        parsePackages(grants.skills, 'skill', origin, 'skillProficiencies');
        parsePackages(grants.languages, 'language', origin, 'languageProficiencies');
        parsePackages(grants.tools, 'tool', origin, 'toolProficiencies');
        parsePackages(grants.armor, 'armor', origin, 'armorProficiencies');
        parsePackages(grants.weapons, 'weapon', origin, 'weaponProficiencies');
      } catch (error) { diagnostics.push(String(error)); }
    }
  }
  return {
    canAccept: diagnostics.length === 0, diagnostics, choices, packages, owners: ownerKeys, manual: structuredClone(manual), generated,
    contributions: [...structuredClone(manual), ...generated]
  };
}
