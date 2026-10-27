# Repository maintenance review

Reviewed: 27 October 2026.

## Cleanup decisions

- The application build is browser-only. Removed the disconnected Express/SSR
  entry points, server configuration, broken SSR serve command and unused direct
  server/Material dependencies. The CDK remains in use.
- Firebase owns current sharing. Removed both unused Cloudflare temporary-file
  workers and the standalone Wrangler package. This is a repository cleanup;
  existing remote deployments and stored data are unaffected.
- `.postcssrc.json` is the remaining Tailwind/PostCSS configuration. Removed the
  equivalent CommonJS configuration.
- `src/styles.css` owns active theme CSS. Removed unreferenced copies of the
  original palettes and the duplicate root icon; `public/app_icon.png` remains
  the served icon.
- Spell-school and casting-time metadata now live in `models/spell-metadata.ts`,
  so shared filters and the Compendium do not import the editor for display data.
  School labels use the same mapping as the filters. Ability labels are shared in
  `models/character-references.ts`.
- Theme values and their inferred type live together in account settings,
  removing the settings/service type cycle and duplicate theme union.
- Replaced the deprecated `substr` call with its equivalent `slice` range.
- Consolidated feature-use documentation, corrected runtime/share setup in the
  README, and moved the historical migration plan under `docs/migration`.
- Deployment preparation now generates content schemas before invoking Angular
  directly, matching the normal npm build's prerequisite on a clean checkout.

## Retained boundaries

Legacy character storage, import adapters, portable snapshot migrations and old
share cleanup still have consumers or protect existing saved data. They are not
dead code and were retained. `LocalCharacterRepository` also remains exercised by
document persistence tests; it is distinct from the active sheet repository.

Generated schema files are outputs of the schema tooling. Changes belong in the
generator or schema snapshot, not manual edits to generated validators/types.

## Remaining structural concerns

- `editor/spell-selection.ts` still combines catalog matching, snapshots, list
  membership and copy operations used by the editor and sheet. Moving those
  responsibilities needs a separate behavioral refactor around casting sources
  and per-copy use trackers; display metadata has been extracted here.
- Browser acceptance scripts repeat Chrome process/session setup. Their fixture,
  origin, timeout and cleanup policies differ. A shared harness would be useful,
  but should be extracted while running the affected browser scenarios.
- Global styles include a large set of theme tokens. A future theme extraction
  should preserve CSS cascade order and include visual checks across all themes.
- Dated migration/usability documents remain useful evidence but are not live
  specifications. The documentation index identifies their role rather than
  erasing parity cases or rewriting historical test results.

This review used local source/import references and build configuration. It does
not claim that all transitive packages are free of deprecations, or that live
Firebase rules and hosted deployments were audited.

## Verification

- Production build passed. Initial assets totaled 523.41 kB, exceeding the 520 kB
  warning threshold by 3.41 kB; the budget was not changed.
- All 836 unit tests in 141 files passed with a temporary Vitest configuration
  limiting `maxWorkers` to four. The first run alongside the production build had
  five timeouts and one TestBed initialization failure; the isolated rerun passed.
- All nine schema-tooling and release-asset retention tests passed.
- Application TypeScript checking and an offline `npm ci --dry-run` passed.
- README/docs relative Markdown file links and Git whitespace checks passed.

No browser/device acceptance, database emulator run or deployment was performed.
