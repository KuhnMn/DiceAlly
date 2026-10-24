# Sheet layout concept: phones, landscape phones and tablets

Status: Implemented on `codex/tablet-sheet-layout`. The approved layout contract below is retained as the design reference.

## Current causes

- `CharacterSheetComponent.mobile` uses `(max-width: 639px)`. At 640px it selects the full overview and desktop actions and removes the separate Combat page.
- The overview grid uses one column until 768px, two until 1024px, then three. The intermediate range therefore receives a different content composition before it receives the space for that composition.
- `ScrollableTabsDirective` switches from nowrap/overflow scrolling to wrapping/non-scrolling at 640px. Its ResizeObserver can reveal a selected tab only when its container actually scrolls.
- Mobile header/status/menu components independently use `sm:hidden`, while the sticky navigation becomes static at `sm`. Changing only the TypeScript media query would leave those components hidden.
- Combat is page ID 7, available only in the mobile page array. An effect redirects active Combat to Sheet when the viewport leaves mobile mode.
- Per-tab scroll restoration and gesture recognition also depend on the phone breakpoint.
- The outer application limits content width to 1100px. The sheet's own 1200px limit does not create that much usable content width inside its parent.

## Proposed layout contract

Classify available CSS viewport width, rather than device names or user-agent strings. Browser zoom, split-screen windows and rotation must work as ordinary resizes.

| Width | Presentation | Sheet overview |
| --- | --- | --- |
| Below 640px | Existing phone presentation | Existing compact single-column composition |
| 640–767px | Compact tablet / landscape phone | Compact single-column composition with a horizontal status/actions area |
| 768–1279px | Wide tablet | Two overview columns; no automatic third column at 1024px |
| 1280px and above | Existing wide desktop presentation | Existing three-column overview, subject to sufficient actual content width |

The 768px two-column boundary is a starting point for validation, not a promise that any pair of cards fits. Use the available sheet container width and roughly 320px minimum column widths to validate the switch. Keep one column if the actual container is too narrow. Retain the current desktop maximum width initially; expanding the entire app is outside this change.

Viewport height is independent of this contract. For short tablet viewports, approximately 500px high or less, reduce the sticky portion to the tab bar. A keyboard or address-bar resize may change the sticky header treatment, but must never change the available pages, current tab or character data.

## Navigation and Combat

Recommended: use one stable page list at every width: Sheet, Combat, Features, Spells, Inventory, Companions, Notes. Keep the existing page IDs. Combat is an additive shortcut on desktop; the existing desktop overview and its combat block remain available.

All pages are enabled by default. The editor's Sheet Settings page can hide Combat, Spells, Inventory, Companions and Notes per character, consistently across viewport sizes. Hidden pages are excluded from tabs, swipes and source navigation; their content remains editable in the editor. Linked action descriptions still open in place. Sheet and Features remain available. Visibility settings travel with character saves, exports and sync.

- Never redirect from Combat merely because the window becomes wider.
- Keep the sheet tab bar on one line with horizontal overflow at every width. On a wide desktop all tabs fit; only overflow causes scrolling. Labels do not wrap and controls do not shrink below readable/tappable sizes.
- Continue revealing the active tab after selection and resize, without vertically scrolling the document.
- Keep the tab bar sticky throughout phone/tablet layouts. On short landscape screens, the name, status strip and other controls scroll away above it.
- Preserve the existing phone header/sticky arrangement on ordinary portrait phone viewports.
- Give the shared tab directive an explicit sheet navigation variant or equivalent scoped configuration. Do not change the editor or unrelated navigation accidentally.

If preserving the exact desktop tab count is required, the alternative is a desktop Combat shortcut that still retains the Combat route/view while active. This is less predictable than the recommended stable list and needs extra resize rules.

## Tablet composition

Header/status:

- Keep character name, compact species/class/background description, HP, AC and important status accessible in a short horizontal layout with wrapping within the header when necessary.
- Avoid combining the large desktop character header, desktop action row and compact mobile status controls.
- Save, Edit and rests remain reachable; secondary controls use the existing menu conventions when space is limited.
- In a short viewport only the single tab row remains sticky; do not reserve most of the screen for character chrome.

Overview:

- At 640–767px retain the compact Sheet content rather than rendering the entire desktop overview in one long column.
- At 768–1279px group abilities/skills and general information into two useful columns. Keep card order readable in both DOM and visual order; keyboard focus must follow the displayed content.
- Put frequent combat interaction in the dedicated Combat page. Preserve the desktop overview's existing combat block. For tablet, show a compact Combat shortcut instead of repeating the full action list far down the overview. Round/concentration controls on the Combat page remain complete.
- Spells/features/inventory/companions retain shared details and existing list controls. Their columns must fit available width; a persisted three-column list preference may fall back visually to two or one columns without overwriting the preference.
- Reuse existing renderers, controls, models and source links. Layout changes must not introduce another calculation/persistence path.

Combat:

