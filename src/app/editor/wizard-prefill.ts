import { ContentRecord, ImportRevision } from '../content/content.model';
import { ExportedCharacter, FeatureEntryFull, SpellEntryFull } from '../models/character.model';
import { emptyBasicCharacter } from './basic-info';

export type WizardState = NonNullable<ExportedCharacter['creatorWizard']>;
export type WizardClass = WizardState['classes'][number];
export interface PrefillValue { path: string[]; value: unknown; scope: string; label: string; }
export interface PrefillChange { label: string; action: 'Fill' | 'Update' | 'Remove' | 'Keep'; }

export function contentReference(record: ContentRecord, revision: ImportRevision) {
  return { key: record.key, sourceIdentity: revision.sourceIdentity, revisionId: revision.id, commit: revision.commit };
}

type MutableObject = Record<string, unknown>;
function objectAt(sheet: ExportedCharacter, path: string[], create = false): MutableObject | undefined {
  let current = sheet as unknown as MutableObject;
  for (const field of path) {
    if (current[field] == null) { if (!create) return; current[field] = {}; }
    if (typeof current[field] !== 'object' || Array.isArray(current[field])) return;
    current = current[field] as MutableObject;
  }
  return current;
}
function same(left: unknown, right: unknown): boolean {
  const comparable = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(comparable);
    if (!value || typeof value !== 'object') return value;
    return Object.fromEntries(Object.entries(value).filter(([key]) => key !== 'used' && key !== 'usedFreeUses')
      .sort(([a], [b]) => a.localeCompare(b)).map(([key, entry]) => [key, comparable(entry)]));
  };
  return JSON.stringify(comparable(left)) === JSON.stringify(comparable(right));
}
function collection(sheet: ExportedCharacter, path: string[], create = false): { list: unknown[]; index: number } | undefined {
  const [kind, id, level] = path;
  let list: unknown[] | undefined;
  let index = -1;
  if (kind === 'features' || kind === 'spells') {
    list = sheet[kind]; if (!list && create) list = sheet[kind] = [];
    index = list?.findIndex(entry => (entry as FeatureEntryFull).editorId === id) ?? -1;
  } else if (kind === 'sources') {
    list = sheet.character?.featureSources;
    if (!list && create) list = sheet.character!.featureSources = [];
    index = list?.findIndex(entry => (entry as { id?: string }).id === id) ?? -1;
  } else if (kind === 'dice') {
    list = Array.isArray(sheet.character?.hitDice) ? sheet.character.hitDice : undefined;
    if (!list && create) list = sheet.character!.hitDice = [];
    index = list?.findIndex(entry => (entry as { dieType?: string }).dieType === id) ?? -1;
  } else if (kind === 'slots') {
    if (create) sheet.character!.spellSlots ??= {};
    list = sheet.character?.spellSlots?.[id];
    if (!list && create) list = sheet.character!.spellSlots![id] = [];
    index = list?.findIndex(entry => (entry as { level?: number }).level === Number(level)) ?? -1;
  } else if (kind === 'saves' || kind === 'languages' || kind === 'custom') {
    if (create) sheet.character!.proficiencies ??= {};
    const field = kind === 'saves' ? 'savingThrows' : kind;
    list = sheet.character?.proficiencies?.[field];
    if (!list && create) list = sheet.character!.proficiencies![field] = [];
    index = list?.indexOf(id) ?? -1;
  } else if (kind === 'resistances') {
    list = sheet.character?.resistances;
    if (!list && create) list = sheet.character!.resistances = [];
    index = list?.indexOf(id) ?? -1;
  }
  return list ? { list, index } : undefined;
}
function read(sheet: ExportedCharacter, path: string[]): unknown {
  if (path[0] !== 'character' && path[0] !== 'species') {
    const group = collection(sheet, path);
    if (!group || group.index < 0) return;
    return group.list[group.index];
  }
  return objectAt(sheet, path.slice(0, -1))?.[path.at(-1)!];
}
function write(sheet: ExportedCharacter, path: string[], value: unknown) {
  if (path[0] === 'character' || path[0] === 'species') {
    const parent = objectAt(sheet, path.slice(0, -1), value !== undefined);
    if (parent) { if (value === undefined) delete parent[path.at(-1)!]; else parent[path.at(-1)!] = structuredClone(value); }
    return;
  }
  const group = collection(sheet, path, value !== undefined);
  if (!group) return;
  if (value === undefined) { if (group.index >= 0) group.list.splice(group.index, 1); }
  else if (group.index < 0) group.list.push(structuredClone(value));
  else group.list[group.index] = structuredClone(value);
}
function collision(sheet: ExportedCharacter, entry: PrefillValue): boolean {
  const value = entry.value as FeatureEntryFull & SpellEntryFull;
  if (entry.path[0] === 'features') return (sheet.features ?? []).some(feature => feature.editorId !== value.editorId
    && feature.name === value.name && feature.source === value.source && feature.featureSourceName === value.featureSourceName
    && (feature.contentReference?.key ?? '') === (value.contentReference?.key ?? ''));
  if (entry.path[0] === 'spells') return (sheet.spells ?? []).some(spell => spell.editorId !== value.editorId
    && spell.name === value.name && spell.source === value.source && spell.castingSourceName === value.castingSourceName && spell.listType === value.listType);
  if (entry.path[0] === 'sources') return (sheet.character?.featureSources ?? []).some(source => source.id !== (entry.value as { id: string }).id
    && source.name === (entry.value as { name: string }).name);
  return false;
}
function hasAnnotations(value: unknown): boolean {
  const entry = value as FeatureEntryFull | undefined;
  return !!((value as { used?: number } | undefined)?.used || entry?.notes?.length || entry?.uses?.some(use => (use.usedFreeUses ?? 0) > 0));
}

