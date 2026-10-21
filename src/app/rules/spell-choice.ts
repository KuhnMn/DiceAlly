import type { SpellGrantChoice } from '../content/additional-spells';
import { ContentRecord } from '../content/content.model';
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
  data: SpellGrantChoice,
  records: ReadonlyMap<string, ContentRecord>,
  resolveReference: (reference: string) => string,
): SpellChoiceDefinition {
  const choose = 'choose' in data ? data.choose : undefined;
  const query = spellChoiceQuery(data);
  const all = 'all' in data;
  let candidates: string[];

  if (query !== undefined) {
    candidates = filterSpells(query, records).map(record => record.key);
    if (!candidates.length) throw new Error('No spells match the filter.');
  } else {
    const references = typeof choose === 'object' ? choose.from : undefined;
    if (!references) {
      throw new Error('Invalid explicit spell choices.');
    }
    candidates = [...new Set(references.map(resolveReference))];
  }

  const requestedCount = typeof choose === 'object'
    ? choose.count
    : 'count' in data ? data.count : undefined;
  const count = all ? candidates.length : requestedCount ?? 1;
  if (!Number.isInteger(count) || count < 1 || count > candidates.length) {
    throw new Error('Invalid spell choice count.');
  }
  return { count, candidates, query, all };
}

export function spellChoiceQuery(data: SpellGrantChoice): unknown {
  const choose = 'choose' in data ? data.choose : undefined;
  return 'all' in data ? data.all : typeof choose === 'string' ? choose : undefined;
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
