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
`features-editor`, `spells-editor`, `items-editor`, `monsters-editor`,
`combat-editor` and `bastions-editor`. They receive the sheet and emit `edited` after changing it.

Bastions stores independent facility snapshots, note groups and an optional external
plan image URL under `sheet.bastion`. It reuses the catalog, entry rows and notes
editor with use trackers disabled. Facilities can repeat with separate identities.
Facilities start without note groups; users add them through the notes editor.
The viewer uses the same facility details and plan preview. Related rewards and
tables are accessible in the Compendium and require an up-to-date content import.

Reusable UI lives beside the pages: `editor-list-header`, `entry-annotations`,
`feature-source-picker`, the catalog and confirmation dialogs, and combat
bookmarks. `editor.css` holds shared editor styles. `EditorCatalog` handles content
search, pagination and cancellation. Selection helpers and the `rules` directory
hold the data transformations and character rules.

`basic-info.spec.ts` exercises the shell and first three pages together. The other
page and helper specs live next to their implementations.

The Class Wizard builds a detached proposal and only replaces the editor draft
after explicit application. Its review compares actual before/after values,
separates retained manual HP from the class HP calculation, and links unfinished
choices back to their controls. Disabled prefill sections omit their decisions
without deleting saved answers. Classes, their displayed total level and background
follow the first step; other sections preserve manual edits unless explicitly
overridden. `wizard-review.ts` formats the changes and their sources;
`wizard-guidance.ts` provides optional suggestions based on observable omissions.
The wizard's typed `editRequested` event follows `applied`, so Apply & Open hands
the accepted draft to a shared editor page without saving or losing wizard history.
