import type { Prerequisite } from '../models/character.model';
import { featureCategoryLabel } from '../editor/feature-selection';

export type PrerequisiteExpression =
  | { kind: 'requirement'; text: string; summaryText: string }
  | { kind: 'allOf' | 'anyOf'; requirements: PrerequisiteExpression[] };

export interface PreparedPrerequisites {
  expression: PrerequisiteExpression | null;
  detailText: string;
  summaryText: string;
  notes: string[];
}

const ABILITIES = { str: 'Strength', dex: 'Dexterity', con: 'Constitution', int: 'Intelligence', wis: 'Wisdom', cha: 'Charisma' } as const;
const title = (value: string) => value.replace(/\b\w/g, letter => letter.toUpperCase());
const referenceName = (value: string) => title(value.split('#')[0].split('|')[0]);
const leaf = (text: string, summaryText = text): PrerequisiteExpression => ({ kind: 'requirement', text, summaryText });

function group(kind: 'allOf' | 'anyOf', requirements: PrerequisiteExpression[]): PrerequisiteExpression {
  return requirements.length === 1 ? requirements[0] : { kind, requirements };
}

function expressionText(expression: PrerequisiteExpression, compact: boolean): string {
  if (expression.kind === 'requirement') return compact ? expression.summaryText : expression.text;
  return expression.requirements.map(child => {
    const text = expressionText(child, compact);
    return child.kind !== 'requirement' && child.kind !== expression.kind ? `(${text})` : text;
  }).join(expression.kind === 'allOf' ? ' AND ' : ' OR ');
}

/** Factor shared requirements so alternatives do not repeat the same level/class. */
function alternatives(branches: PrerequisiteExpression[][]): PrerequisiteExpression {
  if (branches.length === 1) return group('allOf', branches[0]);
  const common = branches[0].filter(entry => branches.every(branch => branch.some(other => JSON.stringify(other) === JSON.stringify(entry))));
  const remaining = branches.map(branch => branch.filter(entry => !common.some(other => JSON.stringify(other) === JSON.stringify(entry))));
  // An empty alternative imposes no additional requirement.
  if (remaining.some(branch => !branch.length)) return group('allOf', common);
  return group('allOf', [...common, group('anyOf', remaining.map(branch => group('allOf', branch)))]);
}

