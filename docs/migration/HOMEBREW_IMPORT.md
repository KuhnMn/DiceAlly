# Single-File Homebrew Import

Open `/dev/content` and use **Homebrew Files** to import one HTTPS JSON URL or one local `.json` file.
No homebrew repository is scanned. No file is selected or downloaded by default. Files are limited to 32 MB.
The feature follows the existing development-only content-import gate.

## Installed Content

The selected file joins the current installed library. Classes, subclasses, class features, feats,
optional features, spells, races/species and supported items use the normal content adapters.
Inline spell `classes.fromClassList` membership is normalized just like the main library's membership overlay.
Source-book IDs come from entity source fields; `_meta.sources` is also retained with the selected file.
Unsupported presentation/export categories such as book text and Foundry data do not become playable catalog entries.

Importing the same URL or local filename updates that installation and removes its obsolete records.
Identical contents selected through a different URL or filename do not create a second installation.
Other explicitly installed homebrew files and core content are retained. Reimporting the main library
replays the selected homebrew files. Character snapshots and wizard selections are not rewritten.

Raw homebrew documents are stored with revision metadata so updates can replay their original definitions,
including copy instructions, instead of repeatedly transforming materialized snapshots. Revision IDs identify
the combined library; the existing source identity and upstream commit remain stable when adding homebrew.
Inactive revisions can be cleaned up using the existing storage controls.

## Dependencies and Duplicates

Dependencies declared in `_meta.dependencies`, missing external references, and missing item/species metadata
appear as diagnostics. They do not cause automatic downloads. Available definitions remain usable; missing
mechanics can require importing the referenced book separately or manual editing. Invalid structures,
unresolvable copy operations and collisions with other installed files reject the import.

Within a single collection, compatible duplicate definitions merge supplementary metadata. Conflicting
definitions remain separate, labeled alternatives with stable distinct keys and a warning. References
to their original identity stay unresolved or ambiguous; the importer does not guess which alternative
the author intended. This handles the duplicate Arc Blade/Sulfuric Smoke metadata and the conflicting
Flares pack contents in the linked Valda collection.

Every import runs under the existing Web Lock in a background worker, builds a staging revision,
and activates it only after validation. Failure and cancellation discard staging data and retain the
previous active revision.

## Code Map

- `content-import.component.ts`: file/URL controls and shared worker UI.
- `content.worker.ts`: reads exactly the selected file and dispatches the import.
- `homebrew-package.ts`: metadata, digest, duplicate handling and raw-definition staging.
- `homebrew-importer.ts`: combines the installed core with explicitly selected homebrew files.
- `content-finalizer.ts`: shared copy resolution, materialization, linking, spell membership and activation.
- `content-importer.ts`: core repository import, including replay of selected homebrew files.

## Verification

`homebrew-importer.spec.ts` covers core preservation, inline spell classes, materialized species, updates,
multiple files, duplicate handling, missing dependencies, malformed input, collisions, cancellation and
retention through a core reimport. Existing importer tests continue to verify the shared finalization pipeline.

`scripts/homebrew-import-acceptance.mjs` uses an isolated browser profile and the actual Valda collection
downloaded to `.angular/valda-homebrew.json`. It checks upload and URL paths, repeat import, failed import,
mobile layout, Wizard class filtering for Minor Lifesteal, and saving a copied spell on a character.
The core fixture is deliberately small; unresolved external-reference warnings are expected in that test.
Results are recorded in `homebrew-import-acceptance-results.json`.
