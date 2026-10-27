# Firebase setup

The selected backend is Firebase Authentication and Realtime Database on Spark.
Character documents stay in IndexedDB, with cloud revision/hash checks before downloading
changed bodies. Conflict resolution must preserve both versions. Illustrations use external
URLs; Firebase Storage is not required.

## Local configuration

Copy `.env.example` to `.env` and fill in the Firebase web app settings from the console.
The local `.env` and generated `public/runtime-config.js` are ignored by Git.
`npm start`, `npm run watch`, and `npm run build` generate configuration automatically.
After changing environment variables, restart the dev server. When invoking Angular directly
with `npx ng`, run `npm run config` first.

The generator accepts UTF-8 environment files, including Windows BOMs. Hosting environment
variables override `.env`. Partial Firebase configuration fails with missing variable names;
values are never printed. With no Firebase variables it generates a local-only configuration.

Web configuration is public after deployment. Environment files prevent committing deployment
settings, but cannot hide them from browsers. Never supply service-account or admin credentials.

## Project and account

- Project: `dice-ally`
- Database: `https://dice-ally-default-rtdb.europe-west1.firebasedatabase.app`
- Intended site: `https://diceally.pages.mxkuhn.de/`
- Initial administrator-approved account UID: `jmBueXWwZIZn8NgdU4US84Dw5dn1`

Enable Email/Password in Authentication. Add `diceally.pages.mxkuhn.de`, `127.0.0.1`,
and optionally `localhost` to Authentication's authorized domains. Keep the database in
locked mode until reviewed security rules are implemented and deployed. The UID above
documents the account to approve; it does not itself grant access.

## Deployment configuration

Set the variables listed in `.env.example` in the hosting provider's build environment.
Use `npm run build` so configuration is generated before Angular copies public assets.
The generated static application is in `dist/AllySheetViewer/browser`.
Serve application routes with an SPA fallback to `index.html`.

The domain does not require Firebase Hosting. Its DNS and static hosting setup can be
configured independently. Authentication, approval guards, cloud synchronization and conflict
handling are implemented. Before publishing, verify the database rules and account access
for the intended environment; implementation alone does not verify a live deployment.

## Implementation status

Environment configuration, email/password sign-in, password reset, approval route guards,
and account-separated local character caches are implemented. Database rules are supplied
in `firebase/database.rules.json` but have not been deployed or tested against a live account.
Cloud synchronization and the conflict UI are implemented. Existing account IndexedDB rows
are treated as pending until their upload is acknowledged. JSON import continues to work.
Old shared IndexedDB saves can be exported from the previous origin and imported; localStorage
is not automatically migrated into an account. Originals remain untouched.

## Activate account access

1. In Realtime Database → Rules, paste `firebase/database.rules.json` and publish.
2. In Realtime Database → Data, add `members` as an object containing your UID with boolean
   value `true`: `{"jmBueXWwZIZn8NgdU4US84Dw5dn1": true}`.
   Add this child without replacing any existing database data.
3. Open `/login` and sign in with the email/password account you created in the console.
4. Approve additional users by creating their Authentication accounts and adding their UID
   under `members` with boolean `true`. Clients cannot change membership.

Publish the latest rules again before using synchronization. They now enforce monotonic
revisions, envelope fields, character payload size, ownership and membership. Deletions are
tombstones; hard deletion and unversioned body edits are denied.
Unconfigured deployments deny protected application routes as well.

## Sync behavior and verification

### Share codes

The library's Export dialog shows or creates one permanent six-character Share Code per
character, formatted like `K7M-P4R`. The alphabet omits I, O, 0 and 1 for easier spelling.
Codes are random, and occupied codes are retried without overwriting another character's link.
Reopening Share on any device reuses the character's existing code.

Creating a code first syncs the saved character and refuses unsynced changes or unresolved
conflicts. Existing codes remain available for revocation even while edits are unsynced.
Only a small `{ownerUid, characterId}` link is stored at `characterCodes/<code>`, with the
owner's reverse lookup at `users/<uid>/shareCodes/<characterId>`. No extra character body is
uploaded. Approved users can read a character while its reciprocal share link is active;
unshared characters, account settings, character lists and code lists remain private.
An import reads the latest synced character, verifies its hash and assigns a new UUID.
Imported copies remain independent: revocation does not remove somebody else's import.

