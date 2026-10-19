# Usability next steps: a practical tracker backlog

Assessment date: 19 October 2026.

## Recommendation

Start with the quick wins below, then improve access to play-time information in
the existing pages. The most valuable larger changes are a focused layout pass,
better access to frequently used abilities, simpler manual health tracking, and
clearer creator/setup guidance. Each can ship independently. None requires a new
app architecture or a replacement character creator.

The product is a character tracker and reminder tool. Players decide what happens
at the table; the app records their choices and makes references easy to find.
Explicit damage, healing, and counter adjustments fit this purpose. Automatically
resolving attacks, selecting casting resources, applying condition penalties, or
enforcing character legality would expand the scope substantially.

## Basis and completed work

This prioritization uses the [usability review](usability-review-findings.md), the
[UI improvement guide](ui-improvement-guide.md), and targeted source inspection.
Finding IDs below refer to the usability review. This is a planning document, not
a new browser audit: historical screen measurements and test counts were not
reproduced, and no physical-device verification was performed.

Treat the review's F01–F06 implementation pass as the completed baseline:
base/override separation, independent attunement, rest preview, note-draft
protection, combat-source refresh, and concentration tracking. Do not reopen these
as mandatory projects. The rest preview deliberately retains the existing recovery
policy; a rules-version selector and Undo remain optional extensions.

Also avoid duplicating work already present:

- The UI guide records mobile HP/actions, collapsible identity details, search,
  retained tab/filter state, compact rows, and shared detail overlays. Build on them.
- Equipment already has quantity minus/plus controls and an independent attunement
  count. F18 needs refinement, not another quantity-tracking implementation.
- Notes already use a deletion-confirmation dialog. Check any separate tag/chip
  deletion interaction before treating F20 as an unresolved whole-note issue.
- The class wizard already provides a proposed-change preview, and catalog
  description overlays exist. F25/F30 should improve gaps in discoverability and
  explanation rather than introduce competing preview systems.
- Share-code text already explains that imports create independent copies, although
  the action still says “Share via Code Sync.”

Effort labels are relative, not time commitments: **small** means a localized UI
change; **medium** means a coordinated interaction across existing components;
**larger** means saved-state or multi-flow changes. Check current behavior before
starting each item, because the original review contains both fixes and ideas.

## Most important larger changes

### 1. Reduce the distance to useful content (F07, F08, F10, F17)

**Priority: first larger change. Effort: medium, split by page.**

The remaining opportunity is to reach a spell, skill, or creator control with less
scrolling. Earlier compact-layout work already delivered substantial improvements;
a second pass should address specific remaining bottlenecks.

Implement in small slices:

1. On Spells, keep search near the results and put advanced filters in a disclosure
   with an active-filter count and Clear action. Keep source statistics and slot
   trackers readily accessible. Preserve the existing horizontal filter rows.
2. On the creator, reduce repeated header space and add a compact mobile page
   selector using the existing tab/page state. Retain explicit navigation and
   guarded swipes; do not create a second navigation model.
3. On desktop, reduce oversized identity/stat presentation only where it pushes
   combat and skills out of reach. Start with spacing and disclosure changes;
   defer a separately configurable “play mode.”

Start in [Spells](../src/app/sheet/spells-page.component.ts), the
[editor shell](../src/app/editor/local-editor.component.html), and the existing
[desktop sheet](../src/app/sheet/character-info-page.component.ts). Use current
theme tokens and responsive styles. Avoid adding several sticky bars that consume
the viewport or cover focused controls.

**Done when:** the same populated character reaches its first useful spell/action
with less scrolling at 390 px and desktop widths; search and active filters remain
discoverable; 320 px layouts remain contained; tab changes preserve drafts and
filter state. Compare before/after with the same content rather than adopting the
old review's pixel measurements as fixed targets.

**Implemented — 19 October 2026:**

