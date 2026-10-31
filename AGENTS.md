# Working preferences

## Versions and releases

- Work on a separate branch. Merge to `main` only when the user asks for it.
- Use semantic versioning. The initial versioned release is **1.0.0**.
- `package.json` is the version authority. Keep the root versions in `package-lock.json` synchronized; the small fixed footer on every route reads this version directly. Never maintain a separate hardcoded UI version.
- Every successful publication must use a new version. For the first release of a new feature, increment **minor** and reset patch to zero. Further releases, fixes and refinements within that same feature increment **patch**. Breaking changes require a **major** increment, following semantic versioning. An explicit version requested by the user takes precedence, including the initial 1.0.0 release.
- Before building the release, update the version with `npm version <minor|patch|major|explicit-version> --no-git-tag-version --ignore-scripts`. Do not automatically increment during ordinary builds or deploy preparation. A retry of a failed publication may reuse its still-unreleased version.
- Prepare concise notes in `.github/release-notes/X.Y.Z.md`. Commit the reviewed release source, deploy that exact commit and verify the published files. Push the source branch and an annotated `vX.Y.Z` tag pointing to that source commit. `.github/workflows/release.yml` creates the matching **GitHub Release**, checking tag/package/lockfile versions first; verify the workflow/release when GitHub API access is available. Do not tag the generated `gh-pages` commit, overwrite existing release tags, or merge to main implicitly.
- A Git tag alone is not a GitHub Release. If GitHub authentication or network access prevents release creation, report the incomplete step explicitly and retain the correct tag/source identity for retrying it.
- After each release, always tell the user the **current version**, along with the published URL and any incomplete release step.

## Keep verification proportional

- `npm test` runs the small core safety group. It is not full product coverage.
- For a bounded feature or fix, use `npm run test:changed -- --list`, then run the affected checks once. Explicit production/spec/template/style paths can be passed to `npm test -- <paths>`; use `--base <revision>` for branch-wide impact.
- Small styling, spacing, labels and icons need focused rendering/compile checks, not new label-only tests or the complete suite.
- Reserve `npm run test:all` for cross-cutting document/migration, synchronization/security, schema or test/build infrastructure changes, or an explicitly requested broad audit. Local behavior changes do not automatically require it.
- Pure behavior tests use the direct Node runner. DOM/template tests use Angular. Do not route all tests through Angular or include unrelated suites out of habit.
- A deployment already creates a production build. Do not add a separate production build immediately before it unless a specific build concern needs investigation. Test-only changes do not need a production build.
- If a broad run fails, inspect and rerun the failing file/test; do not repeatedly run the complete suite, comparison suites and alternate configurations. Fix the relevant fixture or behavior. Report unresolved failures instead of hiding them with skips or a larger global timeout.
- Do not run a large build and a full suite concurrently when investigating timing failures.
- Schema generation is cached for tests and invalidated by input/output contents. Keep `schemas:generate` and `schemas:check` authoritative; do not weaken validation to make tests faster.
- Remove tests only when they add no independent regression protection. Do not merge unrelated assertions just to lower a test count.
- After the relevant checks pass, stop and report the actual scope/results. No unsolicited repeat suite/build.
- Keep changes focused; avoid unrelated cleanup and refactoring.

## Code Structure

- Keep Code well structured and humanly readable where possible
- Provide well typed structures for data where possible
- Provide mappings (e.g. M -> Medium or "Abjuration" -> "Abj.") in one place so they can easily be reused
- Do not write redundand code and reuse components where possible
- Provide folder structures to separate components if useful

## UI style

- Follow Existing Components: Compact, clearly grouped content with a
  strong label/value hierarchy, aligned baselines, and consistent spacing.
- Use subtle themed surfaces to group related details. Show short qualifiers as small badges; place longer conditions beneath their value as muted notes with an accent line, rather than a chain of parentheses.
- Use the shared SVG icons instead of emojis. Give unfamiliar icons a tooltip and accessible label; use the app's existing color tokens.
- Reuse existing component styles exactly for equivalent controls. Keep badge dimensions stable while editing, and place reset/extra-detail controls consistently.
- Preserve readable wrapping on mobile and desktop. Keep supporting information visibly connected to the value it describes without crowding the main row.
- Provide separate designs for desktop and mobile where necessary

# Extra

- Capitalize words at the beginnings of sections, after : and in enumerations
- When looking for features to implement in the data, look mainly for data from the sources XDMG, XPHB, XMM, EFA, and MPMM and maybe TCE and XGE. Other books are more optional. It is still fine to look in them for examples, but it should be lower priority. Schema is king though and should be the ground truth
