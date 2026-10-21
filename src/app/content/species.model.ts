export const MOVEMENT_MODES = ['walk', 'fly', 'swim', 'climb', 'burrow'] as const;
export const SPECIES_ABILITIES = ['str', 'dex', 'con', 'int', 'wis', 'cha'] as const;
export const SPECIES_SENSES = ['darkvision', 'blindsight', 'tremorsense', 'truesight'] as const;
export type MovementMode = typeof MOVEMENT_MODES[number];
export type SpeciesAbility = typeof SPECIES_ABILITIES[number];
export type SpeciesSense = typeof SPECIES_SENSES[number];

export type MovementRate = { kind: 'fixed'; feet: number; condition?: string }
  | { kind: 'walk-reference' };
export type SpeciesMovement = { kind: 'unspecified' } | { kind: 'variable' }
  | { kind: 'defined'; modes: Partial<Record<MovementMode, MovementRate>>;
      alternatives: Partial<Record<MovementMode, MovementRate[]>>;
      alternativeExtensions?: Record<string, unknown>;
      choice?: { from: MovementMode[]; feet: number }; hover: boolean; hidden: MovementMode[] };
export type SpeciesAbilityAllocation = { kind: 'uniform'; from: SpeciesAbility[]; count: number; amount: number; entry?: unknown }
  | { kind: 'weighted'; from: SpeciesAbility[]; weights: number[]; entry?: unknown; extensions?: Record<string, unknown> }
  | { kind: 'unavailable'; source: unknown; reason: string };
export interface SpeciesAbilityOption {
  fixed: Partial<Record<SpeciesAbility, number>>;
  choice?: SpeciesAbilityAllocation;
  hidden: boolean;
  maximum: number;
}
export type SpeciesTrait = { kind: 'fixed'; value: string }
  | { kind: 'choice'; options: SpeciesTrait[]; count: number }
  | { kind: 'unavailable'; source: unknown; reason: string };

/** Versioned mechanics. Shared descriptions/proficiencies/spell grants retain validated source payloads. */
export interface SpeciesDefinition {
  version: 1;
  movement: SpeciesMovement;
  abilities: SpeciesAbilityOption[];
  defenses: { resist: SpeciesTrait[]; immune: SpeciesTrait[]; vulnerable: SpeciesTrait[]; conditionImmune: SpeciesTrait[] };
  senses: Partial<Record<SpeciesSense, number>>;
  sizes: string[];
  creatureTypes: SpeciesTrait[];
}