- Features, Spells, Inventory, and Monsters share an icon-based search toolbar,
  active-filter count, and explicit Clear action. Advanced filter rows start
  collapsed and remain mounted so closing them preserves their selections.
  Casting/source statistics and spell slots remain visible in Prepared Spells.
  Preparation views omit spell slots and retain the original source-card selector,
  replacing casting stats with prepared and spellbook counts. Source selections
  are context: spell and feature sources do not contribute to filter badges, and
  Clear preserves the selected source in both viewer and creator lists. On the sheet, Prepared Spells,
  Spelllist, and Spellbook are separate views, switched using list/book icons and
  a return arrow rather than filter chips. Views do not contribute to filter
  counts, and Clear preserves the current view. Casting Time supports multiple
  Action, Bonus, and Reaction choices alongside multi-select spell levels and schools. Search
  stays immediately above results and the optional filter panel.
- The creator reuses that toolbar for its existing feature, spell, item, and
  monster searches. Spell-level and casting-time filters use the same disclosure;
  primary feature types and casting-source selectors stay visible. Lists without extra filters show search and
  Clear without an unnecessary Filters button.
- Spells, Features, Items, Monsters, and Species share compact acquisition rows
  with metadata tags, a full-row details target, and independent Add/Select icons.
  Source Books stays above other catalog controls. Catalog filter options are
  derived only from permitted books, including spell-class membership sources;
  changing books removes unavailable selections. Clear preserves this book scope.
  Each filter group uses its own horizontally scrolling row on mobile.
- Already-added entries use compact two-line management rows with metadata tags,
  whole-row editing, and independent removal controls. Notes, trackers, combat
  bookmarks, and other editing controls stay in the expanded row. Spell rows have
  separate preparation and source-enabled spellbook toggles; removing annotated
  list copies retains the existing confirmation and source identity boundaries.
  The spell editor uses one deduplicated management list, with Prepared and/or
  Spellbook membership filters instead of play-view switches or preparation tint.
  Selecting both memberships shows their union. Legacy prepared/book-only entries
  remain visible, and prepared notes/trackers can be edited from the unified row.
  Uses, Notes, and linked Combat indicators sit beside entry names, with tally
  marks for counters. Expanded rows share a compact Uses/Notes/Combat/Description
  toolbar; only one annotation panel is visible at a time, with drafts retained.
  Combat entry creation reuses the compact dialog and existing confirmation flow.
- The sheet separates Class Features, Feats, and Optional Features into view
  buttons outside the filter panel. Class Features filters by level; the creator
  and catalog also offer class. Feats filter by category and Optional Features by
  feature type; those views show type tags instead of class/level metadata.
  Switching views is not counted as filtering, and Clear preserves the view.
- Spelllist and Spellbook use compact two-row checklist entries with subtle dividers:
  readable names and rounded preparation controls above small school abbreviations,
  membership icons, and truncated content/casting-source labels. Levels appear in
  group headings. Spellbook also shows Ritual/Concentration tags and a Ritual-only
  toggle beside search, sharing the advanced ritual filter. Full
  rules, notes, and trackers remain in the detail overlay; Prepared Spells keeps
  its play-time summaries. The view icons sit at the top of the spell page; a
  theme-aware tint and accent edge cover the whole page in either preparation
  view, without an extra inset panel. User-facing ?Known?
  labels are now ?Spelllist,? including creator/wizard labels, while stored
  `KNOWN` values remain compatible with existing characters.
- Creator header actions take less mobile space, using labeled icons for Wizard,
  Save, and Save & View. A sticky page selector with previous/next arrows replaces
  the scrolling tabs below 1024 px, sharing the existing page state, save guards,
  and guarded swipes. Desktop keeps the existing tabs.
- Desktop sheet padding, portrait size, ability-card spacing, and circular stat
  badges are smaller while retaining their existing arrangement and visual style.

