# Character document contract v1

Milestone 1 design contract; no production types or database schema are introduced yet. Applies to native web saves and full web exports. Android JSON remains a separate compatibility projection. See [ANDROID_PARITY.md](ANDROID_PARITY.md).

## Ownership and versions

Persist one authoritative document; derive the existing `ExportedCharacter` viewer shape from it. Do not independently mutate a duplicated sheet and session copy.

| Field | Contract |
| --- | --- |
| `format` | Literal `ally-character` |
| `schemaVersion` | Integer 1; explicit sequential migrations, unknown future versions rejected without deleting original |
| `id` | Application UUID; stable across edits/sync, regenerated for share-copy import |
| `rulesVersion` | Version of derivation and rest policy; changes require migration/preview |
| `identity` | Name, description, portrait descriptor, legacy UUID/install ID provenance |
| `creation` | Explicit inputs, ordered class selections, species, choices, base/manual values, application preferences |
| `overrides` | Typed targets and explicit operations, including suppression of generated grants |
| `contentBindings` | Source identities, exact commits, adapter versions, enabled publications |
| `instances` | Selected feature/spell/item/species/monster instances, feature sources, resource pools, linked actions |
| `derived` | Generated totals/formulas/grants with provenance; materialized for viewing without a cache |
| `session` | Current mutable play state keyed by stable instance/pool IDs |
| `presentation` | Tab visibility and per-character display preferences |
| `snapshots` | Only selected content/dependencies needed for sheet rendering; never the full library |
| `compatibility` | Original legacy payload, unresolved identifiers, creation completeness, preserved unknown fields |
| `extensions` | Namespaced versioned payloads; preserved across reads/exports |

Database owner ID, server revision, timestamps, and tombstone are an envelope controlled by the repository/server. They are not trusted from an imported document. Local metadata additionally holds acknowledged revision, dirty status, and outbox operation IDs; it is excluded from portable exports. A development-only local namespace is replaced/claimed on explicit signed-in migration.

## Stable content references

A logical reference consists of `sourceIdentity`, `kind`, `name`, `publication`, and kind-specific qualifiers. Source identity describes provider + owner + repository + data directory. Branch is selection configuration; a revision binds the source identity to an exact commit. Changing publication/name creates a new identity unless an explicit alias mapping is accepted.

| Kind | Required qualifiers beyond name/publication |
| --- | --- |
| class, spell, feat, optional-feature, species, monster, item, base-item | None; kind distinguishes otherwise identical names |
| subclass | Parent class name/publication; shortName when present |
| class-feature | Parent class name/publication and feature level |
| subclass-feature | Parent class name/publication, subclass shortName/publication and feature level |
| subrace | Parent species name/publication |
| item-type, item-property | Abbreviation and publication where present |
| item-mastery | Name/publication |
| generated-item | Base-item reference + variant reference + generation version |
| table, variant-rule, condition | Kind and name/publication, retain original category |

Retain original case/strings for display/export; use an explicit adapter-defined normalization for lookup (Unicode NFC, trim, invariant case folding). Encode key components as a JSON tuple, never a delimiter-concatenated string. Store original upstream reference tokens for diagnostics. Collision detection must report ambiguous records, not overwrite them. References do not include Room numeric IDs.

Snapshot identity adds exact commit + adapter version + content digest to the logical reference. Thus the same logical feature can be compared across revisions without overwriting its old definition.

Class selection UUIDs, feature-source UUIDs, instance UUIDs, resource UUIDs, note UUIDs, and action UUIDs are independent of content keys. Two copies of the same item/monster can have separate state. A spell can belong to multiple lists and casting sources without sharing counters unintentionally.

Generated grant identity is a canonical tuple of selection ID, rule/grant token, referenced entity key, and role. Retain assigned instance ID on repeat derivation; associate one instance with multiple grants if they intentionally coalesce. Removing one grant must not remove another grant's instance. Source labels and resource tags are editable text, never identity.

## Field ownership and preservation

