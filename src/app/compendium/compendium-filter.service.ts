import { Injectable } from '@angular/core';
import { SPELL_EFFECT_FILTER_GROUPS, SpellEffectFilter } from '../content/spell-effects';
import { CONTENT_TYPES, ContentType, FACET_LABELS, Filters } from './compendium-catalog';

const STORAGE_KEY = 'ally-compendium-filters-v1';
type FilterScope = ContentType['id'] | `class:${string}`;

export interface CompendiumFilters {
  filters: Filters;
  effects: SpellEffectFilter;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function readSelections<Key extends string>(value: unknown, keys: readonly Key[]): Partial<Record<Key, string[]>> | undefined {
  if (!isObject(value)) return undefined;
  const selections: Partial<Record<Key, string[]>> = {};
  for (const key of keys) {
    const selected = value[key];
    if (selected === undefined) continue;
    if (!Array.isArray(selected) || !selected.every(entry => typeof entry === 'string')) return undefined;
    selections[key] = [...new Set(selected)];
  }
  return selections;
}

/** Category preferences stay separate from the creator's shared source defaults. */
@Injectable({ providedIn: 'root' })
export class CompendiumFilterService {
  private readonly saved = this.readStorage();

  load(scope: FilterScope): CompendiumFilters | undefined {
    const selection = this.saved[scope];
    return selection ? structuredClone(selection) : undefined;
  }

  save(scope: FilterScope, selection: CompendiumFilters) {
    this.saved[scope] = structuredClone(selection);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(this.saved)); } catch { /* Memory-only when storage is unavailable. */ }
  }

  private readStorage(): Partial<Record<FilterScope, CompendiumFilters>> {
    const saved: Partial<Record<FilterScope, CompendiumFilters>> = {};
    try {
      const stored: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}');
      if (!isObject(stored)) return saved;
      for (const [scope, value] of Object.entries(stored)) {
        if (!CONTENT_TYPES.some(type => type.id === scope) && !scope.startsWith('class:')) continue;
        if (!isObject(value)) continue;
        const filters = readSelections(value['filters'], Object.keys(FACET_LABELS) as (keyof Filters)[]);
        const effects = readSelections(value['effects'], SPELL_EFFECT_FILTER_GROUPS.map(group => group.key));
        if (filters && effects) saved[scope as FilterScope] = { filters, effects };
      }
    } catch { /* Invalid or inaccessible storage starts with the shared defaults. */ }
    return saved;
  }
}
