# Web-only migration implementation plan

Prepared: 2026-10-14. Status: Milestone 1 source audit and design documents completed; application implementation has not started.

## Outcome and constraints

Deliver a web-only replacement for the Android app, including its current character creation, editing, management, and session workflows. Use Android behavior and mappings as the reference, with a design that allows additional content types and rules later.

- Maximum expected audience: ten users; invite-only membership.
- Target ongoing hosting cost: zero, within managed free-tier limits.
- Retain Angular and GitHub Pages hosting.
- Every application feature requires an authenticated, approved account. Sign-in and legal pages remain accessible before authentication.
- Compendium data is downloaded directly from the configured GitHub source and cached locally. We do not mirror, publish, or store the full compendium on our backend.
- Default source: https://github.com/5etools-mirror-3/5etools-src, branch `main`, directory `data`. Repository, branch, and directory remain configurable per user; compatible structure is expected.
- Source data is approximately 100 MB today and may grow. Import all supported Android content categories, rather than indiscriminately loading every book/adventure/fluff file in `data`.
- Saved characters remain editable, including class/subclass changes, multiclassing, level application, and manual overrides.
- Offline edits synchronize when connectivity returns. Conflicting versions require the user to choose which version to retain.
- Sharing codes create independent copies. Both sender and recipient must be authenticated and approved.
- Content checks, imports, and applying updated features to characters are explicit actions.

## Architecture

| Component | Responsibility |
| --- | --- |
| Angular application | Sign-in, library, creator/editor, sheet, import settings, update previews, conflict resolution |
| Independent TypeScript domain module | Character rules, level application, derivation, preservation of user changes; no dependency on Angular or Supabase |
| Content adapter and background Web Worker | Android-compatible JSON mapping, linking, validation, bounded file-by-file import |
| IndexedDB | Local content records/indexes, import revisions, character cache, drafts, durable synchronization queue |
| Supabase Auth and PostgreSQL | Accounts, approved membership, private saved characters, settings, revisions |
| Small server functions/database operations | Temporary share-code creation/redemption, rate limits, atomic saves; administrator provisioning if needed |
| GitHub | Original content files and revision metadata; accessed directly by the browser |

Supabase is a managed backend built around PostgreSQL, with authentication and database APIs. Its free plan currently includes 500 MB database storage, 1 GB file storage, 5 GB egress, and 500,000 function invocations. Free projects pause after a week of inactivity and do not include automatic database backups. Recheck limits before rollout; provide character exports and an operator backup procedure.

Use Google OAuth initially to avoid arranging email delivery. Store a display name in the profile; arbitrary username/password authentication is not included initially. An email/password alternative can be added with account provisioning and recovery configured. Backend membership checks must deny non-invited identities even if an authentication provider issues them a session.

Privileged Supabase credentials exist only server-side. Frontend keys are public configuration; row-level security and membership checks provide access control. Angular guards provide navigation behavior, not database security.

## Repository and Android references

Existing web seams:

- `src/app/models/character.model.ts`: current sheet/export representation.
- `src/app/services/character-storage.service.ts`: localStorage persistence and export/import compatibility.
- `src/app/stores/character.store.ts`: current selected-character state.
- `src/app/services/rest.service.ts`: existing rest/resource behavior.
- `src/app/import/` and `src/app/sheet/`: current user workflows to retain and extend.
- `src/app/services/tmpfiles.service.ts` and `ally-worker/src/worker.js`: sharing integration to replace/migrate while keeping user-facing codes.
- `src/app/app.routes.ts`: introduce authentication, membership, library, editor, and settings routes.

Android reference root: `C:/Users/maxim/AndroidStudioProjects/DnDAlly2/app/src/main/java/com/ltx/`.

