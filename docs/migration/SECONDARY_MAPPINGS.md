# Secondary mappings

Milestone 2 mapping step completed for the supported Android categories. Implementation: `src/app/content/content-materializer.ts`. Adapter version is now 6; explicitly reimport to receive the [audited copy and null-removal fixes](COPY_SEMANTICS_AUDIT.md). Existing active revisions remain readable and are not modified in place.

## Pipeline and outputs

Resolve raw copies/templates, materialize secondary records, validate all attached links, then activate. Raw definitions retain upstream fields. Derived records carry stable identities and a versioned `derivation` descriptor with input references; no Room numeric IDs are generated.

| Input | Materialized output |
| --- | --- |
| `race` | Normalized `species` with movement/resistance forms compatible with Android |
| `subrace` + parent `race` | Merged species, with parent and subrace provenance |
| `baseitem` | Playable `item`; explicit item with same identity takes precedence |
| `itemGroup` | Playable group item with separate stable identity; member references retained |
| `magicvariant` + matching base | Playable variant with base/variant/version identity |
| Playable item + base/type/property/mastery definitions | Effective physical fields and validated dependency links |

## Species

Labels follow Android's `Subrace BaseName` convention. Missing subrace labels default to `Variant`; explicitly empty labels retain the parent name. Page falls back to the parent. Speed, darkvision, size and resistances use subrace values or parent fallback. Creature types/tags and size entry follow Android's parent inheritance.

Case-insensitive `data.overwrite` replaces matching entries; other entries append. Unmatched overwrite entries are retained, correcting Android's silent omission. Numeric movement becomes `{ number }`; conditional movement keeps its condition and `true` movement resolves against walk speed. Fixed resistances become `{ type }`; choices remain intact.

These are normalized internal domain values. Android's JSON serializers compress numeric speeds and fixed resistances again; export serialization remains a separate compatibility projection.

Ability options, languages, tags and skill proficiencies are retained/merged for the rules engine. Explicit overwrite flags are honored. Ambiguous independent skill choices or mismatched ability option counts produce diagnostics rather than guesses.

## Variants

All conditions within a requirement group must match; groups are alternatives. Exclusions reject candidates. Nested and array-valued requirements are supported. This corrects Android's overly broad OR matching within a group. Each base/variant pair generates once even if several groups match.

Names apply removal/prefix/suffix. Sources preserve Android's `variantPublication:basePublication` format, with variant publication and original references available separately. Physical data remains intact; inherited rarity, attunement, bonuses and rich fields are applied. Base and variant entries are combined and injectors resolve names/damage types/bonuses, including chained article/case/numeric formats.

Property additions/removals, weight/value multipliers, bounded arithmetic expressions, barding and resistance contributions are mapped. Generated records do not inherit unrelated publication flags. Unknown base prices remain unknown, retain their expressions, and produce warnings; they are never assigned a fabricated zero/free price.

Expansion is capped at 50,000 records, checks cancellation between candidates and batches writes. Android's cross-edition candidate availability remains; edition metadata allows explicit filtering later. Unsupported future formats fail visibly.

## Item enrichment

Missing physical fields fall back to the referenced base; explicit item values win. Attunement `true` becomes `by anyone`, text is preserved, false/absent becomes null. Groups preserve weapon-damage bonuses instead of Android's attack/damage field mixup.

Qualified metadata references resolve by publication-aware keys. Bare type/property tokens prefer PHB, then legacy DMG if no PHB definition exists; bare masteries prefer XPHB. A sole definition elsewhere can resolve a legacy bare token, but ambiguous candidates fail. Explicit publication-qualified UIDs never cross books. Property names may come from their first named entry.

Presentation data is not stored on content records. `resolveItemView` in `src/app/content/item-resolver.ts` reads validated dependency links and assembles a temporary `ItemView` with item/base data, type name, properties/masteries, page and AC when browsing loads an item. The development page holds those views only in memory. Attached dependency links are validated before activation. [Reference linking](CONTENT_LINKING.md) now covers group members, supported entry tags and selected dependency traversal.

## Verification

Synthetic tests cover merging/preservation, requirement groups/exclusions, deduplicated generation, stable identities, formulas and unknown prices, source-aware enrichment, explicit-item precedence, and rollback on mapping failure.

The full probe at commit `8c026b807fac21862a309379a0c3228a0683198b` passed with 230 base-item projections, 160 standalone species, 98 merged subraces, 119 playable item groups, and 6,258 generated variants. Total stored records: 21,629, including raw definitions and templates. There are 37 nonblocking diagnostics: one file without a supported category and 36 unknown-price cases.

The latest adapter version 6 probe downloaded 24,058,503 bytes and estimated 47,375,420 serialized mapped bytes. It reported 100 nonblocking diagnostics: the original 37 mapping warnings plus 63 unresolved or ambiguous description references. These are developer measurements, not browser/mobile guarantees; real storage includes additional indexing overhead.

No upstream descriptions or personal data were committed. The pinned-source [copy and mapping audit](COPY_SEMANTICS_AUDIT.md) now passes. Captured Android character calculation comparisons and browser/mobile acceptance remain separate tasks. This mapping step targets audited Android categories and the checked source, not every possible future/homebrew mechanic.

References: Android `MainActivity.kt` secondary imports and `ItemViewModel.kt` display mapping; upstream [race/variant transformations](https://github.com/5etools-mirror-3/5etools-src/blob/main/js/render.js) and [qualified item UIDs](https://github.com/5etools-mirror-3/5etools-src/blob/main/js/utils.js).
