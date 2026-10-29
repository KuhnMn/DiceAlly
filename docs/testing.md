# Test audit and working checks

Reviewed 29 October 2026. This is a structural/source audit and a measurement of actual runs, not a claim that every assertion has been individually proven essential.

## Findings

The previous suite had **891 expanded test cases in 146 files**. Most protect useful behavior: import rejection and atomic activation, materialization/copies, choice and level boundaries, saved data, resource consumption, synchronization conflicts, or real touch/navigation regressions. A numerical target such as “delete 700” would discard independent protection without addressing the biggest costs.

There were also low-value tests. The App constructor/title boilerplate has been removed: the remaining App behavior tests instantiate the same shell and protect routing/sign-out behavior. The Pipe constructor-only test has been replaced by a pure sentence-casing test covering Unicode, empty text and preserved spelling. Full product coverage now contains **889 cases**; ordinary edits no longer run all of them.

### Where the wait came from

Recorded previous runs in this environment:

- Angular test bundling alone: approximately **30–47 seconds**.
- Complete execution after bundling: approximately **35–45 seconds**.
- Schema regeneration: approximately **17 seconds**, including recompiling unchanged validators. This was an unconditional `pretest` step.
- Angular tests loaded large UI trees and generated schema modules even for many plain behavior tests. Test environments contributed substantial aggregate work. Smaller test counts alone did not eliminate the compiler startup.
- The previous Homebrew work repeated complete runs, baseline runs, alternate runner configurations and a separate production build before deployment. That was excessive verification orchestration and a major avoidable part of the delay.

### Which failures were observed

The previous standard full runs did not consistently pass: they timed out in `refresh-character-content.spec.ts`, followed by a library/draft assertion failure; another run reported an invalid canonical item in `items-editor.spec.ts`. A run with a longer global timeout passed 891/891. That result did not establish that the normal workflow was stable. A fully isolated experiment repeatedly loading the schema modules hit a separate schema warm-up timeout.

Concrete fixture fixes in this change:

- Custom-item editing explicitly starts without an active external library. It no longer reads whatever content a preceding test left installed.
- Two description-refresh tests exercise save/error/concurrency behavior through the real editor class with an empty presentation. They no longer initialize unrelated editor pages just to test state transitions.
- The row-identity integration test opens its actual Spells page before the first rendering, rather than rendering Basic Info first.
- Node-based loading tests explicitly model an online browser. The “Web Locks unavailable” test explicitly removes the capability; modern Node now has Web Locks, so relying on its absence was incorrect.

These changes do not weaken application validation or increase global timeouts.

## Default: a small critical safety group

`npm test` runs **75 cases in 16 files**, directly through Vitest in Node. The measured warm run is about **3 seconds of Vitest execution / 4–6 seconds end-to-end**, without Angular bundling or a browser DOM. Exact timings depend on the machine and whether artifacts are already generated.

The group covers health/rest operations, slot/resource spending, level/stat calculation, character identity and detached copies, save/reopen/preview handling, synchronization/conflicts, error presentation, search ranking, speed and bounded lazy-module retry. The selection is explicit in `scripts/test-catalog.mjs`, and a tooling test verifies that its files exist and remain Node-compatible.

This is a safety net, not a claim that Compendium rendering, Bastions or all import schemas have been checked. For a feature change, also use the affected checks.

## Check only the affected area

```sh
npm run test:changed -- --list
npm run test:changed
npm run test:changed -- --base origin/main --list
npm test -- src/app/content/homebrew-updates.spec.ts
npm test -- src/app/content/content-import.component.html
```

Without paths, changed selection includes staged/unstaged changes and untracked files. `--base` compares the current working tree with a Git revision. A clean tree falls back to the quick group. Explicit paths allow checking an already committed change without pretending it is uncommitted.

The planner follows relative imports, re-exports, dynamic imports, worker URLs, templates and styles to their transitive test consumers. Schema/shared build configuration changes conservatively select the full product suite. Documentation-only changes select no product tests. Production files without discovered test consumers are reported explicitly: absence of a matching test is not proof of correctness. This is a static import-graph heuristic, not runtime coverage or a replacement for engineering judgment about indirect behavior.

For example, changing the Homebrew update helper selects its unit tests and the Game Data UI tests. A cross-cutting change to the shared character document will naturally select more consumers.

## Broader checks when justified

```sh
npm run test:unit
npm run test:ui
npm run test:all
npm run test:tools
```

All ordinary behavior/data files run directly in Node. Tests needing TestBed, DOM or browser storage use Angular's compiler/runner. The catalog automatically assigns every spec to one runner, so adding a test does not silently remove it from full coverage. `test:all` runs Node first, Angular second, then the test-tooling and release-asset checks; it stops on failure.

A full check is justified for shared document/migration, synchronization/security, schema, or test/build infrastructure changes. A local UI/behavior fix ordinarily needs only its relevant checks. Schema tooling and Firebase-emulator security tests remain separate specialist commands; run them when those contracts change.

For repeated work on one UI file, keep its compiler alive:

```sh
npm run test:ui -- src/app/sheet/spell-cast-control.component.spec.ts --watch
```

Do not watch both runners through one invocation. Avoid a production build just to validate test-only changes. Deployment already creates a fresh production build.

## Schema cache and correctness

Test commands fingerprint all local schema inputs, generator helpers and the dependency lock, and verify the actual generated output hashes. An unchanged cache skips generation. Missing/edited outputs or changed inputs force generation; timestamps alone never decide validity. A missing cache after checkout generates once. The stamp lives under ignored `.angular/cache` and is not committed.

`npm run schemas:generate` still explicitly regenerates, and `npm run schemas:check` still recomputes and checks reviewed artifacts. Deployment continues its authoritative generation/build path. No test dependency was added.

## Validation of this change

- Quick group: 75/75, 3.58 seconds in Vitest / 5.22 seconds including orchestration on a warm cache.
- Complete Node behavior/data group: 329/329 in 55 files; 18.17 seconds in Vitest. The first cache-seeding invocation also spent about 17 seconds generating schemas.
- Complete Angular UI group: 560/560 in 91 files, with ordinary timeouts; 37.67 seconds of bundling and 44.94 seconds of execution (87.72 seconds including orchestration).
- Test-selection/cache checks and retained-release tests pass separately.

The complete split suite is still expensive and may take as long as or longer than the old single full run. The intended improvement is the 75-case daily path, relevant-file selection, reusable schema artifacts and reliable fixtures—not a promise that running every regression will be cheap. No product build is needed for this test-only change.

## Follow-up boundaries

Large integration files such as class wizard, mobile swipe and Compendium should remain available: they cover distinct data choices and interaction regressions, not merely repeated labels. Further deletion needs a concrete overlap case. The important next workflow change is to use the appropriate group, fix a failing fixture locally, and stop after the relevant verification passes. Repeated broad retries and globally relaxed timeouts are not the default recovery plan.
