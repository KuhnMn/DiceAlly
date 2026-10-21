import { comparableWizardValue, wizardFingerprint } from './wizard-fingerprint';
import { createWizardBaseline, readWizardBookkeeping } from './wizard-bookkeeping';
import { ExportedCharacter, FeatureEntryFull, SpellEntryFull } from '../models/character.model';
import { emptyBasicCharacter } from './basic-info';

export type WizardState = NonNullable<ExportedCharacter['creatorWizard']>;
export type WizardClass = WizardState['classes'][number];
export interface PrefillValue { path: string[]; value: unknown; scope: string; label: string; }
export interface PrefillChange { path: string[]; label: string; action: 'Fill' | 'Update' | 'Remove' | 'Keep'; }

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
  return JSON.stringify(comparableWizardValue(left)) === JSON.stringify(comparableWizardValue(right));
}
function collection(sheet: ExportedCharacter, path: string[], create = false): { list: unknown[]; index: number } | undefined {
  const [kind, id, level] = path;
  let list: unknown[] | undefined;
  let index = -1;
  if (kind === 'features' || kind === 'spells') {
    list = sheet[kind]; if (!list && create) list = sheet[kind] = [];
    index = list?.findIndex(entry => (entry as FeatureEntryFull).editorId === id) ?? -1;
  } else if (kind === 'speeds') {
    list = sheet.character?.speeds;
    if (!list && create) list = sheet.character!.speeds = [];
    index = sheet.character?.speeds?.findIndex(entry => entry.id === id) ?? -1;
  } else if (kind === 'sources') {
    list = sheet.character?.featureSources;
    if (!list && create) list = sheet.character!.featureSources = [];
    index = list?.findIndex(entry => (entry as { editorId?: string }).editorId === id) ?? -1;
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
  if (value === undefined) {
    if (group.index >= 0) group.list.splice(group.index, 1);
    // Removing the final generated level must also remove its now-empty source bucket.
    if (path[0] === 'slots' && group.list.length === 0) {
      delete sheet.character!.spellSlots![path[1]];
      if (!Object.keys(sheet.character!.spellSlots!).length) delete sheet.character!.spellSlots;
    }
  }
  else if (group.index < 0) group.list.push(structuredClone(value));
  else group.list[group.index] = structuredClone(value);
}
function collisions(sheet: ExportedCharacter, entry: PrefillValue): { editorId?: string }[] {
  const value = entry.value as FeatureEntryFull & SpellEntryFull;
  if (entry.path[0] === 'features') return (sheet.features ?? []).filter(feature => feature.editorId !== value.editorId
    && feature.name === value.name && feature.source === value.source && feature.featureSourceName === value.featureSourceName
    && (feature.contentReference?.key ?? '') === (value.contentReference?.key ?? ''));
  if (entry.path[0] === 'spells') return (sheet.spells ?? []).filter(spell => spell.editorId !== value.editorId
    && spell.name === value.name && spell.source === value.source && spell.castingSourceName === value.castingSourceName && spell.listType === value.listType);
  if (entry.path[0] === 'sources') return (sheet.character?.featureSources ?? []).filter(source => source.editorId !== (entry.value as { editorId: string }).editorId
    && source.name === (entry.value as { name: string }).name);
  return [];
}
function hasAnnotations(value: unknown): boolean {
  const entry = value as FeatureEntryFull | undefined;
  return !!((value as { used?: number } | undefined)?.used || entry?.notes?.length || entry?.uses?.some(use => (use.usedFreeUses ?? 0) > 0));
}

/** Detached, repeatable prefill. Manual changes and removals become protected values. */
export function mergeWizardPrefill(original: ExportedCharacter, state: WizardState, values: PrefillValue[], overrideSections: readonly string[] = []) {
  const sheet = structuredClone(original);
  const bookkeeping = readWizardBookkeeping(original.creatorWizard ?? {});
  const previous = Object.fromEntries(bookkeeping.baseline.map(entry => [JSON.stringify(entry.path), entry]));
  const baseline = structuredClone(previous);
  const protectedKeys = new Set(bookkeeping.protectedPaths.map(path => JSON.stringify(path)));
  const changes: PrefillChange[] = [];
  const defaults = emptyBasicCharacter();
  const enabled = (scope: string) => scope === 'sources'
    ? state.options['features'] !== false || state.options['spells'] !== false
    : state.options[scope] !== false;
  const desired = new Map(values.filter(entry => enabled(entry.scope)).map(entry => [JSON.stringify(entry.path), entry]));
  for (const [key, entry] of desired) {
    // Shared source definitions are owned by features/spells, never by an unrelated section.
    const overrideManualEdits = overrideSections.includes(entry.scope);
    let current = read(sheet, entry.path);
    const matches = collisions(sheet, entry);
    const replacement = overrideManualEdits && current === undefined && matches.length === 1 ? matches[0] : undefined;
    if (replacement) current = replacement;
    const old = previous[key];
    // Compare definition-only fingerprints here; notes and trackers are preserved separately.
    const excludesAnnotations = ['features', 'spells', 'species'].includes(entry.path[0]);
    const manuallyChanged = old ? wizardFingerprint(current, excludesAnnotations) !== (old.editFingerprint ?? old.fingerprint)
      : current !== undefined && !same(current, read(defaults, entry.path));
    if ((!overrideManualEdits && (protectedKeys.has(key) || manuallyChanged || matches.length > 0))
      || matches.length > (replacement ? 1 : 0)) {
      protectedKeys.add(key); changes.push({ path: entry.path, label: entry.label, action: 'Keep' });
    } else {
      protectedKeys.delete(key);
      let proposed = structuredClone(entry.value);
      if (current && typeof current === 'object' && proposed && typeof proposed === 'object') {
        const next = proposed as MutableObject; const existing = current as MutableObject;
        for (const counter of ['used', 'usedFreeUses', 'overrideFeet']) if (existing[counter] !== undefined) next[counter] = existing[counter];
        if (['features', 'spells', 'species'].includes(entry.path[0])) {
          next['notes'] = structuredClone(existing['notes'] ?? []);
          if (Array.isArray(existing['uses']) && existing['uses'].length) next['uses'] = structuredClone(existing['uses']);
        }
      }
      if (replacement) {
        const list = collection(sheet, entry.path)!.list;
        list.splice(list.indexOf(replacement), 1);
        // Combat bookmarks must continue to resolve after adopting the wizard identity.
        for (const action of sheet.combatActions ?? []) if (replacement.editorId && action.linkedResource?.editorId === replacement.editorId) {
          action.linkedResource.editorId = entry.path[1];
        }
      }
      if (!same(current, proposed)) changes.push({ path: entry.path, label: entry.label, action: current === undefined ? 'Fill' : 'Update' });
      write(sheet, entry.path, proposed);
    }
    baseline[key] = createWizardBaseline({ path: [...entry.path], value: entry.value, scope: entry.scope, label: entry.label });
  }
  // Remove untouched obsolete entries first; retain annotated entries and their sources.
  const obsolete = Object.entries(previous).filter(([key, entry]) => !desired.has(key) && enabled(entry.scope))
    .sort(([a], [b]) => Number(JSON.parse(a)[0] === 'sources') - Number(JSON.parse(b)[0] === 'sources'));
  for (const [key, entry] of obsolete) {
    const overrideManualEdits = overrideSections.includes(entry.scope);
    const path = JSON.parse(key) as string[]; const current = read(sheet, path);
    const source = current as { name?: string } | undefined;
    const stillLinked = path[0] === 'sources' && source?.name && (sheet.features?.some(feature => feature.featureSourceName === source.name)
      || sheet.spells?.some(spell => spell.castingSourceName === source.name) || sheet.character?.spellSlots?.[source.name]?.length);
    if (current !== undefined && (hasAnnotations(current) || stillLinked
      || !overrideManualEdits && (protectedKeys.has(key) || wizardFingerprint(current) !== entry.fingerprint))) {
      protectedKeys.add(key); changes.push({ path, label: entry.label, action: 'Keep' });
    } else {
      if (current !== undefined) changes.push({ path, label: entry.label, action: 'Remove' });
      // Required basic values (such as Walk speed) return to their editor defaults.
      write(sheet, path, read(defaults, path)); delete baseline[key]; protectedKeys.delete(key);
    }
  }
  sheet.creatorWizard = { ...structuredClone(state), baseline: Object.values(baseline),
    protectedPaths: [...protectedKeys].map(key => JSON.parse(key) as string[]) };
  return { sheet, changes };
}
