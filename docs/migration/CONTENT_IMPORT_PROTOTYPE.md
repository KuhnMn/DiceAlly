# Milestone 2: content import prototype

Status: Milestone 2 accepted for desktop. Importing, mappings, reference linking, compatibility auditing and cache recovery are implemented and tested. The user checked locally on desktop and chose to defer further automated browser measurements and mobile verification.

## Try locally

Run `npm start` and open `/dev/content` on the development server (normally `http://localhost:4200/dev/content`). This route is excluded from production routing; invite-only authentication will be introduced in M5 before publishing these workflows.

The page provides editable GitHub owner/repository/branch/data-directory settings, persisted in IndexedDB. `Check for updates` compares the resolved branch commit to the active revision without changing content. `Import / reimport content` starts a background worker; cancel stops it and removes staging records. The page shows progress, errors, measurements, and class/species/item browsing after successful activation. It does not change saved characters.

The prototype uses namespace `development-local`. The cache APIs accept a namespace so the authenticated account ID can replace this at M5. This development namespace is not an authentication mechanism.

## Implemented

- GitHub commit resolution followed by commit-pinned raw downloads; no GitHub token in browser configuration.
- Class, spell, and bestiary index discovery plus supported root/secondary files; approximately 156 files for the checked source revision.
- File-by-file parsing/mapping in a module Web Worker. The database stores batches of 128 records; linking reads pages of 128. There is no all-corpus in-memory array in the browser importer.
- Records retain rich upstream fields so creator metadata is not lost through a viewer-only projection.
- Composite logical keys with class/subclass/level qualifiers; item abbreviations and variant inherited publication identities.
- Copy inheritance and common array/text/property transformations, plus copied monster spell/skill edits. External monster templates are fetched on demand from `bestiary/template.json` at the same commit, including copied template definitions. Unsupported transformations fail visibly rather than silently discard content.
- Template roots respect explicit child values; modifiers are combined in order. Name/DC/attack/damage placeholders use a restricted arithmetic parser, not JavaScript evaluation. Applied template references remain as provenance links.
- Class/subclass feature references, parent classes/species, base-item references, copy bases, and secondary spell-class membership overlay.
- Staged revisions with an atomic active-pointer switch only after validation; previous active revisions retained.
- IndexedDB source preferences, active pointers, revision/category indexes, cancellation and failure cleanup.
- Tests cover commit pinning, invalid/missing references, duplicates, modifiers, cancelled imports, staged activation, namespace isolation, paging and rollback/discard.
- A read-only upstream compatibility probe at `scripts/probe-content.mjs`. Run `node scripts/probe-content.mjs`; it fetches public data into memory, prints metadata/diagnostics, and writes no content files. It uses the installed Angular toolchain's esbuild to load the TypeScript importer. This is developer tooling, not a browser benchmark.
- [Secondary mappings](SECONDARY_MAPPINGS.md): normalized/merged species, playable base items/groups, generated magic variants, and publication-aware item enrichment. Adapter version 6 stores data and validated references; item presentation is assembled on demand by `resolveItemView`. Explicit reimport applies the audited inheritance/text/null-removal fixes.
- [Reference linking](CONTENT_LINKING.md): fixed spell grants, spell choices/expanded lists, item-group membership and supported inline/structured description references. Bounded dependency traversal follows selected records, with catalogues excluded by default.

## Real-dataset probe

Measurements below are from adapter version 6, following the [copy/mapping audit](COPY_SEMANTICS_AUDIT.md).

Checked commit: `8c026b807fac21862a309379a0c3228a0683198b` of the configured default repository.

| Measurement | Observed |
| --- | --- |
| Supported files including template dependency | 157 |
| Downloaded JSON and indexes | 24,058,503 bytes (22.94 MiB) |
| Stored raw + materialized records | 21,629 |
| Serialized records after materialization/enrichment/linking | 47,375,420 bytes (45.18 MiB) |
| Most recent successful Node probe time | Approximately 4.34 seconds |
| Sampled Node heap maximum | Approximately 225 MB |
| Activation | Passed in the Node probe |

The entire repository is larger; these numbers describe supported character-related categories, not every book/adventure/fluff file. Node retains records in an in-memory test cache and downloads may be cached by the host. These measurements do not prove IndexedDB space requirements, peak browser memory, first-download speed, or phone responsiveness. Heap sampling happens at progress boundaries and is not an exact peak measurement.

The earlier error `Copy traits/templates require an adapter handler` came from named monsters that copy a base stat block and apply a species/other template. For example, Afsoun Ghorbani in `bestiary/bestiary-jttrc.json` references Archmage plus the High Elf template. The importer originally did not load that dependency and rejected 189 records. This is now supported, and the full source probe passes. Legacy `_trait` syntax remains an explicit unsupported-format error; unknown or missing named templates still block activation. No runtime source data is bundled into this repository.

## Deferred verification

The [copy and mapping audit](COPY_SEMANTICS_AUDIT.md) is complete for supported records at the pinned commit. New unsupported operations still fail explicitly and need a future compatibility audit when encountered.

[Interrupted-worker recovery and cache management](CACHE_RECOVERY.md) are implemented. The user accepted their local desktop check and explicitly deferred the additional browser suite and mobile checks. Cold-import/storage/memory measurements and real-browser interruption/quota scenarios remain unverified rather than blocking the current milestone. Revisit these checks and batching optimizations if desktop or mobile issues appear.

## Verification

Use `npm test -- --watch=false` and `npm run build`. Tests cover template support, mapping preservation, explicit publication resolution, formulas, references, bounded dependency traversal and rollback. A stale starter title assertion was updated to check the application's actual `.app-title`. The build currently exceeds the configured 520 kB initial warning budget while remaining below its 1 MB error budget. Content worker/UI code is lazy-loaded.

The fake-indexeddb development dependency verifies database behavior deterministically; it does not replace browser acceptance tests. No content corpus, personal character data, or credentials were added to the repository.

Implementation references: [Angular workers](https://angular.dev/ecosystem/web-workers), [GitHub commits API](https://docs.github.com/en/rest/commits/commits#get-a-commit), and [upstream copy utilities](https://github.com/5etools-mirror-3/5etools-src/blob/main/js/utils.js). Consult the pinned upstream version when finalizing the adapter.
