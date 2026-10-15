import { entityKey, object } from '../content/content.model';
import { ContentClassSelection, ContentRulesIndex } from './feature-rules';
import { ProficiencyContribution, SKILL_ABILITIES } from './derived-stats';
export interface ProficiencyChoice { id: string; count: number; candidates: string[]; kind: ProficiencyContribution['kind']; ownerKey: string }
export interface ProficiencyPackageChoice { id: string; kind: ProficiencyContribution['kind']; ownerKey: string; options: { value: string; data: Record<string,unknown> }[] }
export type ProficiencyCatalogs = Partial<Record<ProficiencyContribution['kind'],Record<string,readonly string[]>>>;
/** Generate an origin-tagged proficiency ledger; manual entries remain separate from generated grants. */
export function deriveProficiencyGrants(selections: ContentClassSelection[],index: ContentRulesIndex,
  answers: Readonly<Record<string,readonly string[]>> = {},speciesKey?: string,manual: ProficiencyContribution[] = [],catalogs: ProficiencyCatalogs = {}) {
  const generated: ProficiencyContribution[] = []; const choices: ProficiencyChoice[] = []; const packages: ProficiencyPackageChoice[] = []; const diagnostics: string[] = [];
  const ids = new Set<string>();
  const ownerKeys = new Map<string, string>();
  // Structured tool choices refer to the installed playable tools, not description text.
  const tools = [...index.records.values()].filter(record => record.kind === 'item'
    && record.derivation?.operation !== 'item-group' && !Array.isArray(record.data['items']));
  const toolKeys = (type?: string) => tools.filter(record =>
    type ? String(record.data['type'] ?? '').split('|')[0] === type
      : ['T', 'AT', 'GS', 'INS'].includes(String(record.data['type'] ?? '').split('|')[0])).map(record => record.key);
  const toolCatalog: Record<string, string[]> = { any: toolKeys(), anyTool: toolKeys(),
    anyArtisansTool: toolKeys('AT'), anyGamingSet: toolKeys('GS'), anyMusicalInstrument: toolKeys('INS') };
  const add = (kind: ProficiencyContribution['kind'],target: string,origin: string,rank: 0.5 | 1 | 2 = 1) => {
    if (!target) { diagnostics.push('Empty proficiency target.'); return; }
    if (!generated.some(c => c.kind === kind && c.target === target && c.origin === origin && c.rank === rank)) generated.push({ kind,target,origin,rank });
  };
  const choice = (from: unknown,count: unknown,kind: ProficiencyContribution['kind'],origin: string,path: string) => {
    if (!Array.isArray(from) || from.some(v => typeof v !== 'string' || !v) || !Number.isSafeInteger(count) || Number(count) < 1) {
      diagnostics.push(`Proficiency choice handler required: ${path}`); return;
    }
    if ((kind === 'skill' && from.some(v => !Object.hasOwn(SKILL_ABILITIES,v)))
      || (kind === 'save' && from.some(v => !['str','dex','con','int','wis','cha'].includes(v)))) {
      diagnostics.push(`Unsupported proficiency candidate: ${path}`); return;
    }
    const already = new Set(generated.filter(c => c.kind === kind && c.origin === origin).map(c => c.target));
    const candidates = [...new Set(from)].filter(target => !already.has(target)) as string[];
    if (Number(count) > candidates.length) { diagnostics.push(`Insufficient proficiency candidates: ${path}`); return; }
    const id = JSON.stringify(['proficiency-choice',origin,path]); choices.push({ id,count: Number(count),candidates,kind,ownerKey: ownerKeys.get(origin)! });
    const answer = Object.hasOwn(answers,id) ? answers[id] : [];
    if (!Array.isArray(answer) || answer.length !== count || new Set(answer).size !== count || answer.some(v => !candidates.includes(v))) {
      diagnostics.push(`Select ${count} valid proficiencies: ${path}`); return;
    }
    answer.forEach(v => add(kind,v,origin));
  };
  const parse = (value: unknown,kind: ProficiencyContribution['kind'],origin: string,path: string): void => {
    if (value === undefined || value === null) return;
    if (typeof value === 'string') {
      const tag = /^\{@item ([^{}]+)\}$/.exec(value.trim());
      if (tag) {
        const [name,source] = tag[1].split('|'); const baseKey = entityKey('baseitem',{ name,source: source || 'DMG' }); const itemKey = entityKey('item',{ name,source: source || 'DMG' });
        const record = index.records.get(baseKey) ?? index.records.get(itemKey);
        if (!record || record.kind === 'itemGroup') { diagnostics.push(`Missing exact proficiency item: ${value}`); return; }
        add(kind,record.key,origin); return;
      }
      if (kind === 'tool' && /choose|choice|any|\{@/i.test(value)) { diagnostics.push(`Descriptive tool choice requires a handler: ${value}`); return; }
      add(kind,value,origin); return;
    }
    if (Array.isArray(value)) {
      if (value.length > 1 && value.every(v => object(v)) && ['skill','language','tool'].includes(kind)) {
        // Object packages are alternatives. Choosing one must never grant the union of all packages.
        const id = JSON.stringify(['proficiency-package',origin,path]);
        const options = value.map((data,i) => ({ value: String(i),data: structuredClone(object(data)!) }));
        packages.push({ id,kind,options,ownerKey: ownerKeys.get(origin)! });
        const answer = Object.hasOwn(answers,id) ? answers[id] : [];
        if (!Array.isArray(answer) || answer.length !== 1 || !options.some(option => option.value === answer[0])) {
          diagnostics.push(`Select one proficiency package: ${path}`); return;
        }
        const selected = Number(answer[0]);
        // Include the package index so a different package cannot reuse its nested answers.
        parse(value[selected],kind,origin,`${path}[${selected}]`); return;
      }
      value.forEach((v,i) => parse(v,kind,origin,`${path}[${i}]`)); return;
    }
    const data = object(value);
    if (!data) { diagnostics.push(`Unsupported proficiency structure: ${path}`); return; }
    // Fixed grants are collected first so choice order cannot allow selecting the same grant twice.
    const entries = Object.entries(data).sort(([a],[b]) => Number(a === 'choose' || /^any/i.test(a) || (kind === 'language' && a === 'other')) - Number(b === 'choose' || /^any/i.test(b) || (kind === 'language' && b === 'other')));
    for (const [field,entry] of entries) {
      if (field === 'choose') {
        const choose = object(entry); const from = choose?.['from']; const count = choose?.['count'] ?? 1;
        if (!choose || Object.keys(choose).some(k => !['from','count'].includes(k)) || !Array.isArray(from) || from.some(v => typeof v !== 'string' || !v)
          || !Number.isInteger(count) || Number(count) < 1 || Number(count) > new Set(from).size) {
          diagnostics.push(`Proficiency choice handler required: ${path}`); continue;
        }
        choice(from,count,kind,origin,path);
      } else if (/^any/i.test(field) || (kind === 'language' && field === 'other')) {
        const builtin = kind === 'skill' && ['any','anySkill'].includes(field) ? Object.keys(SKILL_ABILITIES)
          : kind === 'tool' ? toolCatalog[field] : undefined;
        const catalog = catalogs[kind];
        const from = catalog && Object.hasOwn(catalog,field) ? catalog[field] : builtin;
        choice(from,entry === true ? 1 : entry,kind,origin,`${path}.${field}`);
      }
      else if (entry === true || entry === 1 || entry === 2 || entry === 0.5) add(kind,field,origin,entry === true ? 1 : entry);
      else diagnostics.push(`Unsupported proficiency field: ${path}.${field}`);
    }
  };
  for (const [position,selection] of selections.entries()) {
    const record = index.records.get(selection.classKey);
    if (!selection.selectionId || ids.has(selection.selectionId) || !record || record.kind !== 'class'
      || !Number.isInteger(selection.level) || selection.level < 1 || selection.level > 20) { diagnostics.push('Invalid proficiency class selection.'); continue; }
    ids.add(selection.selectionId);
    const origin = JSON.stringify(['class-proficiency',index.sourceIdentity,selection.selectionId,record.key]);
    ownerKeys.set(origin, record.key);
    if (position === 0) parse(record.data['proficiency'],'save',origin,'proficiency');
    const fields = position === 0 ? object(record.data['startingProficiencies']) : object(object(record.data['multiclassing'])?.['proficienciesGained']);
    for (const [field,kind] of [['armor','armor'],['weapons','weapon'],['tools','tool'],['skills','skill']] as const) {
      const structuredTools = fields?.['toolProficiencies'];
      const hasToolChoice = Array.isArray(structuredTools) && structuredTools.some(entry =>
        Object.keys(object(entry) ?? {}).some(key => key === 'choose' || /^any/i.test(key)));
      // Prefer machine-readable instrument/artisan choices over "choose one instrument" prose.
      parse(kind === 'tool' && hasToolChoice ? structuredTools : fields?.[field],kind,origin,
        `${position === 0 ? 'starting' : 'multiclass'}.${field}`);
    }
  }
  if (speciesKey) {
    const species = index.records.get(speciesKey);
    if (!species || species.kind !== 'species') diagnostics.push('Missing materialized species proficiency source.');
    else for (const [field,kind] of [['skillProficiencies','skill'],['languageProficiencies','language'],['toolProficiencies','tool'],['armorProficiencies','armor'],['weaponProficiencies','weapon']] as const) {
      const origin = JSON.stringify(['species-proficiency',index.sourceIdentity,speciesKey]);
      ownerKeys.set(origin, speciesKey);
      parse(species.data[field],kind,origin,field);
    }
  }
  return { canAccept: diagnostics.length === 0,diagnostics,choices,packages,manual: structuredClone(manual),generated,
    contributions: [...structuredClone(manual),...generated] };
}
