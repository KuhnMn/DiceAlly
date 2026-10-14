# Local creator/editor artifact

**Superseded design:** the user rejected this creator on 2026-10-14. See [Creator rebuild reference](CREATOR_REBUILD_REFERENCE.md) for the accepted direction and current scope. The implementation/validation notes below describe the previous artifact, not user acceptance.

Implemented 2026-10-14 for Milestone 4's local development scope. Run `npm start`, import content at `/dev/content`, then open `/dev/characters` using the development navigation. No deployment or authentication service was provisioned. Production routes exclude both development workspaces.

The five editor steps cover identity, species and ordered classes/subclasses, base abilities and required rule choices, management, and review. The workflow creates a native document, saves it, reopens it, applies level/class changes, and exports a self-contained native file or an Android-compatible sheet. Importing a native file always creates an independent UUID. The existing Android/minimal importer and legacy localStorage saves remain available.

## Persistence and preservation

- `ally-local-characters-v1` is a separate IndexedDB database. Each character row atomically contains the accepted document, optional recoverable draft, prior accepted version, and local version counter. Browser reload recovers drafts. Another tab's save or deletion rejects stale writes instead of overwriting them.
- Drafts can contain incomplete selections. Accepted saves pass the native document validator and rules-preview acceptance. Drafts require review before opening the sheet. Navigation and tab-close checks surface unsaved editor changes.
- Rules use the exact installed revision. When its cache is absent, selected snapshots support existing selections; unavailable new content requires a compatible import. The editor does not download or change content implicitly.
- Content updates show diagnostics, changed fields, removed instance counts, proposed derived values, and explicit HP/resource decisions. Acceptance uses the engine's private proposal and stale-base checks. Failed updates leave the document untouched. Missing/renamed references remain blocking diagnostics rather than guessed replacements. The prior accepted local version can be restored as a draft.
- Sheet saves return HP, temporary HP, death saves, pool usage, annotations, prepared-list copies, inventory, conditions, monsters, notes and other presentation state to the native repository. Native rests use the document's selected Android/web policy. Legacy saves continue using their original path.
- Legacy reconstruction preserves the full original payload plus protected legacy features/spells. Users supply exact classes and confirm base abilities/overrides before recalculation. Existing effective ability scores are not silently interpreted as unmodified base scores. Protected legacy entries can be removed explicitly after duplicate-grant review.

## Management coverage

| Workflow | Local controls |
| --- | --- |
| Identity, portrait, abilities, vitals, currency | Text/number controls, portrait URL, scalar overrides and rest policy |
| Species, classes, subclass, multiclass order/levels | Pinned selectors; first-class order is explicit |
| Proficiency packages, skills/saves, optional features, additional spells | Required choice selectors plus manual proficiency editor; unsupported mechanics remain diagnostics |
| Species ability alternatives | Explicit alternative and ability-allocation controls |
| Spell grants | Block, casting-ability and spell-level controls; known/prepared/innate lists, copying, notes, manual addition/removal |
| Features/feats | Manual addition/removal, annotations, suppression/restoration of generated grants |
| Casting sources, resources | Named sources, spellbook, attack/DC overrides; manual pools, recovery settings and used counters |
| Equipment | Cached enriched item view; custom items, counts, equipped/attuned/multiple flags and removal; equipped armor enters the existing rules AC policy |
| Monsters | Independent copied entries with enabled/current/max/temp health and overrides |
| Conditions, ordered notes and combat actions | Add/edit/remove; note/action ordering |
| Extended settings and manual mechanics | Validated structured fields for armor/level settings, source/resource bindings, linked rule actions, session annotations, inventory uses/notes, senses, movement, resistances, advantages, and presentation data |

Ordinary management uses forms. Less common settings use the structured editor: load a field, edit its displayed JSON, validate, then review/apply. The editor exposes the Milestone 3 rules baseline; it does not claim automatic implementation of every upstream mechanic. Equipment armor/AC is normalized automatically; other conditional item effects can be represented through explicit inputs/overrides. Unsupported automatic handlers remain visible.

## Validation

- `npx ng test --watch=false`: native persistence/integration tests plus the existing content/rules/viewer suite.
- `npx ng build --configuration development` and `npx ng build --configuration production`: compile the artifact. Production still reports the initial-bundle warning; the build remains under its error budget.
- `node scripts/creator-acceptance.mjs`, with the development server at `http://127.0.0.1:4201`: isolated headless Chrome. Downloads four public files at commit `8c026b807fac21862a309379a0c3228a0683198b` without writing the corpus to disk. Exercises PHB Fighter/Fighting Style, XPHB Dwarf, Wizard multiclassing, native sheet save/reopen, durable drafts and all editor-step layouts. Results are in `creator-acceptance-results.json`.

The browser harness stages a representative mapped subset with normalized species, rather than rerunning the full content importer. The importer/linker has its separate M2 tests. Android runtime comparisons, comprehensive upstream-mechanic parity, physical-phone acceptance, and interactive visual acceptance remain unverified. Accounts, cloud saves, durable sync and authenticated sharing are later milestones.