- Features choose their source when added; existing entries cannot be reassigned.
  Spell casting-source cards in the creator retain ability/attack/DC stats and add
  separate Prepared spell (level 1+), Prepared cantrip (C), and Spellbook icon counts. Viewer preparation views share those
  icons and totals; counts remain independent of list filters and update with membership.
  Source creation uses compact cards in a responsive grid, with grouped Features/
  Spellcasting controls, one row of ability toggles, and Spellbook under Spellcasting.
  Custom attack/DC overrides are expandable and open automatically for saved overrides.
  New features and spells require an existing feature/casting source, respectively;
  catalog, custom, and bulk additions cannot create unassigned entries. Add dialogs
  offer source management when no valid destination is selected. Older entries are retained.
  To change a feature's source, remove it and add it to the correct source.
  Class features remain unique per source. Spells remain unique per casting source, with separate
  Spelllist/Prepared/Spellbook memberships. Feats, Optional Features, items, and
  monsters allow independent repeat copies. Their catalog Add buttons retain a
  subtle tint when a copy already exists and remain available to add another.

- Searches rank exact names first, then matching names with fewer extra characters.
  Catalogs rank across all matches before pagination; editor lists, sheet groups,
  wizard choices, and searchable selectors use the same ranking. Empty searches
  preserve the existing ordering, and filtering rules remain unchanged.
- Sheet and creator tabs share a floating scroll-up button near the upper right.
  It appears after the tab's start scrolls out of view, stays below mobile sticky
  navigation, and returns to the current tab's content with keyboard focus restored.
  Reduced-motion preferences disable smooth scrolling.

Validation: 424 tests pass across 85 files, including shared search/clear behavior,
closed-filter counts, and creator draft preservation through the new selector.
Production build succeeds with the existing initial-bundle and editor stylesheet
budget warnings. The repeatable
[layout check](../scripts/usability-layout-acceptance.mjs) uses synthetic in-memory
character data in an isolated Chrome profile, without account login or cloud writes.
Checks at 320, 390, 768, and 1366 px found no document overflow with filters open or
closed; filtering and viewing preserved the character data. On that fixture,
closing advanced filters saves 270 px on mobile Spells and 74–84 px on the other
mobile lists, and 70–286 px on desktop/tablet. These compare open and closed panels in
the new layout, not the earlier review's historical character/layout measurements.
Physical-device keyboard and gesture behavior remains unverified.

### 2. Bring limited-use abilities closer to their counters (F15, F16)

**Priority: second. Effort: medium; persistent favorites would make it larger.**

A player should find an ability, read it, and adjust its existing use tracker
without hunting through passive features.

Start with a **Limited-use** filter on the existing Features page, derived from
entries that already have use trackers. Reuse
[FeatureUsesComponent](../src/app/sheet/feature-uses.component.ts) and the current
detail overlay. This requires no favorites schema or new dashboard.

Next, for combat bookmarks with a reliable existing source link, expose the linked
tracker beside the action or through a clearly labeled disclosure. Use the source
tracker as the single value; never copy its count into the combat entry. If the
source has multiple trackers, let the player choose rather than infer a cost.
Unlinked entries remain useful readable references.

**Scope limit:** opening an action never spends a resource. Spending is an explicit
player action; there is no attack resolution, automatic action economy, or inferred
resource linkage. Persistent favorites and companion action pinning can follow if
real-session feedback shows the filter is insufficient.

**Done when:** adjusting a linked use is reflected in both views, browsing changes
no counters, missing sources remain readable, and a character without trackers
gets a useful empty state. Implement complete custom-action reading as quick win
Q2 before adding linked controls.

### 3. Make manual health bookkeeping easier (F13, F19)

**Priority: third; move companion work later if companions are rarely used.
Effort: medium.**

First prioritize death saves when current HP is zero. Keep maximum-HP configuration
available but secondary. Add an explicit reset action that explains which marks
will be cleared. If adding a “Stabilized” state, define how it is recorded before
implementing it; resetting marks alone must not silently imply stabilization.

Then offer one interaction to choose a Hit Die and enter the player's healing
result. Show the intended counter and HP changes before applying them together.
Keep direct counter and HP adjustments for corrections and house rules. Rolling
the die or deciding the healing result remains the player's job.

For companions, reuse the Damage/Heal interaction pattern and applicable pure
health helpers. Apply adjustments to the selected companion's HP/temp HP, leaving
character concentration and death-save behavior separate. Do not attach the whole
character-health controller to companions merely to reuse its UI.