- `data/SettingsRepository.kt`: primary and secondary import paths/source filters.
- `dndally/MainActivity.kt`: `processImportedPrimaryContent`, `processImportedSecondaryContent`, extension processing and upserts.
- `data/` model/entity files and `toEntity` mappings: input interpretation.
- `dndally/character/CreateCharacterViewModel.kt`: creation/editing and `applyClassAndSubclassSelectionsToCharacter`.
- `dndally/character/CharacterRespository.kt` (filename spelling): export/import and relation mapping.
- Character management view models and screens: spells, features, equipment, monsters, health, notes, actions, and resources.
- Current `AppDatabase.kt` declares version 111; `DATABASE_MIGRATION_GUIDE.md` only describes changes through 108. Use current code as the reference.

Do not assume Android exports contain all editing inputs. Selected class data is absent from the current full export, so imported legacy characters need an explicit reconstruction path where information is missing.

## Content and local cache design

1. Represent a source as repository owner/name, branch, directory, enabled sources, and adapter version. Resolve the branch to a commit before import; fetch every file at that commit to avoid mixing revisions.
2. Discover supported files using repository category indexes where available, with Android's path lists as the reference/fallback. Do not require an upstream custom manifest or generated artifacts. Verify actual index shapes and extension dependencies during the first milestone.
3. Download and map files with bounded concurrency. Store results progressively in a staging import, and release parsed JSON between files. Build indexed records instead of retaining the entire corpus in memory.
4. Resolve primary data, secondary extensions, inheritance/copy references, and cross-file references in ordered passes. Report missing or unsupported references; never silently drop required features.
5. Activate the new revision only after required imports and linking succeed. A cancelled, interrupted, or failed import leaves the previous revision usable.
6. Partition local records by account, source identity, revision, and adapter version. Browser storage is per device; source settings synchronize but the full content cache does not.
7. Check storage estimates and request persistent browser storage where supported. Handle quota failure and cache eviction through reimport. Never clear unsynchronized characters when clearing content caches.
8. Keep old revisions required by locally used characters until the user deliberately removes them. Reuse unchanged files where practical and avoid retaining redundant raw JSON indefinitely.
9. Measure download size, mapped storage size, peak memory, and import/link time on desktop and a representative phone. Tune import batching based on evidence.

Initial source support targets public GitHub repositories with the expected structure. Authenticated application access does not make the upstream public repository private. Private-repository credentials and access are a later extension if requested.

## Character representation and editing

Use a versioned character document with:

- Application character UUID, owner, document version, rules version, and server revision.
- Creation inputs: selected classes/subclasses and levels, abilities, proficiencies, choices, enabled sources, and relevant editor settings.
- Explicit manual overrides and user-added entities, with provenance distinct from generated values.
- Generated sheet data compatible with the existing viewer.
- Session data: current HP, used resources/slots/hit dice, conditions, notes, inventory state, monster state, and combat state.
- Content provenance: source identity, exact commit, stable entity references, and selected entity snapshots needed to use the saved sheet.

Store only character-selected snapshots/dependencies privately in the character document; never upload the full library. Use composite stable references including type, name, source, and class/subclass/level qualifiers where needed. Names alone do not uniquely identify all features.

Derive generated data from inputs through pure operations. Track each generated feature/spell's origin so repeated application does not duplicate it or remove unrelated manual additions. Preserve notes and usage through stable identifiers. Where resource totals shrink, present the proposed adjustment rather than silently resetting usage.

The editor must support the full Android workflow, not a permanently reduced wizard. Inventory, spells, features, species, monsters, notes, actions, overrides, resource settings, and class edits are included in the parity inventory. Additional supported mechanics are extension points, not a promise to implement every mechanic present in upstream JSON automatically.

Legacy imports preserve their original payload and remain usable. Missing class/choice information must be supplied or confirmed before rule-aware recalculation. Never infer ambiguous selections silently.

## Explicit content updates

- `Check for updates` resolves the configured branch head and compares it with installed revisions without changing local content or saved characters.
- `Import update` downloads/maps/links a new local revision and reports completion or errors.
- `Update character content` computes a preview against the selected revision: changed descriptions, added/removed features or spells, derived values, unresolved references, and choices requiring attention.
- Manual overrides, user-added records, notes, and session usage survive the proposed update. Conflicts and removals are visible.
- Apply the entire accepted character update atomically, record new provenance, and enqueue a save. Keep the prior local document available for undo/export.
- Missing historical commits or cache revisions do not prevent ordinary sheet editing. Rule-aware editing requires a compatible import or an explicitly accepted migration to a newer revision.