Codes have no time limit. Revoke Code atomically removes the link and reverse lookup, without
deleting the original character. Character deletion atomically removes both alongside its
cloud body, retaining only the existing sync tombstone. Offline deletion completes on the
next successful sync. Restoring a character does not restore a revoked share code.
Database rules enforce reciprocal links, one code per character, ownership, membership and
revision checks; interrupted requests or simultaneous devices cannot leave duplicate links.

Publish `firebase/database.rules.json` together with the updated client. Old snapshot creation
and redemption are disabled. On each account's first successful cleanup in an app session,
sync removes that owner's old `characterShares` snapshots in batches of ten; failed cleanup
is reported and retried on the next sync without blocking normal character synchronization.
Original characters and recipients' imported copies are retained. Accounts that never return
will not run client cleanup; an administrator can remove the retired `characterShares` node
in the Firebase console to reclaim all remaining snapshot storage. The new sharing system
does not use that node.

The emulator tests cover short codes, collisions, simultaneous creation, live-version reads,
revocation, deletion, owner-scoped legacy cleanup and denied access to unshared data. No
backend service, scheduled cleanup job, or Firebase Storage bucket is required.

### Account preferences

Theme and the creator's global Source Books selection sync on change. The shared Source Books
filter covers all creator catalogs, including the wizard. Empty selection (all books) also syncs.
Settings have per-account local caches and per-setting cloud records under `users/<uid>/settings`.
They are checked on sign-in, Sync Now, reconnect and every minute, and uploaded automatically
after changing a preference. Pending changes survive reload and errors appear in the account bar.
Different preference keys are written independently. For simultaneous edits of the same setting,
the last successful cloud write wins; these small preferences do not use character conflict UI.
Existing device preferences seed the first account only when no cloud value exists. A different
account starts with its own saved values or defaults. Imported compendium data, installed revision
IDs and homebrew file bodies remain device-local and are not uploaded as preferences.

Republish the database rules to enable settings writes. The emulator tests cover settings
ownership, membership, field allowlisting and size/shape validation.

### Characters

- Local saves finish before network work. Each row carries its last acknowledged cloud
  revision/hash and local edit version; a mismatch is a durable pending save across reloads.
- The service checks at sign-in, after local saves, on reconnect, every minute while open,
  and when the user chooses Sync Now. Checks fetch IDs and small metadata objects first.
- Account and sync controls share one responsive bar. Initial account loading waits for the
  first sync attempt, including direct sheet/editor routes. On failure cached characters remain
  usable with an error. Later background checks do not block navigation. Signing out warns
  about active/pending work; closing the tab requests the browser's native unload warning.
- Full JSON bodies are downloaded only for new/changed documents or conflicts. Uploads
  atomically replace the body and metadata; server rules reject a competing stale revision.
- SHA-256 identifies the exact JSON and deletion state. If a response is lost, finding the
  same cloud hash acknowledges the write without uploading a second revision.
- Conflicts persist in IndexedDB. Keep Both copies this device's sheet to a new character
  and keeps the cloud version under the original ID. Use This Device or Use Cloud explicitly
  selects that version, including deletion state. Open sheets and editors show an Updated
  Version Available notice when their persisted version advances. Refresh Now reloads the
  character after confirming any unsaved edits. Deletions show Back to Characters instead.
  Stale edit versions cannot silently overwrite a downloaded version.
- Inline data/blob images are rejected before upload. Portrait editing accepts external URLs.
- The cloud payload limit is 8 MB UTF-8. Rules also enforce an 8-million-character string
  limit; Firebase's own string limits still apply. Only the current cloud snapshot and deletion
  tombstones are retained, rather than an unbounded revision history.
- Native IndexedDB cache separation is implemented. Offline app-shell reload and offline
  approval/session recovery are still Milestone 6 work; this is not yet a complete offline PWA.
  Offline startup is deferred by user decision; internet access for startup is acceptable.

Tests: `npx ng test --watch=false` covers synchronization and local storage. `npm run test:rules`
uses a demo-project database emulator, never the live backend. Firebase CLI requires Java 21+;
on this machine Android Studio's `jbr/bin` provides Java 21 and can be prepended to PATH for
the test command. Emulator tests check unauthenticated/unapproved/cross-account denial,
self-approval denial, stale/concurrent writes, tombstones, schema/size limits and revocation.

For live acceptance, publish the rules, create/import a character, choose Sync Now, and check
it appears in another browser signed into the same account. Edit independently on both
browsers before syncing to exercise the conflict choices. Live two-device acceptance has not
been performed by the coding agent.
