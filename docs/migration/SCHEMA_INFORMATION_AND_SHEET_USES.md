# Information gained from the schemas and possible sheet uses

Status: adapter 18, reviewed on 2026-10-21. This is an information inventory and a set of future opportunities, not an implementation commitment. It adds no sheet functionality.

The overhaul did not invent new game data. It established what the imported data actually contains, which shapes are valid, and how the app can access that information reliably. Some information was already used by the sheet; other fields were retained but not exposed. The schemas now make those distinctions explicit.

This document covers all currently imported content families and the shared structures relevant to the sheet. The exhaustive source field/requiredness inventory is [content-schema-coverage.json](content-schema-coverage.json); implementation status and limitations are in [SCHEMA_CONTENT_COVERAGE.md](SCHEMA_CONTENT_COVERAGE.md).

## 1. What we now know about the data

| Knowledge gained | Practical value for the sheet |
| --- | --- |
| Exact field names and required/optional fields | Read explicit attributes instead of trying several guessed names. An absent value can remain unspecified instead of receiving an invented default. |
| Allowed values and real alternatives | Distinguish numeric HP from special HP text, fixed speed from conditional speed, fixed grants from choices, and the different vehicle subtypes. |
| Nested structures and discriminants | Give descriptions, table rows, spell choices and stat blocks appropriate handling without assuming every object has the same shape. |
| Site and homebrew are distinct profiles | Preserve site publication flags and homebrew extensions correctly. A homebrew-only field is not assumed to exist in every core record. |
| Identity, publication and reference structure | Resolve the intended edition/publication, distinguish class/subclass ownership, and avoid silently substituting a similarly named record. |
| Copy/inheritance and materialization inputs | Resolve copies, subraces, item groups and variants before a sheet consumer reads the resulting definition. |
| Structural validation | Reject malformed imports before activation and retain the previous active library. Report missing or ambiguous references separately from invalid data. |
| Source definitions and character state are different | Keep notes, choices, current HP, spent uses and overrides independent of changes to an imported definition. |
| Schema validity is not complete rule semantics | A valid field tells us how data is represented. It does not by itself establish stacking, timing, legality, recovery, prerequisites fulfilled, or how prose should execute. |

Schemas and mappings are pinned and reviewed locally. Imports do not fetch a changing live schema or try alternative schemas until one accepts a record. Full source types also describe metadata that does not need a custom application representation.

## 2. Where the information lives now

| Family | Application access |
| --- | --- |
| Playable species | `ContentRecord.species` / `SpeciesDefinition` |
| Classes, subclasses and their features | `ContentRecord.classDefinition` / `ClassDefinition` |
| Feats, optional features and backgrounds | `ContentRecord.characterOption` / `CharacterOptionDefinition` |
| Spells | `ContentRecord.spellDefinition` / `SpellDefinition` |
| Playable items | `ContentRecord.itemDefinition` / `ItemDefinition` |
| Monsters | `ContentRecord.monsterDefinition` / `MonsterDefinition` |
| Objects, conditions, senses, skills, actions, bastions, variant rules, diseases and vehicles | `ContentRecord.referenceDefinition`, narrowed by its `kind` |
| Shared entries, proficiency grants and spell references | Schema-backed shared accessors/types; some payloads intentionally retain their source structure |
| Supporting definitions and unused metadata | Preserved source fields, materialization inputs or typed reference metadata, as appropriate |

The existing mechanical/selection consumers have migrated. The nine reference categories are imported and stored as typed definitions, but no new rules, selectors or viewer workflows have been added for them. The existing condition picker still represents character condition/effect state independently of imported condition definitions.

## 3. Existing character-building and sheet categories

The uses below are opportunities enabled by the known data. They do not mean that every listed field is already rendered or automated.

