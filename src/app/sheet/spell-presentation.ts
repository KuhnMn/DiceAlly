import { SpellComponents, SpellDuration, SpellEntity, SpellTime } from '../models/character.model';

export interface SpellCastingTimeDetails {
  durationText: string;
  conditionText?: string;
  noteText?: string;
}

export interface SpellMaterialDetails {
  descriptionText?: string;
  costInCopperPieces?: number;
  consumption: 'consumed' | 'notConsumed' | 'optional' | 'unspecified';
}

export interface SpellComponentDetails {
  requiresVerbal: boolean;
  requiresSomatic: boolean;
  requiresRoyalty: boolean;
  material?: SpellMaterialDetails;
  summaryText: string;
}

export interface SpellDurationDetails {
  durationText: string;
  requiresConcentration: boolean;
  conditionText?: string;
  endingConditions: string[];
}

/** Prepared on demand from the saved snapshot; never persisted alongside source fields. */
export interface SpellDetails {
  castingTimes: SpellCastingTimeDetails[];
  components?: SpellComponentDetails;
  durations: SpellDurationDetails[];
  hasRitualCastingOption: boolean;
}

const PLURAL_UNITS: Readonly<Record<string, string>> = {
  action: 'actions', 'bonus action': 'bonus actions', reaction: 'reactions',
  turn: 'turns', round: 'rounds', minute: 'minutes', hour: 'hours', day: 'days',
  week: 'weeks', month: 'months', year: 'years',
};

function quantityText(amount: number | undefined, unit: string): string {
  const label = amount != null && amount !== 1 ? PLURAL_UNITS[unit] ?? unit : unit;
  return amount == null ? label : `${amount} ${label}`;
}

export function prepareSpellCastingTimes(times: readonly SpellTime[]): SpellCastingTimeDetails[] {
  return times.map(time => ({
    durationText: quantityText(time.number, time.unit === 'bonus' ? 'bonus action' : time.unit ?? ''),
    conditionText: time.condition,
    noteText: time.note,
  }));
}

export function castingTimeText(time: SpellCastingTimeDetails): string {
  return `${time.durationText}${time.conditionText ? `, ${time.conditionText}` : ''}${time.noteText ? ` (${time.noteText})` : ''}`;
}

function prepareSpellMaterial(material: SpellComponents['m']): SpellMaterialDetails | undefined {
  if (material == null || material === false) return undefined;
  if (material === true) return { consumption: 'unspecified' };
  if (typeof material === 'string') return { descriptionText: material, consumption: 'unspecified' };

  let consumption: SpellMaterialDetails['consumption'];
  switch (material.consume) {
    case true: consumption = 'consumed'; break;
    case false: consumption = 'notConsumed'; break;
    case 'optional': consumption = 'optional'; break;
    default: consumption = 'unspecified';
  }
  return { descriptionText: material.text, costInCopperPieces: material.cost, consumption };
}

export function prepareSpellComponents(components: SpellComponents): SpellComponentDetails {
  const material = prepareSpellMaterial(components.m);
  const labels = [
    ...(components.v ? ['V'] : []), ...(components.s ? ['S'] : []),
    ...(material ? [material.descriptionText ? `M (${material.descriptionText})` : 'M'] : []),
    ...(components.r ? ['R (royalty)'] : []),
  ];
  return { requiresVerbal: components.v === true, requiresSomatic: components.s === true,
    requiresRoyalty: components.r === true, material, summaryText: labels.join(', ') || 'None' };
}

const ENDING_CONDITIONS: Readonly<Record<string, string>> = {
  dispel: 'dispelled', trigger: 'triggered', discharge: 'discharged',
};

export function prepareSpellDurations(durations: readonly SpellDuration[]): SpellDurationDetails[] {
  return durations.map(duration => {
    const endingConditions = (duration.ends ?? []).map(end => ENDING_CONDITIONS[end] ?? end);
    let durationText: string;
    // Older portable snapshots can contain a timed value without its outer type.
    if (duration.type === 'timed' || (!duration.type && duration.duration)) {
      const timed = duration.duration;
      durationText = timed?.type ? quantityText(timed.amount, timed.type) : 'See spell description';
      if (timed?.type && (duration.concentration || timed.upTo)) durationText = `Up to ${durationText}`;
    } else {
      switch (duration.type) {
        case 'instant': durationText = 'Instantaneous'; break;
        case 'permanent': durationText = endingConditions.length ? `Until ${endingConditions.join(' or ')}` : 'Permanent'; break;
        case 'special': durationText = 'Special'; break;
        default: durationText = duration.type ?? '';
      }
    }
    return { durationText, requiresConcentration: duration.concentration === true,
      conditionText: duration.condition, endingConditions };
  });
}

export function spellDurationText(duration: SpellDurationDetails, includeConcentration = true): string {
  return `${includeConcentration && duration.requiresConcentration ? 'Concentration, ' : ''}${duration.durationText}${duration.conditionText ? ` (${duration.conditionText})` : ''}`;
}

export function prepareSpellDetails(spell: Partial<SpellEntity>): SpellDetails {
  return {
    castingTimes: prepareSpellCastingTimes(spell.time ?? []),
    components: spell.components ? prepareSpellComponents(spell.components) : undefined,
    durations: prepareSpellDurations(spell.duration ?? []),
    hasRitualCastingOption: spell.meta?.ritual === true,
  };
}
