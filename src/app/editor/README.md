# Character editor

Start with `local-editor.component.ts` and its template. This shell owns the current
sheet, route loading, saving, unsaved-change protection, page navigation and wizard.

The first three pages have a component for their controls and a model for their
editing actions:

| Page | Component and template | Editing model |
| --- | --- | --- |
| Basic Info | `basic-info-editor.component.*` | `basic-info-editor-model.ts` |
| Ability Scores | `ability-scores-editor.component.*` | `ability-scores-editor-model.ts` |
| Proficiencies & More | `proficiencies-editor.component.*` | `proficiencies-editor-model.ts` |

The shell keeps these models alive across page switches, preserving unfinished
inputs such as a sense name or hit-dice total. `EditorFormContext` supplies the
current sheet through a callback, so loading a character or applying the wizard
also updates the models. The models mutate that sheet and notify the shell through
`changed()` or `reportError()`; the shell handles persistence.

The page components register their controls with the shell's `NgForm`, preserving
form validation and submission. They use a block host with page spacing so moving
controls into a component preserves the original card layout.

The other pages are already separate components: `other-proficiencies` (general
proficiencies and feature sources), `spell-slots`, `species-editor`,
`features-editor`, `spells-editor`, `items-editor`, `monsters-editor` and
`combat-editor` and `bastions-editor`. They receive the sheet and emit `edited` after changing it.

Bastions stores independent facility snapshots, note groups and an optional external
plan image URL under `sheet.bastion`. It reuses the catalog, entry rows and notes
editor with use trackers disabled. Facilities can repeat with separate identities.
The viewer uses the same facility details and plan preview. Reward and table links
open source-scoped Compendium searches; their contents require an up-to-date import.

Reusable UI lives beside the pages: `editor-list-header`, `entry-annotations`,
`feature-source-picker`, the catalog and confirmation dialogs, and combat
bookmarks. `editor.css` holds shared editor styles. `EditorCatalog` handles content
search, pagination and cancellation. Selection helpers and the `rules` directory
hold the data transformations and character rules.

`basic-info.spec.ts` exercises the shell and first three pages together. The other
page and helper specs live next to their implementations.