/** Display only. Source arrays are alternatives; fields within an object are cumulative. */
export function preparePrerequisites(prerequisites: readonly Prerequisite[] | null | undefined): PreparedPrerequisites {
  const notes: string[] = [];
  const branches = (prerequisites ?? []).map(prerequisite => {
    const requirements: PrerequisiteExpression[] = [];
    const add = (text: string, summaryText = text) => requirements.push(leaf(text, summaryText));
    const any = (values: string[], prefix = '') => { if (values.length) requirements.push(group('anyOf', values.map(value => leaf(prefix + value)))); };
    const level = prerequisite.level;
    if (typeof level === 'number') add(`Level ${level}+`);
    else if (level && typeof level.level === 'number') {
      const className = ('class' in level ? level.class : undefined) as { name?: string } | undefined;
      const subclass = ('subclass' in level ? level['subclass'] : undefined) as { name?: string } | undefined;
      add(`${className?.name ? `${className.name} ` : ''}Level ${level.level}+${subclass?.name ? ` (${subclass.name})` : ''}`);
    }
    if (prerequisite.ability?.length) requirements.push(group('anyOf', prerequisite.ability.map(scores => group('allOf',
      (Object.keys(ABILITIES) as (keyof typeof ABILITIES)[]).filter(ability => scores[ability] != null)
        .map(ability => leaf(`${ABILITIES[ability]} ${scores[ability]}+`))))));
    if (prerequisite.proficiency?.length) requirements.push(group('anyOf', prerequisite.proficiency.map(proficiency => {
      const parts: PrerequisiteExpression[] = [];
      if (proficiency.armor) parts.push(leaf(`${title(proficiency.armor)}${proficiency.armor === 'shield' ? '' : ' Armor'} Training`));
      if (proficiency.weapon) parts.push(leaf(`Proficiency with a ${proficiency.weapon} weapon`));
      if (proficiency.weaponGroup) parts.push(leaf(`${title(proficiency.weaponGroup)} Weapon Proficiency`));
      if (proficiency.skill) parts.push(leaf(proficiency.skill === true ? 'Proficiency in a skill' : `Proficiency in ${proficiency.skill.map(title).join(' AND ')}`));
      return group('allOf', parts);
    })));
    any(prerequisite.feat?.map(referenceName) ?? [], 'Feat: ');
    any(prerequisite.optionalfeature?.map(referenceName) ?? [], 'Optional Feature: ');
    any(prerequisite.feature ?? [], 'Feature: ');
    any(prerequisite.race?.map(race => race.displayEntry ?? `${title(race.name)}${race.subrace ? ` (${title(race.subrace)})` : ''}`) ?? [], 'Species: ');
    any(prerequisite.background?.map(background => background.displayEntry ?? title(background.name)) ?? [], 'Background: ');
    any(prerequisite.item ?? [], 'Item: ');
    any(prerequisite.campaign ?? [], 'Campaign: ');
    if (prerequisite.pact) add(`Pact of the ${prerequisite.pact}`);
    if (prerequisite.patron) add(`Patron: ${prerequisite.patron}`);
    if (prerequisite.spell?.length) requirements.push(group('anyOf', prerequisite.spell.map(spell => {
      if (typeof spell === 'string') {
        const suffix = spell.split('#')[1];
        if (suffix === 'x') return group('anyOf', [leaf('Hex spell'), leaf('Warlock feature that curses')]);
        return leaf(`${referenceName(spell)} ${suffix === 'c' ? 'cantrip' : 'spell'}`);
      }
      if ('spellName' in spell && typeof spell.spellName === 'string') return leaf(`${referenceName(spell.spellName)} spell`);
      const summary = 'entrySummary' in spell && typeof spell.entrySummary === 'string' ? spell.entrySummary : undefined;
      const text = 'entry' in spell && typeof spell.entry === 'string' ? spell.entry : summary ?? 'Unspecified spell requirement';
      return leaf(text, summary ?? text);
    })));
    if (prerequisite.spellcasting) add('Ability to cast at least one spell');
    if (prerequisite.spellcasting2020) requirements.push(group('anyOf', [leaf('Spellcasting feature'), leaf('Pact Magic feature')]));
    if (prerequisite.spellcastingFeature) add('Spellcasting feature');
    if (prerequisite.spellcastingPrepared) add('Spellcasting feature from a class that prepares spells');
    if (prerequisite.featCategory?.length) any(prerequisite.featCategory.map(category => typeof category === 'string'
      ? `Any ${featureCategoryLabel(category)} feat` : `${category.count} ${featureCategoryLabel(category.category)} feats`));
    if (prerequisite.exclusiveFeatCategory?.length) for (const category of prerequisite.exclusiveFeatCategory) add(`No other ${featureCategoryLabel(category)} feat`);
    if (prerequisite.other) add(prerequisite.other);
    if (prerequisite.otherSummary) add(prerequisite.otherSummary.entry ?? prerequisite.otherSummary.entrySummary, prerequisite.otherSummary.entrySummary);
    if (prerequisite.note) notes.push(prerequisite.note);
    const handled = new Set(['level', 'ability', 'proficiency', 'feat', 'optionalfeature', 'feature', 'race', 'background', 'item', 'campaign', 'pact', 'patron', 'spell', 'spellcasting', 'spellcasting2020', 'spellcastingFeature', 'spellcastingPrepared', 'featCategory', 'exclusiveFeatCategory', 'other', 'otherSummary', 'note']);
    for (const [key, value] of Object.entries(prerequisite)) if (value !== undefined && !handled.has(key)) add(`Additional requirement (${key}): ${JSON.stringify(value)}`);
    return requirements;
  });
  const expression = branches.length ? alternatives(branches) : null;
  return { expression, detailText: expression ? expressionText(expression, false) : '', summaryText: expression ? expressionText(expression, true) : '', notes: [...new Set(notes)] };
}