| Category | Information now explicitly known | Where it could be used in the sheet | Boundary to preserve |
| --- | --- | --- | --- |
| Species, races and subraces | Sizes, creature types, movement modes, fixed/conditional/alternate movement, walking-speed references, hover, sense ranges, defenses, fixed and choice-based ability adjustments, proficiency and spell grants. Subrace data has a defined merge/materialization path. | Species editor; character information; movement and senses summaries; visible defense choices; explanation of which species supplied a trait. | Conditional movement should display its condition. Choices require an answer. **Automatic species ability-score adjustments remain disabled; manual scores stay authoritative.** |
| Classes and subclasses | Parent/subclass identity, feature ownership and acquisition levels, hit dice, saving-throw proficiencies, primary ability alternatives, starting/multiclass proficiencies, casting metadata and optional-feature progression. | Class wizard; level-up preview; feature grouping by class and level; hit-dice display; clearer multiclass proficiency and spell-source explanations. | Acquisition level and ownership are not the complete legality rules. Changes should remain detached previews until accepted. |
| Class/subclass features | Exact qualified feature references, level and parent identifiers, descriptions and additional spell/proficiency payloads where declared. | Features page; source/level labels; links to the originating class or subclass; comparison of features gained or removed on level changes. | Do not claim that arbitrary feature prose has been converted into executable mechanics. |
| Feats | Structured prerequisite alternatives, category, descriptions, proficiency grants and additional spells; other source ability metadata is retained where provided. | Feat picker filters; prerequisite explanations; category labels; feature descriptions; explicit grant choices. | Unsupported prerequisites must remain unresolved/diagnosed. Do not derive every feat effect or apply ability changes from its text. |
| Optional features | Feature-type codes, prerequisites, descriptions and grants. Classes declare the progression that offers these selections. | Existing optional-feature choices, such as source-defined invocation or maneuver groups; eligibility explanations; showing which class selection supplied a slot. | Source feature-type codes need display labels. A feature appearing in the library does not mean the character can select it. |
| Backgrounds | Prerequisites and skill/language/tool/armor/weapon proficiency packages, descriptions and additional spell payloads. Other source metadata remains available. | Background editor; proficiency prefill and package choices; source details; visible spell-grant choices where supported. | A displayed package is not automatically a union of all alternatives. Ability metadata remains descriptive unless separately authorized and implemented. |
| Spells | Level, school, alternative casting times, range, components, durations, ritual/concentration metadata where supplied, attack type, class/subclass memberships and source variants. Descriptions, higher-level entries, damage/save/scaling metadata are retained. | Spell search and filters; compact casting details; component/cost reminders; concentration/duration labels; class availability; higher-level descriptions; clearer casting-source grouping. | Tags such as damage type or saving throw are not complete effect formulas. Upcasting, damage application, targeting, duration countdowns and concentration automation need explicit rules. Ritual spell metadata does not establish the character's ritual-casting capability. |
| Items and equipment | Type/rarity, attunement requirements, weight/value, armor and weapon fields, range, damage expressions/types, equipment flags, bonus fields, property/mastery UIDs and notes, attached spell references. | Equipment filters and details; inventory summaries; explicit armor/weapon calculations; property/mastery explanations; attunement reminders; item-linked spell reference cards. | Preserve conditional requirements and player equipment/attunement state. Do not automatically apply all bonuses, mastery effects or attached-spell casting mechanics. |
| Base items, groups and magic variants | How base items and recipes become playable items, group members, inheritance inputs and item provenance. Supporting type/property/mastery records supply identifiers and descriptions. | More understandable item provenance; consistent property labels; comparing a generated item with its base; avoiding duplicate or misleading equipment choices. | Recipes and supporting records should not appear as ordinary owned equipment. Keep source records distinct from materialized playable items. |
| Monsters | Size/type/alignment, AC/HP alternatives, movement, initiative, ability scores including special/null forms, senses/passive perception, languages, CR and nested defenses. Traits, actions, reactions, bonus actions, spellcasting and save/skill payloads remain available. | Existing monster/companion cards; richer stat details; optional HP prefill when a numeric value exists; action descriptions; defense and sense summaries. | Monster state remains independent of source stats. Special HP cannot become an invented number. Attack execution, spellcasting and conditional defenses need dedicated semantics. |
| Monster templates | Explicit copy/template inputs and transformations already supported by the inheritance pipeline. | Provenance and explanations of how a stored stat block was derived; an optional comparison view. | Templates are transformation inputs, not standalone companions or an excuse to support every possible modifier automatically. |
| Tables | Captions, labels, ordinary/structured rows, nested tables, footnotes, intro/outro and structured cell information where supplied. Generated tables also carry publication/parent metadata. | Inline reference tables; readable spell/feature tables; contextual lookups; potentially rolls when explicit roll metadata supports them. | Do not infer probabilities, die expressions or legal character choices solely from row count or descriptive text. Some entry kinds still use fallback rendering. |

### Shared proficiency information

We now distinguish structured grant packages from class display strings/wrappers. Structured packages contain fixed grants, choices and declared pools such as any skill, standard language, artisan tool, gaming set or musical instrument. Package alternatives and nested answers have separate identities.

Possible sheet uses:

- Show the source of each proficiency and explain fixed grants versus player choices.
- Present package choices before nested individual choices.
- Exclude already-granted candidates consistently and explain insufficient candidate pools.
- Link a structured tool grant to its exact item/publication where supported.
- Keep manual proficiencies separate from generated contributions.