Start in [health details](../src/app/sheet/sheet-health-details.component.ts),
[Hit Dice](../src/app/sheet/hit-dice-tracker.component.ts),
[health helpers](../src/app/sheet/sheet-health.ts), and
[companions](../src/app/sheet/monsters-page.component.ts).

**Done when:** cancellation changes nothing; a combined Hit Die/healing adjustment
applies once; exhausted dice cannot accidentally be spent; manual correction still
works; companion changes affect only the selected companion. Test these state
transitions rather than just their labels.

### 4. Explain setup and leveling within the existing creator (F21, F24–F26, F30, F32)

**Priority: fourth; move first-run guidance earlier if it blocks new users.
Effort: medium, with small copy-only slices.**

Keep the current freely editable pages and optional wizard. Improve the path
through them rather than turning them into a mandatory character-building workflow.

- Use “Level Up / Class Wizard” or equivalent contextual wording for the existing
  entry point. Retain its preview and manual-override behavior.
- Explain Feature Source with class/item examples, and separately explain casting
  ability and slot pool. Describe what the implementation actually supports.
- Explain Spelllist, Spellbook, and Prepared at the point of use. Short help text is
  feasible now; class/rules-aware list behavior is a separate, deferred feature.
- Make unresolved wizard choices easy to find. Verify existing preview and option
  descriptions before adding anything. Keep species and class/feat sections clear.
- Replace the empty-content dead end with instructions to load the configured
  GitHub content, a setup link, and a clear return path. Reuse the current content
  importer. Preserve the character draft when leaving for setup; if a reliable
  return path needs persistence work, treat that as medium effort, not a copy fix.
- Add a small advisory checklist for missing essentials such as maximum HP and
  Hit Dice. Describe missing entries, not character legality, and allow draft saves.
  Do not flag valid zero values using generic truthiness checks.

