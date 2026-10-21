import { hasAdditionalSpellPayload } from '../content/additional-spells';
import { ContentRulesIndex, FeatureInstance } from './feature-rules';
import { previewClassRules, spellOwnerIdentity } from './class-preview';
import { deriveStats, ProficiencyContribution } from './derived-stats';
import { LevelInputs, ResourcePool } from './level-rules';
import { deriveProficiencyGrants } from './proficiency-rules';
import { ProficiencyCatalogs } from './proficiency-rules';
import { applySessionAction, HealthPlayState } from './session-rules';
import { deriveSpecies, SpeciesContribution, SpeciesInstance } from './species-rules';
import { SpellInstance } from './spell-rules';
import { manualAbilityScores, SpeciesAbilityChoice } from './ability-rules';

type ClassOptions = Parameters<typeof previewClassRules>[0];
type StatsOptions = Parameters<typeof deriveStats>[0];
export interface CharacterRulesInput {
  classes: Omit<ClassOptions,'levels' | 'session' | 'previousFeatures' | 'previousSpells' | 'previousPools' | 'additionalSpellOwners'>;
  levels: Omit<LevelInputs,'classes' | 'constitution'>;
  session: HealthPlayState;
  abilities: StatsOptions['abilities'];
  stats: Omit<StatsOptions,'abilities' | 'totalLevel' | 'manual' | 'generated'>;
  manualProficiencies: ProficiencyContribution[];
  applyProficiencies?: boolean;
  proficiencyAnswers?: Readonly<Record<string,readonly string[]>>;
  proficiencyCatalogs?: ProficiencyCatalogs;
  species?: { id: string; key: string };
  /** Reserved compatibility fields; species ability automation is inactive. */
  applySpeciesAbilities?: boolean;
  speciesAbilityChoice?: SpeciesAbilityChoice;
  speciesAnswers?: Record<string, string[]>;
  manualSpeciesContributions: SpeciesContribution[];
  previous: { features: FeatureInstance[]; spells: SpellInstance[]; pools: ResourcePool[]; species?: SpeciesInstance };
}
/** Pure orchestration boundary; persistence/schema validation and explicit acceptance are separate. */
export function previewCharacterRules(input: CharacterRulesInput,index: ContentRulesIndex) {
  // Imported ability bonuses remain metadata; manual scores drive all calculations.
  const species = deriveSpecies(input.species,index,input.manualSpeciesContributions,input.previous.species,input.speciesAnswers);
  const abilities = manualAbilityScores(input.abilities);
  const proficiencies = input.applyProficiencies === false
    ? { canAccept: true,diagnostics: [] as string[],choices: [],packages: [],manual: structuredClone(input.manualProficiencies),generated: [] as ProficiencyContribution[],contributions: structuredClone(input.manualProficiencies) }
    : deriveProficiencyGrants(input.classes.selections,index,input.proficiencyAnswers,input.species?.key,input.manualProficiencies,input.proficiencyCatalogs);
  const totalLevel = input.classes.selections.reduce((sum,s) => sum+s.level,0);
  const speciesSpellOwners = species.canAccept && input.species && species.instance && hasAdditionalSpellPayload(species.instance.snapshot) ? [{
    selectionId: input.species.id,ownerKey: input.species.key,level: totalLevel,
    ...input.classes.ownerOptions?.[spellOwnerIdentity(input.species.id,input.species.key)],
  }] : [];
  const classes = previewClassRules({ ...input.classes,levels: { ...input.levels,constitution: abilities.effective.con },session: input.session,
    optionalPrerequisites: { totalLevel: 0,classes: [],spells: new Set(),optionalFeatures: new Set(),pacts: new Set(),
      // Actual scores take precedence over supplemental prerequisite facts supplied by a caller.
      ...input.classes.optionalPrerequisites,abilities: abilities.effective },
    previousFeatures: input.previous.features,previousSpells: input.previous.spells,previousPools: input.previous.pools,additionalSpellOwners: speciesSpellOwners },index);
  const diagnostics = [...abilities.diagnostics,...species.diagnostics,...proficiencies.diagnostics,...classes.diagnostics];
  let stats: ReturnType<typeof deriveStats> | undefined;
  if (classes.canAccept && species.canAccept && proficiencies.canAccept && abilities.canAccept) {
    try {
      stats = deriveStats({ ...input.stats,abilities: abilities.effective,totalLevel,manual: proficiencies.manual,generated: proficiencies.generated });
      // Validate additional play-state fields without healing/resting/clamping during derivation.
      applySessionAction(input.session,classes.levels!.maxHp,classes.proposed.pools,
        { type: 'death-saves',...input.session.deathSaves });
    } catch(error) { diagnostics.push(String(error)); }
  }
  const hasCompleteProposal = diagnostics.length === 0 && species.canAccept && !!stats;
  const adjustments = classes.levels?.adjustments ?? [];
  // A valid proposal may still need the user's decision about HP or usage above reduced totals.
  const proposed = hasCompleteProposal ? {
    features: classes.proposed.features,spells: classes.proposed.spells,pools: classes.proposed.pools,
    session: { ...structuredClone(input.session),...classes.proposed.session },species: species.instance,
    speciesContributions: species.contributions,proficiencies: proficiencies.contributions,stats: stats!,maxHp: classes.levels!.maxHp,
    effectiveAbilities: abilities.effective,abilityContributions: abilities.contributions,
  } : undefined;
  const removedFeatures = hasCompleteProposal ? input.previous.features.filter(old => !proposed!.features.some(current => current.id === old.id)) : [];
  const removedSpells = hasCompleteProposal ? input.previous.spells.filter(old => !proposed!.spells.some(current => current.id === old.id)) : [];
  return { canAccept: hasCompleteProposal && adjustments.length === 0,requiresAdjustments: hasCompleteProposal && adjustments.length > 0,
    diagnostics,adjustments: structuredClone(adjustments),proposed,classes,species,proficiencies,abilities,
    removed: { features: structuredClone(removedFeatures),spells: structuredClone(removedSpells),species: hasCompleteProposal ? species.removed : [] } };
}