The schema's proficiency structures do not supply an arbitrary rank system or the complete rules for expertise, half proficiency, stacking or replacement. Unsupported filter-based choices still need a handler.

### Shared spell-grant information

`additionalSpells` explicitly distinguishes innate, known, prepared and expanded lists; character/class-level and spell-level gates; fixed references; filter selectors; explicit choices; ability choices; named resources; and frequency/count groups. `attachedSpells` distinguishes flat item spell lists from usage-grouped references.

Possible sheet uses:

- Explain why a spell is present and which feature, class or species supplied it.
- Keep expanded availability separate from spells actually known or prepared.
- Present explicit block, ability and spell choices.
- Show supported usage definitions and match them to independently stored counters.
- Offer item-linked spell descriptions without silently granting the ability to cast them.

Parsing/linking a valid group does not implement its mechanics. Unsupported groups and symbolic usage counts must stay visible as unsupported rather than acquiring guessed behavior. Existing grant/choice identities must remain stable to preserve notes and spent uses.

## 4. The ten reference categories connected to typed storage

All ten are now stored through `referenceDefinition`. The uses in this section are future functionality, not current integrations.

| Category / model | Available information | Possible sheet placement and use | What is not supplied automatically |
| --- | --- | --- | --- |
| Statuses / `StatusDefinition` | Bloodied, Concentration and Surprised reference descriptions, with distinct PHB/XPHB publications and source metadata. | Contextual reference text beside concentration, initiative or HP controls. | Active status state, concentration checks, surprise effects or automatic Bloodied tracking. |
| Actions / `ActionDefinition` | Name, publication/page, descriptions, timing alternatives where supplied, variant-rule association and related-action references. | Combat action reference; searchable action descriptions; timing labels; contextual links beside an attack or combat note. | Action availability for a particular character, remaining turn actions and executable effects. Standalone actions are distinct from monster action fields. |
| Bastions / `BastionDefinition` (`facility`) | Facility type, level, prerequisites, space, hireling requirements, orders and descriptions, plus aliases/source metadata. | Optional bastion section or linked campaign reference; owned-facility cards; order descriptions; explicit eligibility reminders. | A complete bastion economy, order outcomes, turn schedule, construction costs or automatic staffing. Some effects and requirements remain descriptive text. |
| Conditions / `ConditionDefinition` | Names/aliases, edition/publication, descriptions, reprints and optional homebrew presentation metadata such as color. | Description popup for an active condition; edition-specific reference; links from features, spells and monster descriptions. | Applying all condition effects to attacks, movement, checks or saves; duration or removal timing. The reference definition is not the active effect instance. |
| Diseases / `DiseaseDefinition` | Names/aliases, descriptions, source metadata and classification where provided. | Optional ongoing-affliction notes/reference cards; linked disease descriptions; manually tracked progression or recovery reminders. | Uniform fields for every infection check, stage, damage event or cure. Prose needs deliberate implementation before it can execute. |
| Objects / `ObjectDefinition` | Object category, size, creature type where supplied, ability scores, numeric/special AC and HP, movement, senses, defenses, descriptions, action descriptions and token metadata. | Object/siege-equipment reference cards; an explicitly enabled HP tracker; action references; linked notes for an owned or encountered object. | Object ownership, current HP, operation costs, automatic attacks or assumptions that special AC/HP text is numeric. |
| Senses / `SenseDefinition` | Sense name, source/page/reprints and description. | Help text beside the character's senses; definition popups; reference links when a species or monster grants a sense. | Numeric character ranges, detection results or advantage. A sense dictionary entry is different from a specific character's sense grant. |
| Skills / `SkillDefinition` | Skill name, source/page/reprints, description and optional associated ability. | Skill help text; source-aware labels; an ability hint for a check; reference links from a proficiency choice. | Whether the character is proficient, proficiency rank, misc bonuses or the final check modifier. An absent ability must stay unspecified. |
| Variant rules / `VariantRuleDefinition` | Name, descriptions, rule classification, publication/page, legacy/source metadata and related inline references. | Optional rule-reference collection; links from affected controls; an explicit campaign/character rule configuration if later implemented. | Enabling a variant or changing calculations just because its definition was imported. Each executable variant needs its own reviewed rule implementation and explicit configuration. |
| Vehicles / `VehicleDefinition` | A real subtype union: ship, spelljammer, elemental airship, infernal war machine, creature vehicle and object vehicle. Subtypes provide different combinations of terrain, dimensions/size, crew/passenger/cargo capacity, pace/speed, cost, hull/HP/AC, defenses, weapons, stations, components, traits and actions. | Optional vehicle cards; crew/cargo summaries; component stat details; action-station references; opt-in damage/HP trackers. | A single universal vehicle stat layout, automatic travel, operating eligibility or combat resolution. A missing field in one subtype is not evidence that its value is zero. |

