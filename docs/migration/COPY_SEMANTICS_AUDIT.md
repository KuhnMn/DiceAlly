# Copy and mapping semantics audit

Pinned upstream commit: `8c026b807fac21862a309379a0c3228a0683198b`. Adapter version 6; explicitly reimport to receive the corrected data. Existing active revisions are not rewritten.

## Method

`node scripts/audit-copy-parity.mjs` runs ten synthetic comparisons against upstream copy utilities. `node scripts/audit-copy-parity.mjs --full` additionally downloads the supported categories into memory and recursively compares all copy definitions. It compares serialized data rather than reference identity or JavaScript-only undefined properties. Upstream `_isCopy` is ignored because it is renderer/filter metadata. Upstream code runs in a separate developer VM context and is never added to the application bundle. The pinned source is executed as developer tooling; use the fixed audited commit rather than replacing it with an untrusted configurable source.

The full run also compares base-item/magic-variant requirement and exclusion decisions and selected subrace mechanical fields. Normalizing upstream speed/resistance shapes before comparison accounts for the web document representation. These checks do not claim equivalence of the full upstream renderer or character rules engine.

## Corrections

| Area | Previous behavior | Corrected behavior |
| --- | --- | --- |
| Monster inheritance | Inherited category metadata automatically | Legendary group, environment, sound, variant, dragon casting color and familiar fields require explicit preservation or child values |
| Item inheritance | Inherited loot tables/tier automatically | Explicit preservation or child values required for items, groups, base items and magic variants |
| Text selectors | Replaced every string beneath an entry | Default targets are plain entries and entries/header/footer bodies; names and other metadata require explicit `props` |
| Tagged text | Replaced strings within reference tags | Tags, including nested tags, are protected unless `tagInsensitive` is true |
| Regex flags | Supplying `i` removed global replacement | Replacement remains global while honoring other flags |
| Wildcard scope | Included generic entries and missed headers/variants | Uses the upstream creature entry/header field set |
| Modifier order | Root and wildcard operations tied | Property operations first, then root `_`, then wildcard `*` |
| Added spells | Sorted every category | At-will/constant/frequency additions retain append order; existing level lists are sorted |
| Subrace removals | Null could fall back to inherited resistance/proficiencies | Explicit null removes inherited fields after merges/fallbacks |

Child values take precedence over inherited fields. Explicit null removes inherited fields. Template root values do not overwrite explicitly supplied child roots, and template modifiers append after child modifiers. Cycles, missing bases/templates and unsupported operations remain explicit failures.

## Intentional representation differences

- Species use Android-compatible names such as `High Elf`; upstream parenthetical names resolve through aliases. Speed and resistance structures are normalized for web documents.
- Derived items retain Android-compatible composite publication labels, with separate variant publication and stable logical keys. Upstream renderer caches, UI flags and numeric Room IDs are not part of the data contract.
- Missing base prices in expressions remain unknown with a warning; safe arithmetic does not evaluate JavaScript. Item presentation remains transient.
- Species tags/language options and generated combinations are deduplicated. Independent overlapping proficiency choices fail for a future rules handler instead of guessing.
- Existing secondary mapping tests cover variant generation, explicit overrides, physical fields, entry injection, prices/formulas and source-aware enrichment. Exact full-renderer item equality is not an acceptance requirement for this Android-oriented mapping.

## Recorded validation

The final pinned-source run passed ten synthetic copy cases, all 1,437 supported copy definitions, all 52,900 base-item/variant matching decisions, and nine selected mechanical fields on all 98 subraces. The Blue and Green Ixalan Merfolk language options differ only by intentional deduplication, recorded explicitly by the audit tool. No unexplained differences remained in these comparisons.

All 53 unit tests pass. Production build succeeds with the existing 520 kB initial-bundle warning. Full import succeeds for 157 files and 21,629 records, with 100 nonblocking warnings. Download: 24,058,503 bytes; serialized mapped records: 47,375,420 bytes. Node measurements remain developer checks; browser/mobile storage, speed and peak memory still need measurement.

## Remaining limits

The audit verifies supported records at the pinned commit. It cannot guarantee semantics for new upstream/homebrew operations. Modes such as `calculateProp`, `renameArr`, `replaceName`, `appendStr`, `replaceOrAppendArr` and save/all-skill additions remain unsupported and fail visibly. No Android runtime capture was produced; character calculation parity remains a later rules-engine acceptance gate.

Sources: pinned [copy implementation and category policies](https://github.com/5etools-mirror-3/5etools-src/blob/8c026b807fac21862a309379a0c3228a0683198b/js/utils.js), and [species/variant transformations](https://github.com/5etools-mirror-3/5etools-src/blob/8c026b807fac21862a309379a0c3228a0683198b/js/render.js).
