# Android parity inventory

Milestone 1, inspected 2026-10-14. This is a source-code audit, not a claim that the Android app was executed. Expected outputs are distinguished from observed code behavior in [PARITY_CASES.md](PARITY_CASES.md). The persistence design is in [CHARACTER_DOCUMENT.md](CHARACTER_DOCUMENT.md).

Android paths below are relative to `C:/Users/maxim/AndroidStudioProjects/DnDAlly2/app/src/main/java/com/ltx/`. Web paths are relative to this repository. M2-M8 refer to the milestones in `IMPLEMENTATION_PLAN.md`.

## Workflow matrix

| ID | Workflow and observed Android source | Web coverage and required work | Milestones |
| --- | --- | --- | --- |
| P01 | GitHub/file compendium import, primary/secondary paths: `dndally/MainActivity.kt:402`, `data/SettingsRepository.kt` | Character import exists; content importer absent. Configurable source, progress, staging, linking, reimport | M2 |
| P02 | Compendium browsing/filtering, detail views: `dndally/compendium/list/*`, `detail/*`, `CompendiumViewModel.kt` | Sheet renderer exists; add independent library browsing, source filters, linked detail navigation | M2, M4 |
| P03 | Nine creation pages: `character/CreateCharacterScreen.kt:216` | Add name/vitals, abilities, resources/currency, skills, saves, other proficiencies, feature sources, spell slots, tab settings | M3, M4 |
| P04 | Class/subclass selection, ordered multiclass levels: `ClassAndSubclassManagementScreen.kt`, `CreateCharacterViewModel.kt:221` | Absent; preserve selection order, levels, subclass relationship, and application toggles | M3, M4 |
| P05 | Apply classes: `CreateCharacterViewModel.kt:343` | Add HP/hit dice, starting/multiclass proficiencies, level-gated features, casting/general sources, additional spells, combined/pact slots | M3 |
| P06 | Save/load creator for editing: `CreateCharacterViewModel.kt:913`, `:1068` | Sheet saves exist; retain all creation inputs and preserve current HP/notes/usage during edits | M4 |
| P07 | Species linking: `CharacterDetailViewModel.kt:663` | Display exists; add selection/replacement, speed/darkvision/resistance effects and editable uses/notes | M3, M4 |
| P08 | Known/prepared/spellbook selection, source grouping, move/copy list membership: `management/SpellManagementViewModel.kt:50` | Display/uses/notes exist; add/remove spells, list changes, spellbook mode, free-use editors | M3, M4 |
| P09 | Class features, feats, optional features: `management/FeatureManagementViewModel.kt:53` | Display/uses/notes exist; add/remove entities per feature source and edit resource definitions | M3, M4 |
| P10 | Feature sources with ability flags, attack/DC override, spellbook, manual slots: `data/CharacterEntity.kt:175`, creator pages 7/8 | Add source editor and stable source IDs; names become labels rather than identity | M3, M4 |
| P11 | Inventory add/remove, counts, multiples, equipped/attuned flags, uses/notes: `management/InventoryManagementViewModel.kt:28` | Equipment display exists; complete management parity and generated AC/item bonus integration | M3, M4 |
| P12 | Custom item creation from base item/edition: `compendium/CreateItemViewModel.kt:91`, `:160` | Absent; private local authored records plus selected snapshots; no public compendium hosting | M2, M4 |
| P13 | Monsters add/remove, enabled health, current/max/temp HP and override: `management/MonsterManagementViewModel.kt`, `MonsterHealthManagementViewModel.kt` | Display/session edits partially exist; add management and independent instance identity | M3, M4 |
| P14 | Damage/heal/temp HP, max HP override, death saves, hit dice: `management/HealthManagementViewModel.kt:37` | Existing sheet state editing; reconcile bounds and effective max HP | M3, M4 |
| P15 | Inspiration, rounds, predefined/custom conditions: `CharacterDetailViewModel.kt:499`, `:793` | Existing controls; preserve behavior and string custom effects | M3, M4 |
| P16 | Long/short rest: `CharacterDetailViewModel.kt:550`, `data/CharacterCompendiumData.kt:257` | Existing `rest.service.ts` differs; unify with documented Android policy | M3, M4 |
| P17 | Skills/saves, initiative, attacks/DC, AC and equipped/attuned item bonuses: `CharacterDetailViewModel.kt:158`, `:825`, `:1410` | Helpers/display exist; audit formula parity and explicit overrides | M3 |
| P18 | Currency, advantages/disadvantages, resistances, senses, movement | Sheet display/state partial; creator/manual editing for every serialized field | M3, M4 |
| P19 | Notes add/edit/delete/reorder: `CharacterDetailViewModel.kt:1097` | Notes UI exists; retain order and identity through save/share | M4 |
| P20 | Combat actions add/edit/delete/reorder with linked resources: `CharacterDetailViewModel.kt:1131`, `data/CharacterCombatAction.kt` | Display exists; complete editor and portable instance links | M4 |
| P21 | Portrait selection, tab visibility, theme/source preferences: creator, `SettingsRepository.kt`, `SettingsScreen.kt` | Themes/portrait URL exist; portable portrait metadata, account preferences, per-character tabs | M4, M5 |
| P22 | Character list/delete, full file export/import, duplicate decisions: `CharacterListViewModel.kt`, `CharacterRespository.kt` | Existing local library/import/export; explicit legacy reconstruction, new document export, tombstones | M4, M5, M6 |
| P23 | Minimal compressed QR/state import: `data/MinimalExportedCharacterSheet.kt`, `MainActivity.kt` | QR/minimal generation exists; preserve distinct state-update semantics and ambiguity handling | M4, M7 |
| P24 | Worker code/full export transfer: `AllyShareAPI.kt`, `CharacterListViewModel.kt:137` | Existing temporary sharing; authenticated copy-only protocol with fresh IDs | M7 |
| P25 | New web requirements: membership, offline sync, explicit content updates | No Android-equivalent requirement assumed; ownership, compare-and-save, previews, conflicting-version choices | M4-M8 |

