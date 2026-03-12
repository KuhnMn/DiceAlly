# AllySheetViewer

AllySheetViewer is a personal Angular web app for viewing and managing character-sheet style data with a fast, mobile-friendly interface.

The project focuses on practical in-session usage: quick lookup, notes, feature tracking, and import/export workflows.

## Highlights

- Character sheet companion UI with focused page sections (info, equipment, features, spells, notes, monsters)
- Feature use tracking with visual progress and regain-condition display
- Import and export workflow with modal-based options
- Local persistence through storage services
- Theme support and responsive layout for desktop and mobile
- QR code and share modal utilities for easy transfer scenarios

## Tech Stack

- Angular 21
- TypeScript
- Angular CLI + angular-cli-ghpages deployment target
- Vitest for unit testing

## Local Development

Install dependencies:

```bash
npm install
```

### Runtime Configuration

The app requires a runtime config file for the tmpfiles.org CORS proxy. This file is **not** committed to the repository.

Copy the example file:

```bash
cp public/runtime-config.example.js public/runtime-config.js
```

Then edit `public/runtime-config.js` and fill in your values:

```js
window.__ALLY_APP_CONFIG__ = {
  tmpfilesProxyUrl: 'https://YOUR_WORKER.workers.dev',
  tmpfilesProxyAuthToken: 'YOUR_AUTH_TOKEN',
};
```

#### Setting up the Cloudflare Worker proxy

The Worker source is at `cloudflare/tmpfiles-proxy-worker.js`. It proxies requests to `tmpfiles.org` and enforces Bearer token authentication.

Deploy it with:

```bash
npx wrangler deploy cloudflare/tmpfiles-proxy-worker.js --name allysheetviewer-tmpfiles-proxy
```

Store your auth token as a Cloudflare Worker secret:

```bash
npx wrangler secret put AUTH_TOKEN
```

Set `tmpfilesProxyUrl` to your deployed Worker URL and `tmpfilesProxyAuthToken` to the same token in `public/runtime-config.js`.

Without this configuration, the share/import-via-link feature will display an error but all other functionality works normally.

Start the dev server:

```bash
npm start
```

App URL:

- http://localhost:4200

Build for production:

```bash
npm run build
```

Run tests:

```bash
npm test
```

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