## Authentication, offline access, and synchronization

All online feature access and database operations require a valid session and approved membership. Offline use is available only after a successful approved sign-in on that device, using its cached account/session state. A new sign-in, share creation/redemption, and authoritative membership checks require connectivity.

Remote revocation cannot be detected while offline. Revalidate membership on reconnect before syncing; preserve local drafts if authentication expires or membership is denied. Signing out locks account data and prevents another account from accessing its cache. Unsynchronized changes must be surfaced before cache removal.

Synchronization protocol:

1. Each local save writes the document and an outbox entry in one IndexedDB transaction. Display pending/synced/conflict state.
2. Keep the last acknowledged server revision as the base. Coalesce pending saves where safe; use operation identifiers for retries.
3. Server saves atomically compare the base revision and increment the revision on success. Client timestamps never decide the winner.
4. On conflict, retain both versions and display their differences with explicit choices: use local, use cloud, or keep both as separate characters. Cancelling keeps the conflict pending.
5. A user-approved local overwrite must still compare the latest displayed server revision; if it changed again, refresh the conflict rather than overwriting unseen edits.
6. Represent deletion with synchronized tombstones. A delete-versus-edit conflict also requires a choice. Avoid resurrecting deleted characters through delayed retries.
7. Reconnect and reload recover the durable outbox. Check cloud revisions on opening/focus/reconnect; realtime notifications are optional.

## Private database and sharing codes

Initial logical tables:

| Table | Purpose |
| --- | --- |
| `memberships` | Approved account/email identity, active status, administrator role |
| `profiles` | Display name and application preferences |
| `content_sources` | Per-user source configurations; metadata only |
| `characters` | Owner, UUID, document JSONB, schema/rules versions, server revision, timestamps, tombstone |
| `character_shares` | Frozen export, sender, code hash, expiry; direct payload access denied |

Enforce owner and active-member policies for every table/operation. Restrict administration to the operator; a public invite endpoint is unnecessary for ten users. Provision the first administrator through a trusted setup procedure.

Share workflow:

- Approved sender requests a temporary code for a frozen self-contained export.
- A server operation generates a short random code, checks uniqueness, enforces expiry (default five minutes), and limits creation/redemption attempts. Use a longer human-friendly code instead of treating a six-digit code as sufficient security on its own.
- Approved recipient redeems through a protected operation. No listing of active shares or direct table access; enforce expiry on every read and clean expired records separately.
- Import always creates a new application UUID owned by the recipient. Preserve source provenance separately; remap nested references and never overwrite an existing character because its Android UUID matches.
- Include creation inputs, selected content snapshots, manual overrides, and current state. A recipient can use the sheet immediately and import compatible content for rule-aware editing.
- Offline users may export files; code operations require connectivity.
- Keep Android JSON compatibility. Test existing Android code-sharing protocol before retiring the legacy worker. Mobile compatibility with the new authenticated service is a separate migration dependency, not an assumed capability.

## Implementation milestones and acceptance criteria

### 1. Android parity inventory and document contract

Deliverables completed:

- [Android workflow and import inventory](docs/migration/ANDROID_PARITY.md), including observed gaps and milestone assignments.
- [Character document contract v1](docs/migration/CHARACTER_DOCUMENT.md), including stable references, field ownership, overrides, and legacy adaptation.
- [Source-derived parity cases](docs/migration/PARITY_CASES.md), including numeric Android baselines and web preservation requirements.

Validation boundary: source audit and manually derived cases, not captured Android runtime outputs. Executable fixtures and real-dataset validation are assigned to M2/M3.

Inspect complete creation/management workflows and both import passes. Produce a behavior matrix, stable-reference definitions, versioned character contract, and representative expected outputs from Android. Document known Android defects/ambiguities rather than cloning them blindly.