/** Detached, repeatable prefill. Manual changes and removals become protected values. */
export function mergeWizardPrefill(original: ExportedCharacter, state: WizardState, values: PrefillValue[]) {
  const sheet = structuredClone(original);
  const previous = original.creatorWizard?.baseline ?? {};
  const baseline = structuredClone(previous);
  const protectedKeys = new Set(original.creatorWizard?.protectedKeys ?? []);
  const changes: PrefillChange[] = [];
  const defaults = emptyBasicCharacter();
  const enabled = (scope: string) => scope === 'sources'
    ? state.options['features'] !== false || state.options['spells'] !== false
    : state.options[scope] !== false;
  const desired = new Map(values.filter(entry => enabled(entry.scope)).map(entry => [JSON.stringify(entry.path), entry]));
  for (const [key, entry] of desired) {
    const current = read(sheet, entry.path);
    const old = previous[key];
    // Notes are independent of generated feature descriptions; usage counters are session state.
    const compare = (value: unknown) => {
      if (!value || !['features', 'spells', 'species'].includes(entry.path[0])) return value;
      const copy = { ...value as MutableObject }; delete copy['notes']; delete copy['uses']; return copy;
    };
    const manuallyChanged = old ? !same(compare(current), compare(old.value))
      : current !== undefined && !same(current, read(defaults, entry.path));
    if (protectedKeys.has(key) || manuallyChanged || collision(sheet, entry)) {
      protectedKeys.add(key); changes.push({ label: entry.label, action: 'Keep' });
    } else {
      let proposed = structuredClone(entry.value);
      if (current && typeof current === 'object' && proposed && typeof proposed === 'object') {
        const next = proposed as MutableObject; const existing = current as MutableObject;
        for (const counter of ['used', 'usedFreeUses']) if (existing[counter] !== undefined) next[counter] = existing[counter];
        if (['features', 'spells', 'species'].includes(entry.path[0])) {
          next['notes'] = structuredClone(existing['notes'] ?? []);
          if (Array.isArray(existing['uses']) && existing['uses'].length) next['uses'] = structuredClone(existing['uses']);
        }
      }
      if (!same(current, proposed)) changes.push({ label: entry.label, action: current === undefined ? 'Fill' : 'Update' });
      write(sheet, entry.path, proposed);
    }
    baseline[key] = { value: structuredClone(entry.value), scope: entry.scope, label: entry.label };
  }
  // Remove untouched obsolete entries first; retain annotated entries and their sources.
  const obsolete = Object.entries(previous).filter(([key, entry]) => !desired.has(key) && enabled(entry.scope))
    .sort(([a], [b]) => Number(JSON.parse(a)[0] === 'sources') - Number(JSON.parse(b)[0] === 'sources'));
  for (const [key, entry] of obsolete) {
    const path = JSON.parse(key) as string[]; const current = read(sheet, path);
    const source = current as { name?: string } | undefined;
    const stillLinked = path[0] === 'sources' && source?.name && (sheet.features?.some(feature => feature.featureSourceName === source.name)
      || sheet.spells?.some(spell => spell.castingSourceName === source.name) || sheet.character?.spellSlots?.[source.name]?.length);
    if (current !== undefined && (protectedKeys.has(key) || !same(current, entry.value) || hasAnnotations(current) || stillLinked)) {
      protectedKeys.add(key); changes.push({ label: entry.label, action: 'Keep' });
    } else {
      if (current !== undefined) changes.push({ label: entry.label, action: 'Remove' });
      // Required basic values (such as Walk speed) return to their editor defaults.
      write(sheet, path, read(defaults, path)); delete baseline[key];
    }
  }
  sheet.creatorWizard = { ...structuredClone(state), baseline, protectedKeys: [...protectedKeys] };
  return { sheet, changes };
}