## Import dependency inventory

`MainActivity.kt:1157` maps primary content using `convertJsonTo*` and `toEntity`, with category upserts in `data/UpsertUtility.kt`. One file may contain several categories; dispatch all applicable categories.

| Upstream root/category | Mapping/output | Dependency / important behavior |
| --- | --- | --- |
| `spell` | `Spell.kt` -> `SpellEntity` | Secondary `spells/sources.json` overlays class/subclass memberships after spells exist |
| `classFeature`, `subclassFeature` | `Feature.kt` -> `FeatureEntity` | Type + parent class/subclass + level are identity qualifiers; parser filters `_copy` proxies |
| `feat`, `optionalfeature` | Corresponding model/entity mappings | Retain structured entries, prerequisites, optional progression metadata |
| `class`, `subclass` | `RPGClass.kt`, `RPGSubclass.kt` -> entities | Link feature reference strings/objects; copied subclasses are processed in secondary pass |
| `race`, `subrace` | `Species.kt` -> `SpeciesEntity` | Primary base records; secondary copies/subraces inherit/modify parent records |
| `baseitem` | `BaseItem.kt` -> base entity AND playable item entity | Required before magic items/groups/variants; do not confuse the two namespaces |
| `itemType`, `itemProperty`, `itemMastery` | Corresponding mappings | Abbreviations/name links for item enrichment and display |
| `item`, `itemGroup` | `Item.kt`, `ItemGroup.kt` -> playable items | Resolve `baseItem` name/source links after base items |
| `magicvariant` | `MagicVariant.kt` plus secondary generation | Requirements/exclusions/inherited fields generate derived items; bound expansion and deduplicate |
| `monster` | `Monster.kt` -> `MonsterEntity` | Structured actions/spellcasting/entries and references; character instances remain separate |
| `condition`, `variantrule`, `table` | Corresponding mappings; tables use variant-rule representation | Browse/reference content; preserve category distinction even if Android merges tables/rules |

