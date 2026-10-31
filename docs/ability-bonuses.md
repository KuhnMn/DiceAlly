# Optional automatic ability bonuses

New characters enable automatic bonuses by default. Existing characters keep
their saved setting; legacy characters without a setting remain manual. The Ability Scores editor offers
Use Feature Stat Bonuses with Yes / No options. Bonus sources and their allocation
controls are grouped in bordered cards. Current active sources are
features, feats and backgrounds. Species sources are implemented behind the pure
helper's explicit `includeSpecies` parameter but are not enabled by any app caller;
an edition/profile selector is outside this change.

## Stored and calculated values

`sheet.abilityBonuses` contains the enabled flag, authored base scores, source
choices and explicitly configured bonus definitions. `character.abilityScores`
contains effective values so the existing AC, save, skill, initiative and casting
helpers continue reading one consistent set of scores.

- First enabling copies the currently entered scores as bases. Users who already
  included bonuses manually must enter their unmodified bases in automatic mode.
- Editing in automatic mode changes bases, not previously calculated totals.
- Disabling restores the bases as ordinary manual scores and hides the new bonus
  controls and summaries. Choices and custom definitions remain stored.
- Re-enabling uses the current manual scores as bases and retains source choices.
- Recalculation always starts from bases. Repeated loading, saving, refreshing and
  casting cannot compound bonuses.
- Manual HP, resource totals, combat overrides and wizard baselines are not
  independently recalculated by this feature.

Features use their instance editor IDs; legacy entries receive IDs when the user
first enables the mode. Backgrounds use their qualified reference identity, with a
name/source fallback for custom backgrounds. Removed sources stop contributing;
their saved choices do not apply to unrelated new entries.

## Supported definitions and decisions

The shared adapter reads the schema's `ability` alternatives, fixed changes,
uniform choices, weighted allocations, and per-option `max` (default 20).
Alternatives and chosen abilities must be valid and distinct as required by their
definition. A source with an unfinished/invalid choice contributes nothing until
resolved; other valid sources still work and the character can remain a draft.

Each source can be explicitly disabled with No bonus under Configure Bonus.
Definition overrides are authored state,
not edits to cached library content. The source editor offers +2 to one ability,
+1 to two abilities, or fixed custom changes and a maximum. Every feature can
be configured manually. Only sources with structured content
bonuses start with an active content suggestion; content-free sources start at
No bonus, including class ASI entries and feats named Ability Score Improvement.
No bonuses are inferred from a name. Class ASI increases come from the chosen
feat unless the user explicitly configures a manual bonus on the class feature.
The class feature schema has no structured ability field for Primal Champion,
so its description is not converted into automatic bonuses. No arbitrary numbers
are extracted from prose;
features without structured data can be configured explicitly on their editor row.

Positive increases respect each source's cap without lowering a base already over
that cap. Negative changes apply before positive increases; ordinary-cap increases
precede higher-cap increases so rearranging the feature list cannot alter totals.
The summary shows actual applied changes, including cap reductions. This is a
deterministic bonus projection, not a full chronological feat-eligibility engine.

## UI, updates and persistence

`AbilityBonusEditorComponent` is shared by Ability Scores, feature rows and the
background editor. Source names and types appear on standalone Ability Scores
cards; embedded editors reuse the surrounding feature or background heading.
Feature bonus editing opens from Stat Bonuses in the Uses/Notes toolbar.
Backgrounds have one Configure Bonus control; custom sources omit From Content,
and No bonus hides all allocation fields. Incomplete-choice prompts are omitted.
`AbilityBonusSummaryComponent` shows applied feature increases as read-only note
cards on the Feature Page. Both overview layouts show base + named contributions
= total in the shared hover/focus tooltip at each ability score, including caps,
instead of a separate Ability Bonuses section. Bonus summaries and editors are
hidden when the mode is manual.

Editor changes, viewer store loads and portable normalization update the effective
projection. Wizard output and description refresh do the same when the mode is
enabled. Source definitions can update while source choices, bases, notes and IDs
remain authored state. Changed choice eligibility leaves the allocation incomplete rather than
choosing a different ability silently.

Portable validation checks stored configuration. The existing local repository and
cloud codec preserve it without a new character file format or content schema.
Targeted tests cover the mathematics, toggle lifecycle, disabled species support,
real editor interactions, viewer summaries, local/cloud round trips and refresh.
