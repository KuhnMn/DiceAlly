# Schema overhaul implementation coverage

This tracks implementation against [the plan](SCHEMA_ADAPTER_OVERHAUL.md).
The sections below record the migration in successive slices. The source-boundary
table is the initial inventory; later sections describe completed work. The latest
slice is adapter 21: typed status import and standard species reference precedence. Unused source payloads
and new rule/UI features remain outside the migration.

Manual browser acceptance for the agreed migration scope was confirmed by the user on 2026-10-21; see [the recorded results](#manual-browser-acceptance-2026-10-21).

## Source boundary

Full site/brew validation runs before core definitions enter staging and before
homebrew files are accepted or replayed. Index discovery validates its own contract.
Invalid input is rejected without coercing values, stripping fields, or supplying
defaults. The existing active revision survives a failed import.

The schema snapshot contains 44 site files and 91 brew files. The latter includes
one externally referenced Plutonium schema, independently pinned in the manifest.
`schemas/5etools/manifest.json` records exact checksums. Generated source declarations
preserve recursive references, unions, requiredness, and schema-permitted open maps.
Runtime validators enforce constraints TypeScript cannot express.

Large validator `.mjs` files are reproducible build outputs and are ignored by Git.
Their reviewed hashes and source declarations are checked in. Start/build/watch/test
hooks generate them from the local snapshot; `schemas:check` verifies both the
reviewed hashes and any generated files present on disk. This keeps about 13 MB of
generated code out of source reviews without removing any runtime validation.

`generated/gendata-tables.json` needs a local contract, declared in
`schemas/content/generated-tables.json`. It reuses upstream field definitions and
explicitly declares generated root groups, reprint/parent metadata, boolean flags,
optional ordinal identifiers, and nested path/section metadata. These differences
were checked against `5etools-src` commit
`90d343cde64cf8dce1083ea0525a6b0b9e545f2e` and its table generator; they do not widen
the ordinary table schema. Generated variant rules pass the ordinary rule schema.

| Content family | Source validation / storage | Remaining canonical and consumer work |
| --- | --- | --- |
| Classes, subclasses, class/subclass features | Full site/brew contracts | Typed feature references, ownership, level/casting/proficiency models, class wizard and snapshots |
| Spells | Full site/brew contracts; core sources overlay validated separately | Separate overlay/brew/Android decoders; canonical memberships, grant/selector/usage models; spell editors and snapshots |
| Feats, optional features, backgrounds | Full site/brew contracts | Typed ability/proficiency/prerequisite/optional-progression structures and feature editors |
| Races, subraces, playable species | Source contracts validated; existing materializer retained | Canonical movement/defense/ability models including weighted choices; species rules/editor/viewer and snapshot migration |
| Base items, items, groups, variants, type/property/mastery definitions | Full source contracts; existing materializer retained | Typed recipes, inheritance, mechanical item views, equipment/combat consumers; audit support for item entry definitions |
| Monsters and templates | Full source contracts; existing copy pipeline retained | Typed modifier modes, stat blocks, actions, spellcasting, and persisted snapshots |
| Conditions, variant rules, tables | Source contracts plus generated-table contract | Migrate existing consumers, descriptions, structured entries and reference traversal |
| Actions, facilities, diseases, objects, senses, skills, vehicles | Imported, validated, linked by existing supported entry traversal, and stored | Typed canonical records; no new editor/viewer workflows or game-rule automation |

The machine-readable [inventory](content-schema-coverage.json) lists each source
kind's site/brew schema, outer variants, fields and requiredness, plus direct model
consumers and field accesses. Regenerate it with `npm run schemas:audit`. It is a
starting inventory; it does not replace tracing helper aliases and projections.

## Compatibility and exclusions

Adapter 9 revisions record the schema graph identity. Appending/removing homebrew
on an old adapter or schema snapshot requires a fresh core import. The library page
reports this even if the source content commit has not changed. Old character
snapshots are untouched by this delivery; their canonical migration belongs to the
next slices. Old library records are not relabeled as schema-validated records.

Unsupported root arrays now produce structured exclusion diagnostics instead of
silently disappearing. `status`, `vehicleUpgrade`, item entry definitions and table
groups and legendary-group templates remain excluded unless subsequently brought into scope as dependencies.
The producer's nested group data is validated even when excluded from storage.

The speculative `_copy.mod` alias was removed; schema-validated input uses `_mod`.
The generic mapper and existing downstream shape checks otherwise remain until
their respective canonical migrations. Source validation does not establish that
all schema-valid mechanics can already be automated by the rules engine.

## Reproducible verification

Run these from the application repository:

```text
npm run schemas:generate
npm run schemas:check
npm run schemas:audit
npm run test:schemas
npm test -- --watch=false
npm run build
node scripts/probe-local-content.mjs <5etools-src/data> --baseline
node scripts/probe-local-content.mjs <5etools-src/data>
```

The baseline probe loads the content implementation from application `HEAD` through
a build plugin; it is useful while reviewing this delivery against adapter 8.
After merging, use the checked-in baseline result or an explicit old checkout for
historical comparisons. The probe reads the local corpus and writes metrics and
diagnostics only, never content files. Its bundle goes under ignored `.angular/cache`.

At content commit `90d343cde64cf8dce1083ea0525a6b0b9e545f2e`:

| Measurement | Adapter 8 baseline | Adapter 9 |
| --- | --- | --- |
| Imported files (excluding discovery indexes) | 159 | 165 |
| Stored records | 21,827 | 22,094 |
| Source bytes including indexes | 24,836,024 | 25,176,499 |
| Serialized record bytes | 48,379,631 | 48,779,329 |
| Diagnostics | 100 | 106 |

All existing per-kind record counts are unchanged. The 267 additions comprise
48 actions, 70 facilities, 29 diseases, 37 objects, 8 senses, 36 skills, and 39 vehicles.
Conditions and variant rules were already imported. Six additional diagnostics
report excluded root categories, rather than new unresolved rules.

The checked-in results are Node measurements with an in-memory cache. They do not
measure IndexedDB quota, peak browser memory, or phone performance. Raw generated
validator modules are about 5.55 MB for site and 7.47 MB for brew; full source
validation has a real worker cost. They load lazily and contain runtime helpers,
not Ajv's compiler. Canonical migrations and bundle/storage optimization still need
their own measurements before the final cutover.

Verification for this delivery passed the 90-file/453-test full application suite,
the subsequent additional homebrew test in its focused 11-test suite, six schema
tooling tests, artifact drift checks, worker TypeScript compilation, and the local
corpus probe. The production build passes with an initial total of 726.29 kB and
lazy validator chunks estimated at 183.76 kB (site) and 237.74 kB (brew) transferred.
It still reports the 520 kB initial-bundle and 4 kB editor CSS warning thresholds;
those budgets have not been raised. Browser import/storage benchmarks remain open.


## Species migration ? adapter 10

Playable species now have a validated, versioned `SpeciesDefinition` for movement,
ability alternatives, defenses, senses, sizes, and creature types. Those mechanical
fields are removed from the playable record's generic `data` payload. Source race
and subrace records remain available for provenance/materialization. Entries,
proficiency grants, spell grants, and other metadata still use their existing
payloads; this is a mechanical-field migration, not completion of every consumer.

Rules, species selection, native snapshot persistence, editor projection, and the
sheet movement/type presentation consume the canonical mechanics. Conditional and
alternate movement remains explicit. Conditional rates are not exported as always
active numeric speeds. Under-specified legal definitions retain their source and
explain why a rule handler or manual value is needed.

`ExportedCharacter` remains an all-in-one snapshot. Its species entity gains an
optional `definition` extension alongside the existing compatible display fields.
Existing Android snapshots without the extension remain readable. Native legacy
species snapshots migrate at load boundaries without library/network access;
instance IDs, source bindings, customization, notes, and resource usage survive.
Canonical extensions are validated at portable/local/cloud read boundaries.

Ability bonuses are stored and a pure helper is tested, but live calculations do
not call it. Manual scores govern HP, prerequisites, statistics, and export, even
when a historical opt-in flag or derived bonus is present.

The adapter-10 probe against the same pinned content commit passes: 165 files,
22,094 records (including 258 playable species), 48,846,259 serialized record bytes,
and 106 diagnostics. That is 66,930 additional serialized bytes compared with
adapter 9, with unchanged record counts and diagnostics. This measures Node
serialization; browser storage/memory and interactive import acceptance remain
unmeasured.

The production build passes at 773.44 kB initial raw size (177.73 kB estimated
transfer), versus the earlier 726.29 kB initial measurement. The species model and
small canonical validator now participate in viewer/persistence paths. Existing
520 kB initial and 4 kB editor CSS warning thresholds remain unchanged and still
warn. Source validators remain lazy (183.76/237.74 kB estimated site/brew transfer).
The full application suite passes: 91 files, 466 tests. Worker TypeScript compilation,
schema drift checks, and all six schema tooling tests pass. Automated offline coverage
includes selection choices, legacy migration, local save/reopen, sheet projection,
and cloud encode/decode without network access; it is not a browser interaction test.

## Class/subclass migration scope (implemented below)

Migrate class identity/parent linkage, hit dice, feature references and levels,
spellcasting progression, and starting/multiclass proficiency packages through a
canonical contract. The main entry points are `feature-rules.ts`, `class-preview.ts`,
`optional-progression.ts`, `proficiency-rules.ts`, and editor wizard/projection code.
Feature descriptions and spell/proficiency grant contracts cross family boundaries:
keep their existing handlers explicit until their own migrations are ready rather
than declaring the entire class family complete after adding outer types.

Preserve stable selection/feature identities and spell-owner identities, explicit
subclass inheritance rules, offline snapshots, player annotations, and resource
usage. Cover schema-valid feature reference variants, subclass overrides, malformed
parents, multiclass HP/caster progression, optional progression choices, and repeated
recalculation before switching consumers. Automatic species ability adjustment stays
out of scope for this family too.


## Classes and subclasses ? adapter 11

`ClassDefinition` version 1 covers `class`, `subclass`, `classFeature`, and
`subclassFeature`. It provides named parent/subclass identity, feature levels,
feature references with resolved keys and retained UID/wrapper metadata, hit dice,
saving throws, primary-ability alternatives, casting metadata, starting/multiclass
proficiency packages, and optional feature progression. Migrated fields are removed
from generic record data. Missing hit dice remains missing; import does not invent
a die simply to make an otherwise valid class selectable by the rules engine.

The canonical JSON Schema reuses selected fields from the pinned upstream brew
contract, which covers the corresponding site proficiency and casting structures.
The generated standalone validator is 96,548 bytes and adds no schema compiler to
the browser. Multiclass proficiency grants move into the contract; multiclass
requirements and description entries stay in the original payload. This avoids
pulling the full recursive entry schema into the synchronous canonical validator.
Full site/brew source validation still checks the entire imported document.

Canonicalization runs after copy resolution and before linking/activation. Copy
inheritance from an installed canonical class reconstructs upstream mechanical
fields at that boundary, so homebrew copies retain hit dice/proficiencies/features.
Canonical parent keys and feature UID/key pairs are checked for consistency.
Unknown versions and duplicated legacy mechanical fields fail snapshot validation.
Adapter 11 and the updated schema ID require a new library import.

Migrated consumers include class feature derivation, HP/caster inputs, optional
progression, class proficiency grants, casting source metadata, wizard previews,
class/subclass selectors, feature catalog filtering/search/ordering, legacy Android
feature matching, native snapshot persistence, and portable feature projection.
Saving-throw grants still apply only to the starting class. Structured armor,
weapon, and tool grants take precedence over display prose. Display proficiency
wrappers use their explicit `proficiency` field; optional weapons are not granted
without a handler. Wildcard timing, required optional-feature selections, and
unknown progression extensions remain preserved and explicitly unsupported by the
existing automation. The migration does not infer their game rules.

Native snapshots migrate class-family records at load boundaries, including
already acquired feature instances. New native saves carry canonical snapshots.
Portable `ExportedCharacter` retains its existing self-contained format: class
feature entities receive conventional `className`, `classSource`, subclass, level,
and description fields at projection time. The viewer needs no content-library
lookup and no additional class-specific extension. Species ability automation
remains disabled; primary-ability metadata does not change manual scores.

At content commit `90d343cde64cf8dce1083ea0525a6b0b9e545f2e`, adapter 11 passes the
165-file/22,094-record probe with 30 classes, 330 subclasses, 677 class features,
and 1,499 subclass features. Counts and the 106 diagnostics are unchanged.
Serialized records total 49,561,821 bytes, 715,562 more than adapter 10. Resolved
identities and the explicit contract have a storage cost; this stage does not claim
storage savings. Measurements remain Node serialization, not IndexedDB quota or
browser memory.

The production build passes at 877.11 kB initial raw size (189.93 kB estimated
transfer), with unchanged warning budgets. The canonical validator participates in
synchronous cache/native snapshot paths; source validators remain lazy. Schema
artifact checks, all six tooling tests, worker TypeScript compilation, and the
application suite (92 files, 474 tests) pass. Dedicated integration coverage checks documented UID
defaults, wrapper preservation, invalid canonical identities, subclass casting,
proficiencies, stable optional-slot IDs, canonical catalog filters, homebrew copy
inheritance, legacy native feature migration, and offline local/cloud round trips
with retained instance IDs, customization, notes, and spent resources.

Remaining work in the first planned family includes feats, optional features,
backgrounds and their shared prerequisite/proficiency/spell-grant payloads. Class
entries, tables, equipment, feat/mastery progression, and other metadata remain
source-shaped until their corresponding shared contracts migrate. Browser
interaction/import-storage benchmarks also remain open.


## Feats, optional features, and backgrounds ? adapter 12

Focused migration of the fields already used for selection: prerequisites, feat
category, optional-feature types, and skill/language/tool/armor/weapon proficiency
packages. `CharacterOptionDefinition` uses the generated upstream field types and
validators; migrated fields are removed from generic record data. Existing optional
feature checks, catalog filters, background proficiency choices, copy inheritance,
native snapshot migration, and portable projection now use those explicit fields.
Choice/instance IDs and the Android-compatible exported shape remain unchanged.

This adds no automation, UI, or prerequisite handlers. Ability metadata, spell
grants, descriptions, equipment, and other fields remain in their existing payloads.
Manual ability scores remain authoritative. Remaining category migrations continue
with the same restriction: migrate existing consumers rather than expand features.

The corpus probe still passes with 165 files, 22,094 records and 106 diagnostics
(including 305 feats, 221 optional features and 175 backgrounds). Serialized records
are 49,621,845 bytes. The shared class/option validator is 214,747 generated bytes;
the production build passes at 997.29 kB initial raw size (198.75 kB estimated
transfer). Warning/error budgets are unchanged. Adapter 12 requires reimport.

Verification passes: 93 application test files / 479 tests, six schema tooling
tests, artifact drift checks, worker TypeScript compilation, and production build.
Focused regressions cover unchanged choice/instance identities, prerequisite
behavior, native migration, conventional exports, and copied background grants.


## Spells ? adapter 13

`SpellDefinition` now carries level, school, casting times, range, components,
durations, ritual/technomagic metadata, spell attacks, and class memberships using
pinned upstream field types and validation. Existing spell filters, wizard/catalog
selection, casting costs, native snapshots, update previews, copy inheritance and
portable projections read these fields. Generic record data no longer duplicates
them. Historical snapshots may omit presentation fields; no defaults are invented.

Inline memberships and the `sources.json` overlay have separate explicit input
profiles. Variant `definedInSource` and subclass metadata are preserved; runtime
filters use the canonical lists. Flat Android lists are supported at the legacy
boundary, and portable spell entities still export their conventional flat class
list. No casting effects, ability adjustments, UI, or additional-spell grant rules
were added. Entries, higher-level entries, scaling/damage metadata and the shared
`additionalSpells` handler remain unchanged.

The unchanged bounded JSON portability helper was separated from native document
validation so startup persistence/cloud code does not eagerly load native spell
validators. This was necessary to keep the existing bundle error budget; no budget
was raised. The production build passes at 991.52 kB initial raw size; warning
thresholds remain exceeded. The standalone spell validator is 39,826 bytes.

The corpus probe passes with all 969 spells, 22,094 total records and the same
106 diagnostics. Serialized records total 49,678,863 bytes. Five focused regressions
cover schema alternatives, exact membership profiles, malformed contracts,
canonical copying, and offline save/reopen/cast/export with preserved instance IDs,
notes, customization and slot usage. The full application suite passes 94 files /
484 tests; schema tooling, artifact drift and worker compilation checks pass.
Adapter 13 requires a fresh library import.


## Items and equipment ? adapter 14

Playable items gain a validated `ItemDefinition` for the fields used by current
inventory/equipment consumers: type/rarity, attunement, armor and weapon statistics,
bonuses, weight/value, equipment flags, and property/mastery UIDs with their notes.
These fields are removed from generic record data after existing materialization.
Base items, groups, variant recipes, and supporting type/property/mastery records
remain source-shaped materialization inputs; their descriptions are unchanged.

Inventory projection reconstructs the existing self-contained `DisplayItem` format.
Tool lookup, type selection, native snapshot migration/update comparisons and sheet
property access use explicit fields/types. Copying an installed canonical item
restores source fields before the existing inheritance/materialization pipeline.
Existing armor rules, quantity, equipment/attunement flags, notes and use counters
are preserved. This adds no equipment effects, automation, or UI. Attunement keeps
the existing boolean-to-string/null materialization policy.

Verification passes: 95 application files / 488 tests, six schema tooling tests,
artifact checks, worker compilation and production build. Four focused regressions
cover canonical mechanics, malformed snapshots/update reporting, copied item
resolution and offline inventory save/export. The corpus retains all 9,119 playable
items, 22,094 total records and 106 diagnostics; serialized records total 49,961,552
bytes. The standalone item validator is 46,639 bytes. Initial build size is 991.75 kB
(195.34 kB estimated transfer); existing warning thresholds still warn, and budgets
are unchanged. Adapter 14 requires reimport.


## Monsters ? adapter 15

`MonsterDefinition` covers existing catalog/projected stat fields: size/type,
alignment, AC/HP, movement, initiative, ability scores, senses/passive perception,
languages, CR and defenses. Migrated fields are removed from generic record data.
Schema-valid special HP, nonnumeric/null scores, conditional movement and nested
defenses are preserved. The existing detached entity projection retains its type
wrapper and numeric-speed policy; this adds no new stat-block rendering or rules.
Actions, traits, spellcasting, save/skill maps with special entries, and other
shared payloads remain unchanged and source-shaped.

Copy/template inheritance reconstructs source stat fields for installed canonical
monsters. Native snapshot migration and content-update comparisons use the new
contract. Portable exports remain self-contained in the existing monster shape;
HP trackers are still manually enabled, with notes, usage, current/temp HP and
custom maximum HP preserved independently of the stat block.

All 96 application files / 492 tests pass, along with six schema tooling tests,
artifact checks, worker compilation and production build. Four focused regressions
cover schema alternatives, malformed contracts/update reporting, copying with a
template, and offline save/export with retained play state. The corpus still has
4,574 monsters, 22,094 total records and 106 diagnostics; serialized records total
50,117,068 bytes. The standalone monster validator is 111,389 bytes. Initial build
size remains 991.75 kB (195.37 kB estimated transfer), with unchanged budget warnings.
Adapter 15 requires reimport.

### Shared additional spell grants

The `additionalSpells` accessor now uses generated source types and a standalone validator compiled directly from the pinned `util-additionalspells.json` contract. The linker, spell preview, and wizard use that shared boundary; block names, ability choices, and grant lists use explicit typed fields. The source-shaped payload remains in `data.additionalSpells`, avoiding a duplicate representation or export conversion. No adapter-version bump or new reimport is required for this step.

Historical native snapshots may represent absent grants as `null` or `[]`; the accessor treats those as absence. Other malformed structures are rejected. Explicit choice counts belong inside `choose` when using `choose.from`; synthetic tests now follow the source schema. Stable grant paths, selection IDs, supported recharge behavior, and unsupported-mechanic diagnostics remain unchanged. The inner grant walker is covered by the follow-up below; shared entry payloads remain separate migration work. This step does not add spell automation.

Verification: the local corpus still passes with 165 files, 22,094 records and 106 diagnostics. Source artifacts, six schema tooling tests, worker compilation and production build pass. Initial bundle remains 991.75 kB with the existing budget warnings.

Application verification: 97 test files / 495 tests pass. One initial run failed an unrelated proficiency-search UI assertion; the complete rerun passed.

### Schema-defined grant traversal

The spell rules and content linker now share traversal of the validated additional-spell level union: a direct entry list or the declared frequency groups. Entries are spell UIDs, filter selectors, or explicit `choose.from` choices. The rules and choice parser no longer accept arbitrary recursive objects or speculative `spell`/`casts` wrappers; those are absent from this schema. The separate attached-spell linker retains its existing handling.

Level and recharge maps receive explicit value types at the validated accessor boundary, where the generated declarations use `unknown` for pattern properties. Source order, reference paths, choice IDs, grant IDs, recharge usage keys and saved instance customization are preserved. Schema-valid `limited` groups remain linkable imported data but block automatic spell previews, including empty groups; unsupported symbolic usage counts retain their existing diagnostics. No grant types, UI, export changes, adapter bump or reimport were introduced.

Verification: all 97 application test files / 497 tests pass; application and worker TypeScript compilation, local corpus probe and production build pass. The corpus remains at 22,094 records / 106 diagnostics and initial bundle at 991.75 kB, with existing budget warnings.

## Shared proficiency grants, descriptions and attached spells ? adapter 16

Species proficiency fields now use a shared validated source accessor with explicit skill/language/tool/armor/weapon attributes. Character-option proficiencies reuse those source types and field names. The rules separate schema-defined object packages from class display strings/wrappers; the old arbitrary recursive proficiency parser is removed. Package selection, fixed-before-choice ordering, nested answer paths, exact tagged-item resolution, manual grants and unsupported-filter diagnostics are preserved. Proficiency ranks and ability-score automation are not added.

Descriptions use the generated full source entry union alongside existing Android entry forms. Catalogs no longer cast raw entry arrays or bypass template typing. Higher-level descriptions accept the schema's full entry alternatives while retaining Android wrappers without a type discriminator. Source integer cells, including zero, can pass through the existing renderer. Table/unsupported entry payloads remain intact; unsupported renderable kinds retain the existing fallback presentation. Nested and structured references use a shared traversal, including higher-level descriptions. Generic JSON traversal is intentionally retained for open metadata and auxiliary presentation trees; it does not infer entry kinds from property names.

The full source validators already deeply validate entry trees before staging. A second standalone entry validator would duplicate roughly 4 MB of recursive generated code, so renderers use source types and the existing import validation, with a lightweight outer-array guard for record access. This is not a new complete validator for historical Android entry payloads.

Attached spells now validate against the pinned `itemAttachedSpells` contract and link both flat UID lists and the declared usage groups (`rest`, `daily`, `limited`, `charges`, `resource`, `will`, `ritual`, `other`). Ability/resource metadata is excluded from reference discovery. The generic spell-reference walker is removed. Usage-group references and higher-level description references are now stored, requiring a library reimport under adapter 16. No item casting automation, selectors or export format changes are introduced. Saved characters retain their self-contained snapshots.

Scope: requested items 1?3 only. The broader condition/variant-rule/table consumer cleanup remains deferred; unused metadata and materialization inputs remain source-shaped.

Verification: 99 application test files / 502 tests pass, with six schema tooling tests, artifact drift checks, application/worker compilation and production build passing. The adapter-16 corpus probe retains 165 files, 22,094 records and 106 diagnostics; serialized records total 50,421,025 bytes after the added reference links. Initial build remains 991.75 kB with unchanged budget warnings. Standalone proficiency/attached-spell validators are 60,459 / 14,511 bytes.

## Final existing-consumer cleanup - adapter 17

Completed the deferred cleanup without adding condition/variant-rule UI. Imported conditions and variant rules already use the shared validated entry contract and inline-reference linker; the sheet condition picker uses the character export enum and authored effects independently of imported definitions. No dedicated imported-category selector was added or remapped.

Standalone table captions, labels, rows, footnotes, intro/outro and nested tables now use explicit source presentation fields for description-reference traversal. Condition/variant-rule/spell/item links retain exact publication resolution and optional description scope. The renderer's entry helpers now declare the generated source variants alongside the Android variants, including optional legacy fields absent from a source branch. The remaining feature/spell catalog template casts were removed, as was a redundant monster bonus-action cast. Playable item detection uses the materialization marker rather than a speculative raw `items` property.

Spell-owner routing now uses one shared payload-presence helper; malformed payloads still reach validation and block acceptance. The nonexistent upstream `ritualCasting` field no longer establishes automatic capability. Newly created casting sources default to false; explicitly configured saved source capability remains intact. Historical nonclass casting metadata and Android entry discriminators remain confined to compatibility helpers so saved/manual declarations continue working. Mechanical projection casts at the portable export boundary and generic JSON traversal of schema-permitted open metadata remain intentional.

All 99 application test files / 503 tests pass, plus six schema tooling tests, generated artifact checks, application/worker compilation and production build. Initial bundle remains 991.75 kB with existing budget warnings. The corpus retains 165 files / 22,094 records; serialized records total 52,666,252 bytes after table links. All 184 diagnostics are warnings: the 78 additional warnings come exclusively from generated-table descriptions, which were previously unscanned. No import errors were introduced. Adapter 17 requires reimport to rebuild these links; saved character exports remain self-contained and species ability automation remains disabled.

## Post-migration redundancy and style review

Removed five unused imports and three unreferenced source type aliases. Native dependency snapshots now share one explicit canonicalization switch between document validation and stored-draft loading. Document validation performs its initial bounded canonical serialization once instead of twice. Repeated default-validator compilation/bundling/declaration emission now uses one generator helper; reviewed generated artifacts remain byte-identical. Redundant null checking after a validated accessor was removed, spell-choice count handling was flattened, and migration helper spacing/signatures were normalized without adding a formatter dependency.

Application and worker builds pass TypeScript's additional `noUnusedLocals` and `noUnusedParameters` checks. All 99 application files / 503 tests and six schema tooling tests pass. The corpus remains at 22,094 records, 184 warnings and 52,666,252 serialized bytes. No source contract, export format or adapter-version change is needed; adapter 17 remains current.

Production build also passes at 991.75 kB initial size with the existing budget warnings; budgets are unchanged. Temporary migration verification logs were removed.

## Initially standalone object, condition, sense and skill definitions

Dedicated `ObjectDefinition`, `ConditionDefinition`, `SenseDefinition` and `SkillDefinition` models now exist alongside the generated source types. Their version-1 definitions retain explicit pinned source attributes, descriptions and metadata. Objects retain special/numeric AC and HP, conditional movement, stats/defenses and action descriptions; omitted description/action arrays become empty arrays. Skill ability remains optional and is never inferred. Conditions and senses describe reference data independently of active effects, proficiency state or sense ranges.

`reference-content-adapter.ts` provides pure factories returning detached copies of already source-validated definitions. Copy instructions must be resolved first; the factories explicitly reject `_copy`. The source graph already supplies deep validation, so no duplicate validators or guessed alternate shapes are introduced.

These models/adapters are deliberately standalone. Existing imported records remain source-shaped; no new `ContentRecord` fields, import mapping, character snapshots, rules, selectors or rendering workflows consume them yet. No adapter-version or reimport change is required. This preserves all imported source data while making explicit application definitions available for later integration.

Verification: all 100 application files / 507 tests pass, including full-source validation of synthetic definitions, source alternatives, detached nested data and unresolved-copy rejection. Application/worker compilation also passes with unused-code checks enabled.

Production build passes with unchanged bundle size and existing budget warnings.

## Typed reference-category import storage - adapter 18

All nine categories now have dedicated definitions and run through import storage: objects, conditions, senses, skills, actions, bastions (`facility` upstream), variant rules, diseases and vehicles. The five additional models are `ActionDefinition`, `BastionDefinition`, `VariantRuleDefinition`, `DiseaseDefinition` and `VehicleDefinition`; vehicles preserve the source subtype union. The four previously standalone models are now connected as well.

After source validation and copy/materialization, records receive a version-1 `referenceDefinition`, discriminated by `kind`. It contains the typed source attributes and metadata, with explicit object description/action arrays. The source payload is removed from generic `record.data`, leaving only generated copy provenance. A source-data projection restores conventional fields for inheritance and reference linking. Original source identity is retained separately from outer display labels, preserving homebrew variants. No selectors, rules, character-state models or rendering workflows were added.

Resolved records are revalidated using generated selectors into the exact pinned site or brew schemas. Import provenance selects the profile; no fallback guessing or widening is performed. This preserves site publication flags (such as `srd` and `srd52`) alongside their distinct homebrew metadata types. The selectors share the existing lazy full-schema modules, avoiding another copy of the recursive entry graph. Copying installed canonical objects/skills into homebrew reconstructs the source before applying the existing inheritance policy and validating the result.

Verification passes: all 101 application test files / 510 tests, seven schema tooling tests, generated artifact checks, application/worker compilation with unused-code checks, and production build. Tests cover all nine core/homebrew stored kinds, cache reopen, idempotence, payload deduplication, metadata preservation, malformed definitions, description references and copying installed canonical definitions. The corpus imports 22,094 records, including 542 typed reference definitions: 37 objects, 30 conditions, 8 senses, 36 skills, 48 actions, 70 facilities, 245 variant rules, 29 diseases and 39 vehicles. Warnings remain at 184; serialized records total 52,698,302 bytes. The initial bundle remains 991.75 kB with existing budget warnings.

Adapter 18 and the new schema-selector identity require a fresh library import. Existing character exports remain self-contained and unchanged; there is no new game-rule or UI integration for these categories.

## Importer logic audit (adapter 19)

The follow-up audit fixed four issues:

- Rebuild computed links against the current index when replaying cached records, preserving deferred queries and removing stale alias targets. Keep structural and derivation links.
- Preserve differing ordered arrays as labeled homebrew alternatives. Only supplementary `miscTags` retain subset merging; progression order is never treated as a set.
- Discover monster templates after retained homebrew is staged during a full library import, so homebrew-only template dependencies are fetched from the pinned core commit.
- Reject homebrew append when the installed library belongs to another branch, even when repository and directory match.

Adapter 19 requires a fresh library import. Character snapshot formats and ability-score automation behavior are unchanged.

Verification: 514 application tests, seven schema tooling tests, generated-schema drift check, application/worker TypeScript unused checks, and production build pass. The build retains the existing initial-bundle and stylesheet budget warnings. The local corpus probe imports 165 files and 22,094 records, including 542 typed reference definitions; its 184 reference diagnostics remain warnings. These results verify the supported import/adaptation pipeline, not automatic implementation of every rule described by imported content.

## Priority reference and item-entry fixes (adapter 20)

Explicit publication references remain authoritative. When generated aliases under that publication collide, the linker prefers a unique base item from the requested publication's rules edition. Thus `+1 Lance|XDMG` selects the XPHB-based item, while `+1 Lance|DMG` selects the PHB-based item. Both versions remain stored. A sole older candidate remains usable; multiple candidates within the preferred edition remain ambiguous rather than being selected arbitrarily. Direct published identities still take precedence over generated aliases.

Unqualified core-book defaults follow the referring record's edition, with the classic default retained when the revised target is missing. Explicit `edition` markers override publication-date classification for ordinary records. For generated variants, the recipe publication supplies reference context and the base publication supplies candidate edition. Known book/adventure dates are reviewed metadata pinned to source commit `90d343cde64cf8dce1083ea0525a6b0b9e545f2e`; the revised era starts with the XPHB publication on 2024-09-17. Unknown publications without an explicit edition do not acquire an invented date or edition. Refresh metadata intentionally with `node scripts/snapshot-source-publications.mjs E:/5etools-src`; the output records source commit and input checksums. No live date or source-name guessing is used.

`itemEntry` is now a supported source kind under the existing full site/brew validation boundary. All 13 core definitions are stored. Explicit `{#itemEntry Name|Source}` references expand after item inheritance and variant generation, when item-specific resistance and detail fields are available. An omitted template publication defaults to DMG according to the source reference convention. Expansion preserves ordering and nested entry structure, substitutes `item.*` properties and the defined `getFullImmRes` formatter, and records template provenance. Missing definitions/properties, cycles, unsupported functions and excessive expansion fail finalization atomically. Raw installed homebrew documents remain available for replay; exported item snapshots carry expanded text. No new editor controls or rule automation are added.

Verification: 523 tests across 102 files, seven schema tooling tests, generated-schema checks, TypeScript checks with unused declarations enabled, and production build pass. The build retains its existing initial-bundle and editor CSS warnings. The corpus imports 22,107 records across 165 files. All 128 ambiguous item-reference warnings are resolved; the itemEntry exclusion warning is removed. Remaining warnings total 55: ten species ambiguities, three table links, 36 unknown prices, five excluded categories and one file without supported content. Character snapshot formats are unchanged; adapter 20 requires a fresh library import.

## Status storage and standard species references (adapter 21)

Statuses now use their exact pinned `conditionsdiseases.json#/$defs/status` contracts for site/brew validation and the same typed import-storage pipeline as other references. `StatusSource` / `StatusDefinition` retain descriptions and source-profile metadata without creating active sheet state. All five core records are imported: Bloodied (XPHB), Concentration (PHB and XPHB), and Surprised (PHB and XPHB). `{@status ...}` links resolve within the separate status category, including edition-aware defaults. Homebrew imports persist and reopen these definitions without a duplicate raw payload. No UI or status-effect automation is added.

A species alias shared by a base-derived species and its unnamed standard subrace now resolves to the standard playable form. The preference uses the exact `parent-species` provenance link, not names or arrival order. Both records remain stored, a base-only reference still works, and named variants retain their own references. Unrelated or competing standard definitions remain ambiguous. This resolves all ten warnings in the PHB Random Height and Weight table and Reincarnate descriptions.

Verification: 527 tests across 102 files, seven schema tooling tests, generated-artifact checks, application/worker TypeScript checks with unused declarations enabled, and production build pass. The existing build-budget warnings remain. The local corpus imports 22,112 records across 165 files, including all five typed statuses. Remaining diagnostics total 44: 36 expected unknown-price notices, three missing table-group links, four excluded-category notices and one file without supported content. Unknown prices are intended data, not missing functionality. Adapter 21 requires a library reimport; self-contained character formats and manual ability-score behavior are unchanged.

## Manual browser acceptance (2026-10-21)

The user reported the following checks as working in the browser after the adapter 21 migration and the share-code fix. These are user-reported manual results, separate from the automated test suites and Node corpus probes above.

| Check | Reported result |
| --- | --- |
| Content import | Working. |
| Basic character creation | Working. |
| Content correctness | Samples of every type of content checked and reported correct. This is sample-based acceptance, not exhaustive coverage of every record or schema branch. |
| Character export and import | Working. |
| Saving without an internet connection | Working. |
| Sync | Working. Share-code creation was also explicitly confirmed working after the fix. |
| Browser performance and storage | Accepted by the user as satisfactory. Reported storage: **107.5 MB used / 953,176.0 MB browser allowance**, for the **entire site**. |

The storage figure is the browser's site-wide usage/quota display, not an importer-only IndexedDB measurement, JavaScript bundle size, or memory measurement. Browser/device details and numerical import/startup timings were not recorded.

The agreed migration scope is accepted. The remaining excluded categories (`tableGroup`, `itemTypeAdditionalEntries`, `vehicleUpgrade`, and `legendaryGroupTemplate`) were explicitly accepted as out of scope for now. Unknown item prices are intended data and require no fix. Existing bundle/CSS budget warnings remain documented; this acceptance does not add new sheet functionality or enable automatic species ability-score adjustments.
