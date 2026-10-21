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
configured independently. Do not deploy until authentication, approval rules, and cloud
save/conflict handling have been implemented and verified.

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

The library's Export dialog can create a 96-bit random Share Code for a saved character.
It uploads a frozen complete snapshot under `characterShares/<code>`. An approved recipient
enters that code in Import Share Code; the application verifies the snapshot hash and assigns
a new character UUID before saving it to the recipient's account. Later edits are independent.
Codes expire after 24 hours and can be revoked from the generating dialog. Codes cannot be
listed; reading requires an exact code and an approved account. Only the creator can revoke
a code. Snapshots cannot be overwritten. Private character paths remain inaccessible to others.
This replaces the temporary Worker sharing client and its public bearer-token configuration.

Creation uses Firebase's server timestamp, and database rules enforce expiry 24 hours after
that timestamp. The sender's or recipient's device clock does not determine validity. Earlier
codes containing `expiresAt` remain readable until the earlier of that expiry and 24 hours
after creation. Publish the current `firebase/database.rules.json` together with the updated
client: older rules require a client-supplied expiry and will reject the new creation payload.
HTTP 401/403 during creation means Firebase denied the write; verify approval and the deployed
rules. Other HTTP failures are reported with their status instead of being labeled permission errors.

Expiry denies access but does not physically remove the snapshot: automatic server cleanup
is not available in this client-only implementation. Operators should remove expired entries
under `characterShares` periodically to reclaim storage. The emulator tests cover approval,
ownership, immutability, expiry, revocation and denied listing. Live sharing requires publishing
the latest rules; no backend API or Firebase Storage bucket is needed.

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
