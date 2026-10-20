import { ContentRecord, ImportRevision, object, string } from '../content/content.model';
import { FeatureSource, SpeciesEntity, SpellEntryFull } from '../models/character.model';
import { SpellGrant } from '../rules/spell-rules';
import { resolveSpellUsageCount } from '../rules/spell-usage';
import { DEFENSE_ABILITIES } from './basic-info';

/** Exact provenance travels with snapshots so saved characters can work without the library. */
export function contentReference(record: ContentRecord, revision: ImportRevision) {
  return {
    key: record.key,
    sourceIdentity: revision.sourceIdentity,
    revisionId: revision.id,
    commit: revision.commit,
  };
}

/** Convert upstream movement objects to the numeric fields understood by the live viewer. */
export function speciesSnapshot(record: ContentRecord): SpeciesEntity {
  const snapshot = structuredClone(record.data);
  const speed = object(snapshot['speed']);
  if (speed) {
    snapshot['speed'] = Object.fromEntries(
      Object.entries(speed).map(([mode, value]) => [mode, object(value)?.['number'] ?? value]),
    );
  }
  return snapshot as unknown as SpeciesEntity;
}

/** A casting source stores ability flags because that is the Android export format. */
export function sourceAbilityFlags(record: ContentRecord, fallback = ''): Partial<FeatureSource> {
  const castingAbility = string(record.data['spellcastingAbility'], fallback);
  const primaryAbilities = JSON.stringify(record.data['primaryAbility'] ?? '').toLowerCase();
  return Object.fromEntries(DEFENSE_ABILITIES.map(ability => {
    const abbreviation = ability.key.slice(0, 3);
    return [`uses${ability.label}`, castingAbility
      ? castingAbility === abbreviation
      : primaryAbilities.includes(abbreviation)];
  }));
}

/** Only the starting class gets a maximized first die; all subsequent levels use average HP. */
export function averageClassHp(hitDie: number, level: number, constitutionModifier: number, startingClass: boolean): number {
  const firstLevel = startingClass ? hitDie + constitutionModifier : 0;
  const averageLevels = level - (startingClass ? 1 : 0);
  return firstLevel + (Math.ceil((hitDie + 1) / 2) + constitutionModifier) * averageLevels;
}

/** Daily/rest casting becomes a normal use tracker in the portable sheet. */
export function spellUseTrackers(grants: readonly SpellGrant[], modifiers: Readonly<Record<string, number>> = {}): NonNullable<SpellEntryFull['uses']> {
  return grants.flatMap(grant => {
    const frequency = grant.usage['frequency'];
    if (frequency !== 'daily' && frequency !== 'rest') return [];
    return [{
      tag: 'Free Uses',
      totalFreeUses: resolveSpellUsageCount(String(grant.usage['count']), modifiers),
      usedFreeUses: 0,
      freeUsesRegainCondition: frequency === 'rest' ? 'SHORT_REST' : 'LONG_REST',
      userAdded: false,
    }];
  });
}
