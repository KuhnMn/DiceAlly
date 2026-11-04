import { classResourceTables, resourceCell } from '../compendium/class-resources';
import { ContentRecord } from '../content/content.model';
import { SourceEntry } from '../content/content-entries';
import { ExportedCharacter, FeatureSource } from '../models/character.model';
import { resourcePlacement, SourceResource } from '../models/source-resources';
import { wizardEditorId } from './editor-identity';
import type { PrefillValue, WizardState } from './wizard-prefill';

export interface WizardResourceColumn {
  id: string; sourceId: string; owner: string; table: string; name: string;
  kind: 'counter' | 'note'; value: number | string;
}
export type ResourceImportSetting = NonNullable<WizardState['resourceImports']>[string];

/** Only explicit spell-count headings describe capacity rather than spendable uses. */
function spellCountColumn(name: string): boolean {
  return /^(?:cantrips(?: known)?|spells known|known spells|prepared spells|spells prepared|spells learned at this level)$/i.test(name.trim());
}

/** A complete numeric dice tag is explicit content; surrounding prose and formulas are not. */
function literalCell(raw: SourceEntry | undefined): number | string | undefined {
  if (typeof raw === 'number') return Number.isSafeInteger(raw) && raw >= 0 ? raw : undefined;
  if (raw && typeof raw === 'object' && raw.type === 'dice') {
    const text = resourceCell(raw);
    return typeof text === 'string' && text !== '—' ? text : undefined;
  }
  if (typeof raw === 'string') return /^\{@dice\s+((?:\d+)?d\d+(?:\s*[+-]\s*(?:(?:\d+)?d\d+|\d+))*)(?:\|[^{}]*)?\}$/i.exec(raw.trim())?.[1];
  return;
}

export function wizardResourceColumns(parent: ContentRecord, subclass: ContentRecord | null,
  identity: string, selectionId: string, level: number, parentId: string, subclassId: string): WizardResourceColumn[] {
  return classResourceTables(parent, subclass)
    // These tables have explicit schema provenance, unlike free-form source table columns.
    .filter(table => !table.spellSlots && !table.id.endsWith(':fixed') && !table.id.includes(':optional:'))
    .flatMap(table => (table.rows[level - 1] ?? []).flatMap((raw, column) => {
      const value = literalCell(raw);
      const name = table.labels[column]?.replace(/\{@\w+ ([^{}]*)\}/g, (_tag, body: string) => body.split('|')[0]);
      if (value === undefined || !name) return [];
      return [{ id: wizardEditorId('resource', identity, selectionId, table.id, String(column)),
        sourceId: table.subclass ? subclassId : parentId, owner: table.owner, table: table.title,
        name, kind: typeof value === 'number' && !spellCountColumn(name) ? 'counter' as const : 'note' as const, value }];
    }));
}

export function resourceImportSetting(sheet: ExportedCharacter, state: WizardState, column: WizardResourceColumn): ResourceImportSetting {
  const existing = sheet.resources?.find(resource => resource.id === column.id);
  return { enabled: !!existing && !!sheet.creatorWizard?.baseline.some(entry => entry.path[0] === 'resources' && entry.path[1] === column.id),
    ...(existing ? { name: existing.name, recovery: existing.recovery } : {}), ...state.resourceImports?.[column.id] };
}

/** Seed once per column when opening the wizard; later rebuilds must retain its drafts. */
export function seedResourceImports(sheet: ExportedCharacter, state: WizardState, columns: WizardResourceColumn[]): void {
  for (const column of columns) {
    const existing = sheet.resources?.find(resource => resource.id === column.id);
    if (existing) (state.resourceImports ??= {})[column.id] = {
      ...resourceImportSetting(sheet, state, column), name: existing.name, recovery: existing.recovery,
    };
  }
}

function reminderColumn(sheet: ExportedCharacter, state: WizardState, column: WizardResourceColumn, columns: WizardResourceColumn[]) {
  return column.kind === 'counter' ? columns.find(candidate => candidate.id === resourceImportSetting(sheet, state, column).reminderId
    && candidate.kind === 'note' && candidate.sourceId === column.sourceId) : undefined;
}

export function resourceImportName(sheet: ExportedCharacter, state: WizardState, column: WizardResourceColumn, columns: WizardResourceColumn[]): string {
  const name = resourceImportSetting(sheet, state, column).name?.trim() || column.name;
  if (name !== column.name) return name;
  const reminder = reminderColumn(sheet, state, column, columns);
  const reminderName = reminder && resourceImportSetting(sheet, state, reminder).name?.trim();
  return reminder && reminderName && reminderName !== reminder.name ? reminderName : name;
}

/** Each association is selected explicitly; names never decide ownership, costs or recovery. */
export function wizardResourceValues(sheet: ExportedCharacter, state: WizardState, columns: WizardResourceColumn[],
  sources: readonly FeatureSource[] = sheet.character?.featureSources ?? []): PrefillValue[] {
  if (state.options['resourceReminders'] !== true) return [];
  const selected = columns.filter(column => resourceImportSetting(sheet, state, column).enabled);
  const combined = new Set(selected.filter(column => column.kind === 'counter').flatMap(column => {
    const reminder = columns.find(candidate => candidate.id === resourceImportSetting(sheet, state, column).reminderId
      && candidate.kind === 'note' && candidate.sourceId === column.sourceId);
    return reminder ? [reminder.id] : [];
  }));
  return selected.filter(column => !combined.has(column.id)).map(column => {
    const setting = resourceImportSetting(sheet, state, column);
    const reminder = reminderColumn(sheet, state, column, columns);
    const existing = sheet.resources?.find(resource => resource.id === column.id);
    const previousReminder = sheet.resources?.find(resource => resource.id === reminder?.id);
    const placement = resourcePlacement(sources.find(source => source.editorId === column.sourceId));
    const resource: SourceResource = {
      id: column.id, sourceId: existing?.sourceId ?? column.sourceId, name: resourceImportName(sheet, state, column, columns),
      mode: column.kind === 'counter' ? reminder ? 'both' : 'counter' : 'note',
      note: String(reminder?.value ?? (column.kind === 'note' ? column.value : '')),
      total: column.kind === 'counter' ? Number(column.value) : 0, used: 0,
      recovery: setting.recovery ?? 'NONE',
      features: existing?.features ?? previousReminder?.features ?? placement.features,
      spells: existing?.spells ?? previousReminder?.spells ?? placement.spells,
    };
    return { path: ['resources', resource.id], scope: 'resourceReminders', label: `${column.owner}: ${resource.name}`, value: resource,
      combinedResourceId: reminder?.id };
  });
}
