import type { SiteSourceByKind } from './generated/site-source';
import type { BrewSourceByKind } from './generated/brew-source';

export const CLASS_KINDS = ['class', 'subclass', 'classFeature', 'subclassFeature'] as const;
export type ClassKind = typeof CLASS_KINDS[number];
export type ClassAbility = NonNullable<SiteSourceByKind['class']['spellcastingAbility']>;
type SourceClass = BrewSourceByKind['class'];
export interface ClassFeatureReference {
  key: string;
  uid: string;
  gainSubclassFeature?: boolean;
  gainSubclassFeatureHasContent?: boolean;
  tableDisplayName?: string;
  /** The upstream reference wrapper explicitly permits extension fields. */
  extensions?: Record<string, unknown>;
}
export interface ClassCasting {
  progression?: SourceClass['casterProgression'];
  ability?: ClassAbility;
  cantripProgression?: SourceClass['cantripProgression'];
  preparedSpells?: SourceClass['preparedSpells'];
  preparedSpellsProgression?: SourceClass['preparedSpellsProgression'];
  preparedSpellsChange?: SourceClass['preparedSpellsChange'];
  spellsKnownProgression?: SourceClass['spellsKnownProgression'];
  spellsKnownProgressionFixed?: SourceClass['spellsKnownProgressionFixed'];
  spellsKnownProgressionFixedAllowLowerLevel?: SourceClass['spellsKnownProgressionFixedAllowLowerLevel'];
  spellsKnownProgressionFixedByLevel?: SourceClass['spellsKnownProgressionFixedByLevel'];
}
/** Mechanical class-family fields, validated after copy resolution and on snapshot load. */
export interface ClassDefinition {
  version: 1;
  kind: ClassKind;
  parent?: { key: string; name: string; source: string };
  shortName?: string;
  subclass?: { shortName: string; source: string };
  level?: number;
  hitDice?: NonNullable<SourceClass['hd']>;
  features: ClassFeatureReference[];
  casting: ClassCasting;
  savingThrows: ClassAbility[];
  primaryAbilities: ClassAbility[][];
  proficiencies: { starting?: SourceClass['startingProficiencies']; multiclass?: SourceClass['startingProficiencies'] };
  optionalFeatures: NonNullable<SourceClass['optionalfeatureProgression']>;
}