- Reuse the existing mobile Combat composition as a shared Combat page, with its current action cards and details/navigation behavior.
- Default to one column at every width. The shared list layout buttons allow users to choose two or three columns when sufficient space is available, with the same fallback/restoration behavior as other lists. Keep each action name and its stat row intact.
- Source links, cast controls, uses, round tracker and concentration use the same character store as the overview.

## Implementation boundaries

1. Add a sheet layout contract distinguishing phone/tablet/desktop and compact/wide overview. Use it consistently for composition and component visibility. Shared breakpoint definitions must not drift between CSS and TypeScript.
2. Scope responsive overrides to the sheet. Do not globally replace Tailwind `sm` with another breakpoint. Mobile component names or their `sm:hidden` host classes must not silently decide tablet visibility; make the desired presentation explicit.
3. Stabilize page IDs/availability and remove resize-driven Combat redirects before switching layouts.
4. Adapt the existing compact header and overview renderers; share calculations and state. Keep ordinary portrait phone and wide desktop presentations as regression references.
5. Extend tab scroll bookkeeping to tablets. Store offsets by stable page ID and layout family, preserve selected tabs and filter/expansion state, and clamp/restore offsets after relayout. Do not scroll to page top on every width update.
6. Keep one overlay per open detail/editor. A resize must not instantiate a second dialog or trigger close/discard. Preserve unsaved note drafts and inputs when changing compositions; do not reset the character store or recreate stateful tab pages merely for a breakpoint change.
7. Extend gestures separately from layout classification. Enable phone-style page swipes for touch-operated tablet layouts, retaining horizontal-row and input exclusions. Account for hybrid devices without relying solely on `(pointer: coarse)`; desktop mouse drag behavior remains unchanged.
8. Keep the heavy tablet content within existing lazy sheet boundaries. No new eager route imports or speculative import-validator downloads.

## Regression and acceptance checks

Width boundaries: 639/640, 767/768, 1023/1024 and 1279/1280px, plus intermediate widths. Check at normal browser zoom and at increased zoom/split-screen widths.

Representative viewports:

- Phone portrait: 320×568, 390×844, 430×932.
- Phone landscape: 667×375, 844×390, 932×430.
- Tablet: 768×1024, 820×1180, 1024×768, 1180×820.
- Desktop: 1280×800 and 1440×900.

At each relevant viewport:

- Exactly one header/status presentation; appropriate overview columns with no horizontal document overflow.
- Single-row navigation, active tab visible, readable/tappable controls, Combat reachable.
- At 844×390, only the tabs remain sticky while scrolling, leaving useful content height.
- Existing source dialogs, prepared-spell navigation, casting, source updates, save/edit/rest and use tracking keep their behavior.
- Native horizontal trackers and editing controls keep their gestures; touch page swipes work in intended intermediate layouts.
- Detail dialogs and their actions fit short viewports and remain usable with the keyboard open.

Resize scenarios are more important than static screenshots:

- Rotate portrait → landscape → portrait while Combat is selected; the selected page remains Combat and values are unchanged.
- Repeatedly cross each breakpoint with unsaved HP/uses/notes, active filters, expanded Basic groups and independent tab scroll positions.
- Resize with an open spell/feature dialog and with a draft in an editor; no duplicated overlays, lost input or spurious save/discard prompts.
- Compare normal phone and wide desktop screenshots/computed layouts against their current versions. The intentional desktop difference is the added Combat tab; other unrelated desktop layout changes are excluded.

Run targeted layout/state/navigation tests and browser touch checks. Since the implementation changes responsive composition, finish with a production build and check that startup size stays within its existing budget.


## Implementation and validation

The shared layout service owns the 640/768/1280px viewport boundaries and the short-tablet height query. The overview column layout additionally uses measured content width. Combat uses the shared manual list layout selector and starts with one column. List layouts support two columns at 656px of content width and three at 992px; unavailable choices are disabled. The preferred count is retained independently from the count currently displayed.

Compact and desktop overview instances are created on first use and retained thereafter. Changing the overview family waits while a detail overlay is open. Header/health components keep one instance through rotation; the desktop presentation hides their triggers rather than destroying an open health dialog. Existing tab pages are retained, including spell filters and note drafts. Tablet touch swipes are enabled below the desktop boundary, while the editor retains its existing gesture boundary.

Sticky chrome and sticky tabs are siblings. A ResizeObserver measures the header height to place the tabs below it; on short tablets, only the tabs remain sticky. No new layout-containment ancestor is introduced around fixed-position dialogs. The sheet navigation variant preserves the shared editor tab bar's behavior.

Verified using the full 705-test suite, focused tablet/gesture tests, and Chromium across 320/390/639/640/667/767/768/820/844/932/1023/1024/1180/1279/1280/1440px widths. Browser checks cover header visibility, absence of document overflow, single-row tabs, short-landscape sticky navigation, Combat/group state, list column fallback/restoration, open source/health dialogs, health-panel inputs, unsaved note drafts, and tablet touch navigation. Production initial assets remain about 518 kB, within the unchanged 520 kB warning budget.
