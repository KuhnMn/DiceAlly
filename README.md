# AllySheetViewer

AllySheetViewer (Dice Ally) is an Angular app for creating, viewing and managing
character sheets. It provides a responsive playing sheet, character editor,
Compendium, notes, resource tracking, JSON import/export and share codes.

Protected routes require a configured Firebase project and an approved account.
Character changes are cached in IndexedDB and synchronized with Firebase Realtime
Database. Game content is imported by the user and cached locally.

## Local development

Use Node.js 24 and npm 11 (the package manager is pinned in package.json).

1. Install dependencies with `npm ci`.
2. Copy `.env.example` to `.env` and fill in the Firebase web app settings.
3. Configure account approval and database rules using the
   [Firebase setup guide](docs/migration/FIREBASE_SETUP.md).
4. Run `npm start` and open <http://localhost:4200>.

`npm start`, `npm run watch` and `npm run build` generate the ignored
`public/runtime-config.js` from environment variables and the local `.env`.
Hosting environment variables take precedence. Restart the dev server after
changing configuration. Do not edit the generated file by hand.

With no Firebase settings, configuration generation succeeds, but protected routes
remain unavailable. Partial Firebase settings fail with the missing variable names.
Browser configuration is public; never supply service-account credentials.

Sharing uses permanent, revocable Firebase share codes such as `K7M-P4R`.
The Cloudflare temporary-upload service and its runtime token are no longer used.
See the Firebase guide for the current sharing and synchronization behavior.

## Build and checks

| Command | Purpose |
| --- | --- |
| `npm run build` | Production browser build in `dist/AllySheetViewer/browser` |
| `npm test -- --watch=false` | Angular/Vitest unit suite |
| `npm run test:schemas` | Schema-tooling tests |
| `npm run schemas:check` | Check generated schema artifacts |
| `npm run schemas:audit` | Audit content contracts |
| `node --test scripts/retain-release-assets.test.mjs` | Release-asset retention tests |
| `npm run test:rules` | Firebase database rules tests using the emulator |
| `npm run deploy:prepare` | Prepare the separate Dice Ally Pages deployment |

The application is a browser-only static site. Serve nested routes with an SPA
fallback. See the [deployment guide](docs/migration/GITHUB_PAGES_DEPLOYMENT.md)
for publishing commands, required environment settings and release retention.

## Repository structure

- `src/app/characters`: Character repositories, sharing, session state and sync.
- `src/app/content`: Import, schema adapters, linking, cache and generated contracts.
- `src/app/editor`: Editor pages, selection helpers and Class Wizard.
- `src/app/sheet`: Playing-sheet pages and presentation components.
- `src/app/models` and `src/app/rules`: Shared data structures and domain operations.
- `src/app/auth`, `settings` and `loading`: Account, preferences and navigation support.
- `src/styles.css`: Global styles and active theme tokens.
- `scripts`, `schemas` and `firebase`: Tooling, schema snapshots and database rules.
- `docs`: Implementation guides, review evidence and historical migration records.

Use the [documentation index](docs/README.md) to find current guides and historical
references. The [maintenance review](docs/maintenance-review.md) explains cleanup
decisions and remaining structural concerns.

## Repository Scope

This repository is published primarily for personal hosting and reference.

- External contributions are not currently being accepted.
- Issues and pull requests may be closed without review.

## Disclaimer

This application is a **viewer and interface only**. It does not include, distribute, or provide any game content, rulebook text, stat blocks, spell descriptions, item descriptions, or any other gameplay data.

All game content, mechanics, rules, names, and related material are the intellectual property of their respective owners. This project makes no claim of ownership over any gameplay elements, systems, or creative works associated with any tabletop roleplaying game or related product.

Any data displayed through this interface is entered by the user themselves and is not supplied by this application or its author.

## Ownership and Credits

- The application interface and source code in this repository are authored and maintained by the repository owner.
- Third-party libraries remain under their respective licenses and ownership.
- No game content, gameplay mechanics, or ruleset material of any kind is included in or claimed by this project.

## Security

If you discover a security issue, open a private report through GitHub security advisories if enabled, or contact the repository owner directly.