| Android/web fields | Authoritative location | Recalculation behavior |
| --- | --- | --- |
| name/description/portrait | identity | Preserve; local Android URI is nonportable and must not be fetched as a web URL |
| classLevels/class-subclass order/levels | creation.classes | Stable references and selection IDs; first selection has starting-class role |
| abilityScores | creation.abilities | Six explicit scores; retain method/choice metadata if introduced |
| maxHp/armorClass/calculateAC/unarmoredDefense | creation bases/policies + derived totals | Separate manual base from derived value; preview effects |
| maxHpOverride/armorClassOverride/initiativeOverride | overrides | Nullable removal is explicit; zero is not equivalent to absent |
| savingThrows/skills/simpleWeapons/martialWeapons/tools/languages/custom | creation proficiency inputs + derived contributions | Keep manual proficiency levels and additions, stable tool refs; languages separate from custom text |
| jackOfAllTrades/initiative proficiency/skillMiscBonuses/saveMiscBonuses | creation and typed overrides | Preserve manual bonuses/flags independently of generated origins |
| featureSources ability flags/customToHit/customDc/useSpellbook | instances.sources + overrides | Preserve IDs and user customization through regeneration |
| advantageOn/resistances/senses/speeds | creation/manual inputs + derived contributions | Include conditions, disadvantage flag, conditional speed forms; remove only obsolete derived contribution |
| total hit dice/slots/free uses/regain condition | instances.resource definitions | Preserve manual pools; display conflicts when generated totals shrink |
| currentHp/tempHp/death saves/inspiration/rounds | session | Preserve until explicit play action or accepted adjustment |
| used hit dice/slots/free uses | session.resources by pool ID | Keep counts; do not reset on save/edit/level application |
| currency (platinum/gold/silver/copper) | session.currency | Preserve every denomination, including ones absent from a particular editor |
| conditions/custom effects | session.conditions | Keep strings and independent local IDs |
| species/features/spells selections | instances with refs/snapshots/origins | Keep manually added selections, spell list membership and casting source |
| inventory count/multiples/equipped/attuned | session.inventory by instance ID | Preserve distinct item instances and custom/dummy records |
| monster health enabled/current/temp/max override | session.monsters by instance ID | Preserve separate monsters; base max is instance definition |
| feature/item/spell/species notes | session.annotations | Tag, string list, editable flag, stable annotation ID; snapshots may supply read-only text |
| global notes/order | session.notes | Stable note UUIDs; order list, no Room character FK |
| combat actions/type/range/hit/DC/damage/order/link | instances.actions | Store action UUID and target instance/resource UUID; allow unlinked manual text |
| show*Tab | presentation | Preserve all seven flags |

Represent an override as target kind + stable target ID + field name + operation (`replace`, `add`, `suppress`) + typed value. Do not apply arbitrary imported property paths. Validate targets and values. Clearing a generated feature records a suppression so it does not return on every recalculation. Unknown fields remain in compatibility/extensions until supported.

## Domain operation contract

`deriveCharacter(document, contentIndex, policy)` is pure and returns a proposed document, diagnostics, and a change list. It does not save, fetch, mutate the input, or update session counters implicitly. Application toggles cover HP, hit dice, and proficiencies; manual base values remain available when automation is disabled.

`previewContentUpdate` binds selected references to a proposed revision, reports changes/removals/renames/ambiguities, and applies overrides after derivation. Unresolved required choices prevent accepting the affected automated operation; ordinary sheet edits remain possible. `acceptChanges` applies a preview only against the document revision it was computed from.

Damage/heal/rest/session operations update session only, with policy-derived effective limits. Derivation cannot silently clamp HP or usage; a preview records proposed clamping and requires acceptance. Repeating an operation without changed inputs is idempotent.

## Legacy import and export

Recognize full Android sheets by `character.characterUuid`/full shape; minimal exports by `character.uuid`/abbreviated shape. Validate shape, bounded sizes, numeric values, and nested structure rather than relying on a single field. Save original payload before adaptation.

- Full imports can render from embedded snapshots. Missing snapshots are unresolved; never silently omit their entities.
- Missing classLevels, exact source revision, choice history, initiative override, portraits, and tab flags are marked unknown/defaulted with warnings. Reconstruction requires explicit user confirmation.
- Numeric tool IDs and nested action/Room IDs cannot be used as portable foreign keys. Resolve from snapshots/content only when unique, otherwise keep unresolved values.
- Minimal files are state patches for an explicitly chosen compatible character, not a complete new editable character. Match by entity/source/role and ask on ambiguous multiple instances; absent fields mean no change unless the legacy format explicitly encodes replacement semantics.
- Full web export includes native document plus version, not trusted ownership. Android-compatible export is a projection and reports fields it cannot carry; retain the existing misspelled `portaitUrl` only in that compatibility projection.
- Share redemption clones the full native document, regenerates application/selection/instance/source/pool/note/action IDs, and remaps all internal links. Refs/snapshot identities remain intact; legacy UUID is provenance only.

## Extension boundary

Content adapters register handlers by category/version; rule handlers use named policies and explicit choice/result types. Preserve unsupported upstream fields in local mapped records. Snapshot only selected dependencies. New mechanics must declare their inputs, derivation, provenance, validation and migration, rather than mutating the editor directly.

## Acceptance checklist

- Every audited persistent character field has an authoritative home above.
- Equal names in different publications/classes/levels cannot collide silently.
- Cache removal does not remove selected snapshots or pending changes.
- Share copies and legacy imports cannot overwrite by matching UUID alone.
- All regeneration retains manual additions, overrides, notes and used counters, or requests an explicit adjustment.
- M3 adds executable validators and parity tests; this milestone defines the contract only.