Done when every current Android workflow is assigned to a milestone, legacy import limitations are explicit, and creation inputs/overrides/session state can be represented without loss.

### 2. Content import prototype and performance gate

Implement configurable source resolution, file discovery, mappings, background processing, staged IndexedDB imports, indexes, and explicit check/reimport controls. No cloud compendium uploads.

Done when a representative full supported dataset imports on desktop/mobile, classes/features/spells link correctly, peak memory/storage/time are measured, and failed/cancelled imports preserve the active cache.

### 3. Independent rules engine

Port level application, multiclass/subclass relations, features, grants, slots, proficiencies, hit dice, and derived values. Introduce provenance and explicit override handling. Reconcile existing web rest/calculation logic with Android reference behavior.

Done when meaningful parity cases cover single/multiclass characters, repeat application, level increases/decreases, subclass changes, manual additions, and preservation of notes/resources. Rules run independently of UI/database code.

### 4. Local creator, editor, and content-update preview

Build multi-step creation, drafts, full editing, management parity, and update previews using the local repository. Preserve existing viewer features and Android file import/export. Local workflows in this milestone are development validation; do not publish an ungated application.

Done when create -> save -> reopen -> edit/level -> export works, manual overrides survive recalculation, legacy imports remain usable, and explicit updates preserve state or request a decision.

### 5. Invite-only accounts and private cloud saves

Create Supabase migrations/policies, OAuth, membership provisioning, route guards, repository adapter, and revision-aware server saves. Migrate localStorage characters only after a successful account sign-in; keep originals until verified.

Done when invited users can access their data on another device, unapproved users cannot use protected functions, cross-account access fails at the backend, and application secrets are absent from static assets.

### 6. Offline synchronization and conflict resolution

Add app-shell caching/service worker as needed, account-isolated local access, durable outbox, retry idempotency, compare-and-save, deletion tombstones, and version-choice UI.

Done when offline reload/edit works after initial sign-in, pending changes survive reload, two-device conflicts preserve both versions until resolved, and retries/auth expiry/deletion conflicts do not lose changes.

### 7. Authenticated copy-sharing codes

Introduce protected temporary export operations and copy import. Replace the legacy frontend shared-token integration. Retain file transfers and validate the Android transition path.

Done when sender/recipient membership is enforced, codes expire, attempts are limited, copies have independent identities, and no code redemption overwrites an existing character.

### 8. Rollout and operational validation

Verify the complete Android parity matrix, mobile import/creator performance, ownership, revisions, offline updates, sharing, exports, and backup/restore procedure. Update documentation and deploy static Angular assets to GitHub Pages. Verify direct-route and OAuth callback routing on the actual domain/base path.

Done when invited users can complete the web-only workflow and recover their characters through exports/backups. Review free-tier usage with realistic character and share sizes; do not enable paid services without an explicit decision.

## Setup information needed during implementation

Requirements are sufficient to begin the milestones. These operational details can be collected when their milestone is reached:

- Supabase project and region, administrator identity, approved user emails, and Google OAuth configuration.
- Canonical frontend domain/base path and OAuth callback URLs.
- Representative Android exports/characters for parity verification; use owner-provided/local examples without committing full content libraries or private character data.
- A representative mobile browser/device for the performance gate.

No application code, service provisioning, or deployment is authorized by creation of this plan alone.

## Sources checked

- Default repository structure: https://github.com/5etools-mirror-3/5etools-src/tree/main/data
- Supabase database: https://supabase.com/docs/guides/database/overview
- Supabase pricing: https://supabase.com/pricing
- Auth configuration: https://supabase.com/docs/guides/auth/general-configuration
- User management: https://supabase.com/docs/guides/auth/managing-user-data
- Email delivery constraints: https://supabase.com/docs/guides/auth/auth-smtp

Consult current provider documentation again at implementation time, particularly authentication configuration, function limits, database access policies, and GitHub API rate limits.
