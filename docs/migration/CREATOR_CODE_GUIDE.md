# Reading the Character Creator

The creator edits the same portable `ExportedCharacter` JSON that the live viewer reads.
The wizard proposes an initial fill; it does not impose ongoing class restrictions on the editor.
Neither the creator nor the rules engine reads descriptions to discover mechanics.

## Where to Start

| Concern | Code |
| --- | --- |
| Page navigation, draft and saving | `src/app/editor/local-editor.component.ts` |
| Offline character storage | `src/app/editor/basic-info-repository.ts` |
| Wizard selections and stage transitions | `src/app/editor/class-wizard.component.ts` |
| Assemble a proposed sheet from those selections | `src/app/editor/class-wizard-preview.ts` |
| Preserve manual changes when applying a proposal | `src/app/editor/wizard-prefill.ts` |
| Resolve class/subclass feature references | `src/app/rules/feature-rules.ts` |
| Read additional spell definitions | `src/app/rules/spell-rules.ts` |
| Read choice counts, candidates and level requirements | `src/app/rules/spell-choice.ts` |
| Evaluate spell filters such as `level=0\|class=Wizard` | `src/app/rules/spell-filters.ts` |
| Merge inline spell classes and `spells/sources.json` membership | `src/app/content/spell-membership.ts`, `src/app/content/content-importer.ts` |

## Example: Why Can an Arcana Cleric Choose Two Wizard Cantrips?

The Arcana Domain subclass in `class-cleric.json` supplies this structured rule:

```json
{
  "additionalSpells": [{
    "known": {
      "1": {
        "_": [{ "choose": "level=0|class=Wizard", "count": 2 }]
      }
    }
  }]
}
```

1. The imported subclass retains `additionalSpells`. The wizard validates that the subclass belongs to the selected Cleric and its source book, then registers it as a spell owner in `previewClassWizard`.
2. `deriveSpellGrants` visits the selected block and the `known` list. `isSpellRequirementMet` checks that the selected class has reached level 1. The nested `_` is a grouping with no special use limit; it does not create a recovery tracker.
3. `describeSpellChoice` reads `count: 2` and passes `level=0|class=Wizard` to `filterSpells`. Clauses separated by `|` must all match: the spell must be a cantrip **and** belong to the Wizard spell list. That class membership comes from the imported membership overlay or the spell's inline `classes` field.
4. The rule returns a stable choice ID and eligible spell keys. The wizard displays those candidates and stores selected keys in `state.answers[choice.id]`.
5. `isCompleteSelection` requires exactly two distinct eligible keys. Once answered, `deriveSpellGrants` generates the selected spells; `previewClassWizard` converts them into normal Known spell entries under the Arcana Domain casting source, using the Cleric's Wisdom fallback.
6. `mergeWizardPrefill` adds them to a detached draft, preserving protected manual edits. Apply replaces the draft; Save writes it to local storage. The playing sheet can display the copied spell snapshots without access to the full library.

There is no `if Cleric then choose Wizard cantrips` special case. Another subclass, species or feature with the same definition follows the same path. The generic `SpellGrant` is an internal explanation of why a generated spell exists; it is not a setting the user needs to manage.

The regression test **“reads Arcana Domain’s structured rule for exactly two Wizard cantrips”** in `class-wizard.spec.ts` uses this exact rule shape. It excludes Wizard leveled spells and Cleric-only cantrips, rejects an incomplete or duplicate answer, and verifies the resulting Known entries and Wisdom source flag. The readability pass also fixed support for the nested `_` grouping; the previous parser rejected it.

## Reusable Editor Pieces

- `EditorCatalog` owns shared result/loading state, search debouncing, paging, refresh and stale-response protection for Features, Spells and Species. Each component supplies a `CatalogQuery` with its content kinds, search and filtering predicate. Spell-specific class-option loading is a refresh preparation callback; bulk spell addition remains a separate operation.
- `activeContentRevision` is the common selected-source/active-import lookup for catalogs, the tool picker, source-book filter and wizard. The wizard still prefers its saved pinned revision before using that lookup.
- `FeatureSourcePickerComponent` owns every feature/casting-source selector in the active creator: the two list filters, feature and spell catalog destinations, individual feature assignment, and spell-slot creation/reassignment. Card mode offers All; compact dropdown mode searches inside the popup, optionally offers Unassigned, and retains missing legacy assignments. Both modes share options and the blue or purple themed container. The parent retains source-selection behavior.
- `SourceBookFilterComponent` is the single book-selector UI used in the creator header, Features/Spells/Species catalogs and wizard. Its service shares the selection globally. It and the feature/casting-source picker use the same `selector-panel` styles; books use the theme's secondary accent, features use blue, and casting uses purple.
- `contentReference` constructs snapshot provenance in one place for manual feature/spell/species additions and wizard-generated entries.
- `feature-selection.ts` defines feature categories and creates portable feature entries for both the catalog and wizard. Generated IDs and manual IDs are supplied separately; snapshot cloning and type-specific fields share one implementation.
- `EntryAnnotationsComponent` supplies one Notes/Uses UI for features, spells and species. `EntryAnnotationsEditor` handles draft notes, multiple entries under a heading, keyboard shortcuts and use trackers.
- `RECOVERY_OPTIONS` provides the same recovery values and labels for slots and every use tracker; it has no dependency on an Angular component.
- `featureSourceStats` calculates the source cards using the playing sheet's existing modifier and proficiency helpers.
- `editor-content-helpers.ts` holds pure snapshot, HP, ability-flag and spell-use conversions. These functions return values; they do not save or mutate the current sheet.
- `SearchableSelectComponent` keeps search inside the selection popup for wizard selections and tool proficiencies, sharing keyboard navigation, focus restoration and outside-click handling. `CatalogDialogComponent` supplies the catalog/wizard workspace. `RemoveEntryDialogComponent` supplies themed destructive confirmations.
- `DialogScrollLockService` keeps background scrolling locked until all nested dialogs have closed, including a species replacement confirmation over its catalog.
- `local-editor.component.css` defines cards, controls, compact actions, icon actions, filters and mobile sizes using the sheet's theme variables. Use those classes before introducing another individual size override.

## How Manual Edits Win

The wizard saves the last generated value in `creatorWizard.baseline`. A later proposal compares the current sheet with that baseline. A difference, a manual deletion or a collision protects that value. Notes, use settings and used counters are carried forward independently of generated descriptions. Obsolete generated entries are removed only when untouched; annotated or consumed entries and their linked sources remain.

The wizard preview is pure and detached. UI components own navigation and draft edits; rule handlers own eligibility and choices; the repository owns persistence. Keep new mechanics in the appropriate handler instead of putting class-specific conditions in a template.

## Verification

`npx ng test --watch=false` exercises the rules, saved JSON and editor workflows.
The browser scripts in `scripts/creator-layout-acceptance.mjs` and `scripts/class-wizard-acceptance.mjs`
check mobile and desktop layouts in light and dark themes using an isolated local profile.
Their reports are stored beside this guide. These are viewport checks, not physical-device tests.
