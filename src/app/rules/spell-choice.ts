import { ContentRecord, JsonObject, object } from '../content/content.model';
import { filterSpells } from './spell-filters';

export interface SpellChoiceDefinition {
  count: number;
  candidates: string[];
  query?: unknown;
  all: boolean;
}

/**
 * Read a structured additionalSpells choice, never infer a rule from prose.
 * Arcana Domain supplies { choose: 'level=0|class=Wizard', count: 2 }:
 * the filter determines eligible spells, and count determines how many to select.
 * Explicit choices instead use { choose: { from: ['light', 'mage hand'], count: 1 } }.
 */
export function describeSpellChoice(
  data: JsonObject,
  records: ReadonlyMap<string, ContentRecord>,
  resolveReference: (reference: string) => string,
): SpellChoiceDefinition {
  const choose = object(data['choose']);
  const query = spellChoiceQuery(data);
  const all = data['all'] !== undefined;
  let candidates: string[];

  if (query !== undefined) {
    candidates = filterSpells(query, records).map(record => record.key);
    if (!candidates.length) throw new Error('No spells match the filter.');
  } else {
    const references = choose?.['from'];
    if (!Array.isArray(references) || references.some(value => typeof value !== 'string')) {
      throw new Error('Invalid explicit spell choices.');
    }
    candidates = [...new Set((references as string[]).map(resolveReference))];
  }

  const count = all ? candidates.length : Number(data['count'] ?? choose?.['count'] ?? 1);
  if (!Number.isInteger(count) || count < 1 || count > candidates.length) {
    throw new Error('Invalid spell choice count.');
  }
  return { count, candidates, query, all };
}

export function spellChoiceQuery(data: JsonObject): unknown {
  const choose = object(data['choose']);
  return data['all'] ?? (choose?.['from'] === undefined ? data['choose'] : undefined);
}

/** Exact count, distinct answers, and membership all matter; duplicate clicks cannot fill a choice. */
export function isCompleteSelection(
  answers: readonly string[],
  count: number,
  candidates: readonly string[],
): boolean {
  return answers.length === count
    && new Set(answers).size === count
    && answers.every(answer => candidates.includes(answer));
}

/** Numeric keys gate character/class levels; sN keys gate available spell levels. */
export function isSpellRequirementMet(requirement: string, level: number, maxSpellLevel?: number): boolean {
  if (requirement === '_') return true;
  if (/^\d+$/.test(requirement)) return level >= Number(requirement);
  if (/^s\d+$/.test(requirement)) {
    if (maxSpellLevel === undefined) throw new Error('Spell-level eligibility input is required.');
    return maxSpellLevel >= Number(requirement.slice(1));
  }
  throw new Error(`Unsupported spell eligibility: ${requirement}`);
}
