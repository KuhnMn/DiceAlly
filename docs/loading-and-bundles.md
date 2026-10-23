# Loading and bundle sizes

Measured against `888efc9` using the same production build, with no budget increases:

| Output | Before | After |
| --- | ---: | ---: |
| Initial JS + CSS | 927.75 kB | About 517 kB |
| Estimated initial transfer | 184.90 kB | About 124 kB |
| Editor entry chunk | 490.56 kB | About 306 kB |
| Global stylesheet | 143.59 kB | 105.40 kB |
| Largest shared editor stylesheet | 7.57 kB | Below 4 kB |

These are Angular's raw and estimated compressed sizes, not timings or measured hosting compression. The configured Firebase client additionally loads about 87 kB raw / 23 kB estimated transfer during account initialization. Deferring it allows the shell/loading feedback to render earlier; authentication still completes before protected routes open. Route entry chunk sizes exclude shared dependencies.

The total JS/CSS artifact falls from roughly 16.42 MB to 16.19 MB. Around 13.27 MB is the generated site/homebrew validation code. It remains outside normal navigation and is loaded only by content validation/imports. Those validators and their acceptance rules are unchanged. Retaining prior releases increases deployed storage, but browsers request only the assets they need.

## Boundaries

- Routes load screens separately. The legacy character converter is imported only for explicit legacy imports, removing the class adapters/validators from the initial dependency graph.
- Firebase uses the same IndexedDB/local/session persistence order, without unused popup/redirect support. Account readiness and membership checks still gate protected routes. Failed initialization offers reload recovery.
- The Class Wizard downloads when opened. Download failures leave the editor draft available.
- Editor CSS is split into shared controls and component-specific styles. Components retain Angular's style encapsulation. Removed theme imports targeted unused contrast classes; the active theme variables are unchanged. Tailwind scans application sources instead of the entire repository.
- On approved sessions, Home, Compendium and Viewer can preload after 2.5 seconds. Offline connections, Save Data, 2G and 3G skip this. Content import, source validators, the editor and wizard are not speculatively loaded. Preload failures stay silent and do not prevent later navigation.

## Recovery

`loadWithRetry` recognizes browser module-download errors and makes one bounded retry. Chromium can cache failed imports in its module map: when the browser exposes the failed URL, the retry requests the same-origin module once with a fresh query. Its expected export is checked, and static dependency identities stay unchanged. A failed transitive dependency, a browser without a usable error URL, or an expired release can still require Reload App.

Navigation failures are handled centrally: the previous screen and inputs remain, the loading status stops, and Try Again / Reload App are offered. Technical module errors are no longer copied into the character library's red error text. Navigation promises resolve to false, avoiding unhandled rejections in callers. Retrying still runs leave/unsaved-change guards. Reload is never automatic; existing browser unload protection for sheets, editors and pending sync remains active.

Validator promise caches clear on rejection, so one failed download does not permanently poison later imports. The importer creates a fresh worker for each attempt and retains the last installed content revision on failure.

## Releases

`npm run deploy` fetches the published release after building and retains hashed JS/CSS files from up to two previous releases. `release-assets.json` records the current and two prior asset sets. This covers tabs opened before a deployment without retaining assets indefinitely. HTML, runtime config and other unversioned assets always come from the current build. Fetch/read/manifest failures stop publishing. A tab older than the retained releases may still need Reload App.

## Verification

- Production build with unchanged 520 kB initial and 4 kB component-style warning budgets.
- Unit coverage for bounded retries, navigation failures/retry/guards, connection-aware preloading, deferred authentication, and wizard load errors preserving drafts.
- Node deployment tests check compatibility retention, pruning after two releases, current HTML/config, and rejection of unsafe manifest paths.
- Chromium production build with an offline route request: the original screen/input survives, retry after reconnect succeeds without reload or an uncaught error. Authentication/backend are stubbed only in this browser test.
- Computed style comparison against `main`: nine editor pages at 390/1280 px and all ten theme variable sets match.

Reproduce bundle measurements with `NG_BUILD_MAX_WORKERS=4 npm --ignore-scripts run build -- --stats-json`. `stats.json` records each output's inputs and static/dynamic dependency edges. Check complete dependency closures when measuring a screen; moving a shared chunk does not remove its download cost.