## 5. Shared descriptions, provenance and metadata

| Information | Potential use | Important distinction |
| --- | --- | --- |
| Structured entries: lists, sections, insets, choices, tables, references and other declared kinds | More faithful descriptions across features, spells, items, companions and reference cards. | A defined entry kind does not guarantee the current renderer has dedicated presentation for it. Preserve unsupported content. |
| Inline and structured content references | Open the correct spell, condition, variant rule, item or feature description from its context. | Missing and ambiguous targets must not silently resolve to another publication or edition. |
| Name, source, page, other/reference sources and reprints | Source labels, traceability, source-book filters, comparing editions and content-update previews. | Outer display names may differ from original source names, especially for homebrew variants. |
| Source-specific availability/publication flags | Accurate filtering or badges when a consumer needs those flags. | Site and homebrew profiles differ. These flags are not universal mechanical rules. |
| Token/image references, art credits and fluff metadata | Optional portraits, reference illustrations and source credits loaded on demand. | A stored reference is not a bundled image. Not every linked fluff asset is fetched by the current importer. |
| Foundry/external-tool metadata | Preserve information for a possible future compatibility/export adapter. | External-system configuration is not an AllySheet rule or a universal D&D mechanic. |
| Deterministic identities, schema identity and copy provenance | Safer snapshots, update explanations and reproducible imports. | Updating a library must not silently rewrite an existing character's authored state. |

## 6. Imported definitions versus owned state

Future integrations should copy the selected definition into the all-in-one exported character snapshot and store mutable state separately. A saved character must remain usable offline without the original library.

| Imported definition | Separate character/player state |
| --- | --- |
| Condition or disease reference text | Active effect, notes, start/removal information and manually maintained progression. |
| Object HP/AC/action definitions | Current/temp HP, overrides, operator and spent resources. |
| Vehicle design and component stats | Damage to particular components, assigned crew, cargo and notes. |
| Bastion facility requirements/orders | Which facility is owned, staffing, selected order and tracked outcomes. |
| Skill description/associated ability | Proficiency contributions, chosen check ability and player bonuses. |
| Sense description | The character's actual granted range and any conditions on that grant. |
| Spell grant/usage definition | Selected spells, suppression choices, notes and used counters. |

No automatic species ability-score adjustment is proposed for current behavior. Manual ability scores remain authoritative. More generally, future rule automation should be opt-in where appropriate and must not overwrite authored values or reset existing notes/resources.

## 7. Sensible future implementation order

These are sequencing suggestions, not changes authorized by this document.

1. **Reference access within existing pages:** condition descriptions, skill help, sense explanations and source labels. These mostly present validated information without new mechanical effects.
2. **Richer existing descriptions and selection explanations:** entry/table rendering, property/mastery explanations, grant provenance and prerequisite/choice diagnostics. Preserve unsupported cases explicitly.
3. **Optional reference cards:** actions, objects, diseases and variant-rule collections. Keep selecting a reference separate from activating an effect.
4. **Owned entities with explicit state:** object trackers, vehicle/component cards and bastion facilities. Define snapshot/state contracts before adding controls.
5. **Individual reviewed mechanics:** implement a specific variant, recharge group, condition effect, item effect or vehicle operation only when its semantics and interactions are specified. Never treat the whole schema as executable game rules.

## 8. Schema availability is not import coverage

The current importer has 31 source kinds plus derived playable species. Its routes are defined in [content-schema-config.mjs](../../scripts/content-schema-config.mjs) and [content-discovery.ts](../../src/app/content/content-discovery.ts). Adapter 20 also imports reusable `itemEntry` templates and expands their explicit references using the fully materialized item's fields; equipment snapshots include the resulting descriptions.

Files visible in the repository or IDE are not automatically imported. In particular:

- `charcreationoptions.json` is not an enabled imported category merely because its schema exists. Separate creation-option records would need an explicit import/model scope.
- Standalone language definitions and traps/hazards are not current imported categories. Existing language proficiency grants are a different, supported structure.
- Vehicle upgrades are not included as a dedicated imported category. Valid but unsupported nonempty root arrays receive exclusion diagnostics.
- The schema graph includes dependencies and integration-specific fields beyond the supported application feature set.

For precise field names and schema branches, use the pinned schemas and [field inventory](content-schema-coverage.json). For what the app actually consumes today, use the [implementation coverage](SCHEMA_CONTENT_COVERAGE.md) and the relevant model/adapter, rather than treating the opportunities above as already implemented.
