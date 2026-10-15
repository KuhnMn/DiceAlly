# Creator and viewer integration

The library, creator and playing sheet now share one character record. Editing a
character does not create a copy or discard its playing state.

- `/` lists saved characters and imports existing character JSON files.
- `/characters/new` opens the creator.
- `/characters/:id/edit` loads a saved character into the creator.
- `/characters/:id` loads that character into the playing sheet, including after a reload.
- **Save & View** saves the creator before opening the sheet. **Edit** saves the
  playing sheet before opening the creator. **Menu** returns to the shared library.

Creator routes and buttons retain the current development-only availability.
Authentication and account isolation are still required before production rollout.

## Persistence boundary

`CharacterLibraryService` owns library operations. Its injected
`CHARACTER_REPOSITORY` implements an asynchronous `CharacterRepository` contract;
components do not open IndexedDB or write character JSON to localStorage.
`IndexedDbCharacterRepository` currently persists records in the existing
`ally-character-editor-v1` database. Each record has a stable ID, full sheet JSON,
revision number and update timestamp. Saves compare the expected revision in a
single transaction. A stale tab receives an error instead of overwriting a newer
record. Saves snapshot their input before awaiting storage work.

The full JSON includes embedded features/spells, notes, uses, preparation state,
inventory, current HP, and creator wizard metadata. The playing sheet continues
using its existing rest rules. Full JSON export reads the shared repository;
minimal QR/share exports retain their existing smaller payload format.

Existing viewer localStorage saves are copied automatically under their original
IDs. Canonical records always take precedence; originals remain as backups.
The former editor workflow that created a separate copy has been removed.
Deletion writes a versioned tombstone, so a backup cannot resurrect a deleted
character. Explicit JSON import can restore it. Old character JSON remains an
accepted import format; it is not an alternative active persistence system.

## Future database syncing

Remote syncing is not implemented yet. The asynchronous repository boundary can
support a local-first sync adapter without changing editor or sheet callers.
Before enabling it, add authenticated account ownership, a durable pending-write
queue, server revisions, and an explicit conflict policy. Local revisions are
concurrency checks within this browser database, not server revision numbers.
Timestamps alone must not decide which remote edit wins. Tombstones must be
retained until deletion has been acknowledged by the server.

## Verification

`character-library.spec.ts` covers imported originals, deletion tombstones, stale
writes, snapshot isolation, portable imports and preserved playing state.
`scripts/creator-viewer-integration-acceptance.mjs` exercises actual browser
navigation, editing/playing round trips, saved URL reloads, library visibility,
and full export loading. Run it against `ng serve` on port 4201.
