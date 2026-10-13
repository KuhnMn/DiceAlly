# Interrupted imports and local cache management

Implemented in `content-cache.ts`, `content.worker.ts` and the development content-import page. All 58 tests pass; production build succeeds with the existing initial-bundle warning. Actual desktop/mobile browser acceptance remains unverified.

## Recovery

Every worker import acquires an exclusive Web Lock named for the account namespace, shared across sources, tabs and workers. Opening the development page or starting a new import removes abandoned staging revisions only while holding that same lock. A competing importer or cleanup returns a visible retry message. No age timeout guesses whether an import is still running.

Normal cancellation discards staging before releasing the lock. Worker crashes, terminated workers and closed tabs can leave staging behind; the next page opening/import cleans it up. An unexpected worker error also attempts recovery after termination. Ready revisions are retained. The active-pointer check and record/revision deletion share a transaction, protecting active content for every configured source and branch.

IndexedDB schema version 3 retires pre-lock version 2 connections via the existing version-change handler. No stores or ready content are deleted by the upgrade. Close/reload old tabs if an upgrade is blocked. Content adapter version stays 6; this change does not require a content reimport.

Imports and cleanup require Web Locks. If unavailable, they fail visibly without deleting data; read-only browsing remains available. Development still uses the `development-local` namespace. Account namespaces will replace it when authentication is implemented.

## Storage controls

The development page lists this account's cached revisions with source, branch, commit, creation date, adapter version, status, actual record count and completed-import serialized size. It also displays the browser's entire-site storage estimate; serialized content size excludes IndexedDB indexing overhead and is not exact allocated storage.

Users can remove individual inactive revisions. Active revisions have a disabled control and are checked again transactionally. Namespace checks prevent deleting another account's revision. No bulk database deletion or active-source reset is exposed. This operation only touches the content database's records/revisions stores; source preferences, active pointers and separate character storage are retained. Future persisted character documents must continue embedding selected snapshots rather than depending on retained cache revisions.

## Automated verification

Fake IndexedDB plus an injected lock manager verify abandoned-import recovery across cache instances, preservation of active/retained/other-account records, idempotent cleanup, refusal to clean up live imports, lock release after failure, recovery before retry, deletion of only inactive owned content, protection of other-source active pointers and safe failure without locks. Existing importer cancellation/rollback and atomic activation tests continue to pass.

## Deferred browser acceptance checklist

The user reports checking locally on desktop and accepts that for the current milestone. Additional automated scenarios, detailed measurements and physical-device checks below are deferred by request; they are not recorded as passing.

1. Cold-import the supported dataset on desktop and a representative phone. Record download/import time, database allocation, sampled memory and UI responsiveness.
2. Start an import in one tab and open the importer in another. Confirm recovery/management cannot interfere with the live import.
3. Cancel an import, then terminate a worker or close a tab during another import. Reopen and confirm incomplete content is removed and the old active content still browses.
4. Import twice, remove the inactive revision and reload. Confirm active content, preferences and existing character viewer data remain intact.
5. Exercise storage quota failure and blocked database upgrades; verify visible errors, cleanup/retry and preservation of the active revision.

No physical phone or completed real-browser memory/quota results have been recorded. These checks no longer block Milestone 2 for the accepted desktop scope. Revisit them if problems arise. The experimental `scripts/browser-acceptance.mjs` remains available for later work; its initial automated attempt was inconclusive, not a successful acceptance run.