Secondary processing begins at `MainActivity.kt:566`; species copies at 772, subraces at 861, subclass copies at 940, spell source overlay at 993. Imports launched via lifecycle coroutines are not a portable sequencing contract: the web importer must await completion of dependency passes.

Category discovery was checked against the actual upstream files:

- [class/index.json](https://raw.githubusercontent.com/5etools-mirror-3/5etools-src/main/data/class/index.json): class slug -> relative file name.
- [spells/index.json](https://raw.githubusercontent.com/5etools-mirror-3/5etools-src/main/data/spells/index.json): publication source -> relative file name.
- [bestiary/index.json](https://raw.githubusercontent.com/5etools-mirror-3/5etools-src/main/data/bestiary/index.json): publication source -> relative file name.

These indexes do not constitute a complete root manifest. Fixed supported root files and secondary dependencies still need discovery/fallback configuration. Fetch at one resolved commit in M2; this audit read the current `main` indexes without pinning an implementation fixture.

## Observed gaps and migration decisions

| Finding | Evidence | Decision for web |
| --- | --- | --- |
| Full exports omit class selections, initiative override, portrait URI, tab visibility, content revision | `ExportedCharacterSheet.kt`; repository export at 376 | Preserve original export; mark creation incomplete until confirmed. Never guess exact class levels from feature names |
| Tool proficiency values are Room numeric IDs | `CharacterEntity.kt`, `CharacterProficiencies.tools` | Replace with stable content references; retain unmappable legacy values as unresolved metadata |
| Inventory/species exports lack complete manual/generated provenance | Exported item/species types | Import origin as unknown, protect from automatic cleanup until user confirms |
| Feature parser ignores `_copy` records; subclass copy inherits only feature list | `Feature.kt:115`; `MainActivity.kt:940` | Explicit unsupported-copy diagnostics; implement tested resolver semantics in M2 rather than silently omitting records |
| Missing feature lookup can silently skip; spell lookup may fall back to name alone | Creator at 567, 670 and additional spell handlers | Missing/ambiguous links become preview diagnostics; no source-crossing fallback without user choice |
| Expanded spell filters are TODO | Creator at 834 | Keep visible unresolved choices; extension handler needed before claiming automation of those filters |
| Feature cleanup depends on mutable source-name strings | Creator `cleanseOldFeaturesForClass/SubClass` | Use provenance and stable selection IDs; removed classes cannot leave orphan grants |
| Level application regenerates slots with used=0; hit dice can reset/merge with manual dice | Creator at 343/859; `SpellSlotProgression.kt` | Preserve usage by stable pool identity; totals shrinking require explicit adjustment |
| Pact level 2 table contains one slot | `SpellSlotProgression.kt` | Record as Android baseline, flag for rules-policy review in M3; do not describe as verified official rule |
| Half/third contributions use floor, artificer uses ceil; combined slots assigned to first non-pact source | Creator at 859 | Version this Android baseline. Preserve class ordering; keep combined pool identity independent of display source |
| Species changes may retain previous movement/resistance values | Detail VM at 663 | Track derived origins so replacement affects only old species contributions |
| Editing caps current HP at base max, even with max override | Creator at 949 | Use effective max and preview clamping; avoid silent state loss |
| Web long rest restores all hit dice, decrements one-use recovery, clears temp HP; Android restores half per pool, resets one-use recovery, leaves temp HP | Web `rest.service.ts`; Android detail VM 550 | Android policy is baseline for parity tests. Version rest policy so later rules changes are explicit |
| AC chooses best of unarmored/armor rather than strict equipment legality | Detail VM `calculateArmorClass` | Preserve explicit overrides; describe calculation policy, do not claim complete rules validation |

## Review boundaries

Source audit covers the workflow families above and their persistent fields. M2 will validate adapter behavior against real content and measure imports; M3 will execute parity cases. No Android runtime/Room database was available as a captured fixture in this milestone. Synthetic cases are source-derived expectations, not recorded app outputs. Background/adventure/bastion automation is not present in the audited Android workflows and is an extension rather than an implicit parity requirement.