Use the [editor's existing ownership model](../src/app/editor/README.md), the
[class wizard](../src/app/editor/class-wizard.component.html), and
[content setup](../src/app/content/content-import.component.html). This work needs
no new content service or reconstruction of the hosted repository.

**Done when:** a user can identify the setup/leveling entry point, understand the
preview, return from content setup without losing a draft, and save an incomplete
character intentionally. Cover draft preservation with a focused regression test.

## Quick wins

These are independent small changes unless the stated caveat expands their scope.
Work roughly from the top down; combine nearby changes when convenient.

| Order | Finding | Change and implementation advice | Check / scope boundary |
| --- | --- | --- | --- |
| Q1 (implemented) | F12 | Added a compact Passive Perception bar below mobile skills using the existing shared calculation. Reduced mobile ability-card padding/type sizes and skill-row spacing. | Mobile and desktop use the same calculation. |
| Q2 | F15 | Make unlinked/custom combat entries open a full-text detail view. The mobile and desktop action buttons currently depend on `isActionClickable`. Retain compact row truncation. | Long custom text is readable by touch and keyboard; linked entries keep their source navigation; no resource is spent. |
| Q3 | F09 | Enlarge remaining frequent-action hit areas, especially the equipment controls currently using `h-8 w-8`, toward 44 px. Audit proficiency and use controls too. | Increase interactive area without shrinking text or causing overflow; separate spend, restore, and delete. |
| Q4 (implemented) | F14 | Added Invisible to the condition presets. Desktop condition tags and the Add control use compact language/tool-tag sizing; explanatory text was removed at the user's request. | Preserves custom-condition compatibility; all condition labels are reminders only and do not affect calculations. |
| Q5 | F26 | On initial creator Spells entry, select a populated list if Spelllist is empty. Preserve an explicit later user selection. | Prepared-only characters show their spells; fully empty characters retain a helpful empty state. |
| Q6 | F11, F33 | Standardize wording around Apply to Character, Saved on This Device, and Synced to Account where those states are accurate. Rename “Share via Code Sync” to “Share a Copy by Code.” | Keep actual local save and cloud status distinct; retain the existing independent-copy explanation. |
| Q7 (implemented) | F21, F24, F29, F30 | Portrait follows essential setup; HP, AC, and Hit Dice are adjacent. Small info buttons open compact help for calculated AC, sources/slot pools, Combat snapshots and refresh, and class setup/leveling. The entry point remains **Class Wizard** by request. | Reuses existing dialogs and calculations; no new formulas, wizard, or rules system. |
| Q8 | F23 | Offer a direct proficiency-rank select using the same existing update path as the cycling icon; add a short explanation of the displayed total. | Reuse supported ranks; do not introduce expertise/half proficiency into saving throws if unsupported. |
| Q9 | F31 | Recheck the reported 320 px library/share-code overflow; if still present, use shrinkable inputs and wrapping/stacked input-button layout. | Verify at 320 and 390 px; do not hide overflow globally. Historical evidence needs fresh confirmation. |
| Q10 | F33 | Align export/share modal focus containment, Escape handling, and focus return with the existing dialog pattern. | Check nested confirmations and return focus to the opener. If converting the modal needs lifecycle changes, budget as medium. |
| Q11 | F20 | Add local note title/body search using current note data and a clear-search action. Inspect tag/chip removal separately; add an explicit remove affordance if a whole chip still deletes it. | Filtering must preserve an open draft. Existing whole-note deletion confirmation stays in place. |
| Q12 | F28 | Make companion HP tracking explicit with a Track HP control backed by the existing `hpEnabled` state and a labeled starting-HP choice. | Preserve existing tracked HP; enabling tracking must not overwrite an existing value. If editor initialization needs refactoring, promote to medium. |

Q2 is especially valuable: a truncated reference that cannot be opened is a direct
obstacle during play. Q1, Q3, Q4, Q5, and Q6 provide good value without new saved
character fields. No broad redesign is necessary to deliver this batch.

## Optional additions: defer or keep outside current scope

The following accounts for the remaining optional parts of the review. “Defer”
means compatible with the product but lower value for the available development
time; “outside scope” means a larger product commitment than this backlog warrants.

| Finding | Optional addition | Decision and bounded alternative |
| --- | --- | --- |
| F03 | Rest Undo and a 2014/2024 recovery selector | **Defer.** The cancellable preview already addresses accidental activation. Add policy selection only for an actual campaign need, with narrowly defined recovery differences. A complete rules-version engine is outside scope. |
| F05 | Automatic combat-stat refresh and arbitrary custom-formula evaluation | **Outside scope.** Keep the implemented source-change warning and player-reviewed refresh; custom values remain editable. |
| F06 | Automatic concentration saves, replacement on inferred casting, or ending effects after damage | **Outside scope.** Existing manual tracking and damage reminders satisfy the intended role. |
| F08 | Separate configurable play dashboard/layout profiles | **Defer.** Improve existing spacing and disclosures first; avoid maintaining another whole presentation. |
| F12 | Detailed provenance for every calculated value | **Defer.** Start with short explanations of existing equipment/override effects and calculated AC. A generalized rules inspector is outside scope. |
| F13 | Persistent stabilized state and death-save history | **Defer beyond the initial health pass.** Prioritize visible marks and explicit reset. A combat outcome/death adjudicator is outside scope. |
| F14 | Exhaustion level counter and short condition rules reminders | **Defer, worthwhile for campaigns using them.** Store a manual level with backward-compatible defaults and explicit editing. Keep an old exhaustion tag understandable without guessing its level. Use source/rules-aware reminders; automatic penalties, timed expiry, and condition interactions are outside scope. |
| F15–F16 | Persistent favorites, reordered action bars, and generic resource/action binding | **Defer.** Ship the derived Limited-use filter and existing source links first. Persistent pins need stable IDs and save/export support. |
| F17 | A Cast dialog selecting slots, free uses, ritual casting, and upcasting | **Defer.** Current manual counters are adequate. If later justified, show explicit player-selected adjustments, including no resource, and retain manual controls. Automatic slot choice, damage resolution, and inferred effects are outside scope. Clear ritual/upcast reference text can be added earlier. |
| F18 | Use One consumable button and Spend/Gain coin dialog | **Defer.** Quantity buttons already exist. A later Use One should only decrement quantity; coin deltas should affect the chosen denomination explicitly. Automatic potion healing, ammunition consumption, or currency conversion is outside scope. |
| F19 | Pinned companion actions beside HP | **Defer unless companions are used frequently.** First improve manual Damage/Heal. A multi-creature encounter/initiative manager is outside scope. |
| F20 | Pinned notes, richer organization, and deletion Undo | **Defer.** Start with search and existing confirmation/draft protection. A campaign wiki or shared session log is outside scope. |
| F21 | Comprehensive Ready to Play validation | **Defer beyond the small advisory checklist.** Missing-value hints are sufficient; legality checks and blocking character creation are outside scope. |
| F22 | Standard-array/point-buy helpers and separate base/increase tracking | **Defer.** Manual scores already fit the app. A later helper should preview and apply chosen scores, never reinterpret existing ones. Full ancestry/background/feat legality and allocation enforcement are outside scope. |
| F25, F30 | New option-comparison UI and expanded background/starting-equipment workflow | **Defer.** Reuse existing description overlays and clarify where manual setup belongs. Do not rebuild the creator or duplicate the wizard preview. |
| F26 | Class/rules-aware spell-list semantics and independent Always Prepared modeling | **Defer.** Clarify existing lists first. Changing preparation/use-tracker coupling needs explicit data compatibility and regression work; it is not a label-only quick win. |
| F27 | Structured custom weapon/armor fields | **Defer.** Add only fields required by a real custom item, mapped into existing item/stat paths. Keep freeform entries. A general item builder and modifier engine are outside scope. |
| F31 | Library search, sorting, and character duplication | **Defer until library size warrants it.** Search/sort can be a small local feature later. Duplication needs a new identity and deliberate handling of session state and sharing; avoid treating it as a trivial copy. |
| UI guide | Further bundle optimization | **Defer unless loading is measurably disruptive or a build limit is reached.** Existing lazy loading is already implemented; a warning alone does not justify an architecture project. |
| UI guide | Preserving unfinished presentation-specific inputs on responsive layout changes | **Targeted follow-up.** Verify the documented remaining gap, then lift only affected draft state to a shared owner. Prioritize it if normal rotation/resize loses player input; no layout rebuild is needed. |

Real-device touch/keyboard checks from both guides remain useful verification work,
not a new feature. Include them with the layout and interaction changes instead of
creating a separate accessibility or device-framework project.

## Delivery and implementation guardrails

1. **Small first batch:** Q1–Q6, with Q9 if the narrow-screen issue reproduces.
   These directly improve table use and clarity with little data-model work.
2. **One focused layout pass:** larger change 1. Record comparable screenshots and
   scroll measurements; stop once the actual bottlenecks improve.
3. **One play workflow at a time:** Limited-use abilities, then manual health.
   Prioritize companions according to actual play needs.
4. **Creator guidance:** ship copy/navigation improvements independently; follow
   with draft-safe content setup and the advisory checklist.
5. **Reassess after a real session:** pick optional additions based on observed
   friction, not completion of every suggestion in the original review.

Reuse the store, editor change notifications, existing save/sync pipeline, dialogs,
content cache, and detail renderer. Viewer adjustments must mark the current
character changed through the existing path; viewing, filtering, and expanding
content must not mutate saved data. Preserve manual values and imported content.

Prefer derived UI state for the first increments. For any later persistent field
(favorites, exhaustion level, stabilization), check older-character loading,
portable import/export, saving, and account synchronization before calling it done.
Do not introduce a new backend or parallel character document format.

For spacing and copy changes, use focused rendered checks at 320/390 px, tablet,
and desktop, with keyboard focus and existing themes. Add regression tests where
state changes or draft preservation warrant them. Do not add tests that merely
repeat labels. Run the relevant existing tests and build for implementation work;
this document-only assessment does not claim a new test run.
