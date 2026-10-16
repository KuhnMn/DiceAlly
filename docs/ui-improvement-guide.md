# UI Improvement Guide

## Scope and status

This guide covers the character sheet opened through **Load**, including Sheet, Features, Spells, Equipment, Monsters, and Notes. The editor is outside the current scope. Shared components should support sheet-specific presentation without unintentionally changing the editor.

Implementation has started. The status section below distinguishes completed work from remaining recommendations. The Requested mobile changes section records the user's explicit requirements, and the Android reference informs the visual direction.

The goal is practical use during a game with friends: less scrolling, faster access to useful information, and comfortable reading and interaction on phones. Compact layouts should primarily remove decorative space and repeated information rather than shrink text or touch targets.

## Implementation status — 16 October 2026

Implemented in the working tree:

- Sheet-specific source pickers with one horizontal row on phones, retaining source statistics and selection feedback without changing the editor's picker.
- Horizontal mobile rows for spell slot levels, feature types, spell list types, spell levels, and ritual filtering. Horizontal scrolling stays within each row.
- Always-visible mobile spell summaries in a single scrollable row, without visible field labels. Full casting conditions and material information remain available; compact durations use a C marker for concentration and pluralized time units.
- Search by name on Features and Spells, with filters and expansion state retained while switching tabs.
- Touch swipes between main sheet pages. Horizontal scrollers, interactive controls, vertical gestures, multi-touch, text selection, and screen-edge starts are excluded. Navigation stops at the first and last tabs.
- Lazy mounting of visited pages, with tab state and page scroll positions retained. Entry links activate the destination page and reset relevant filters before highlighting the entry.
- A dedicated mobile Sheet composition reusing the existing sheet calculations and actions: combat and round tracking near the top, condensed desktop-style ability scores/saves, always-visible skills with proficiency symbols, and collapsible identity information, proficiencies, and feature index. Health details live in the health popup.
- A sticky mobile HP/AC/initiative summary above the main tabs, available across pages. HP opens a native modal health/conditions panel, with shared damage/heal/temp-HP rules, focus handling, and background scroll locking.
- A dedicated mobile action bar with Save, Rest, and More. Edit and Theme are in More; saved/unsaved feedback reflects the current sheet.
- Compact normal sync status on mobile sheet routes, with account and sync controls available through Details. Errors and conflict information remain accessible. Creation and editor routes retain their existing header behavior.
- Smaller mobile padding and headings across Features, Spells, Equipment, and Monsters; choice notes in collapsed feature/species entries are hidden on phones until expansion.
- Explicit resource Use buttons and accessible use checkboxes, replacing consumption by tapping the entire tracker card.
- Compact currency inputs in one three-column row. Desktop retains the full Sheet composition, theme system, and labeled spell summaries.
- On-demand loading for sheet routes, reducing the production initial bundle from approximately 993 kB to 676 kB in this implementation pass.

First-pass browser-emulation measurements for the same test character at 390 × 844 CSS pixels, before the follow-up fixes below:

| Measurement | Before | After |
| --- | ---: | ---: |
| Initial Sheet document height | 4,781 px | 1,228 px |
| Features document height with entries collapsed | 6,047 px | 4,298 px |
| Spells document height with entries collapsed | 4,501 px | 2,739 px |
| First spell heading from document top | 1,969 px | 1,155 px |

In that pass, HP became visible above the tabs, around 212 px from the top. Measurements depend on character content, viewport, and which sections are expanded.

### Follow-up review and implementation

The second review identified and addressed these issues:

- The condition picker opened below the visible health panel. It now expands in normal document flow inside the modal, with readable standard/custom condition controls and larger touch targets.
- The health panel required closing before saving. It now offers a Save button and accurate saved/unsaved feedback within the panel.
- Desktop save feedback could remain Saved after another edit. Both presentations now reflect the current dirty state.
- Spell preparation buttons were nested inside expansion buttons. Expansion and preparation are now separate accessible controls, retaining the always-visible spell summary.
- Mobile action menus remained open after outside interaction. They now dismiss on an outside pointer action or Escape.
- The theme selector initially displayed its first option instead of the saved theme. It now reflects the actual theme immediately and when changed externally.
- Damage actions used error-container utility classes that were missing from the theme utilities. Error colors are now registered with Tailwind, restoring the intended background, foreground, and border styling.
- Duplicate feature names were used as rendering keys. Stable entry identity now handles repeated feature names.
- The monster display sorted the underlying saved array in place. Sorting now operates on a copy, so merely viewing a list does not reorder saved data.
- Mobile sheet routes inherited excess outer application padding. This has been reduced without changing library/editor route padding.

Further completed work:

- Equipment now has name search and All/Equipped/Attuned filters. Equipped items appear first without reordering the saved inventory, and filters update immediately when equipment state changes.
- Item summaries retain relevant damage/AC/range, equip/attune/quantity controls, and use trackers. Reference metadata, properties, masteries, bonuses, notes, and deletion are available on expansion; deletion retains confirmation.
- Item properties and masteries use inline disclosures that work with touch and keyboard instead of fixed-width hover tooltips.
- Monsters now have search and All/Tracked companions/Reference filters. Tracked HP and temp HP stay accessible when collapsed; maximum-HP settings, formulas, notes, and full stat blocks live behind expansion.
- Creature expansion uses stable identity so same-name companions and reference entries remain independent.
- Spell slot cards are smaller on phones, slot/filter touch targets are larger, and ritual filters use explicit labels instead of relying on color alone.
- Combat damage/healing text has bounded columns on mobile and desktop, wraps even unbroken strings, and is limited to three lines with truncation for excessive content. Hit/DC text is limited to two lines. Full values remain in the DOM for assistive technology and in hover tooltips. Browser checks with descriptions over 450 characters at 320–1440 px confirmed bounded rows without document overflow.
- Spell preparation uses compact icon buttons: checkmark for prepared (click to unprepare), plus to prepare, and a disabled lock for tracker-locked preparation. Accessible labels and tooltips explain the state and action.

Validation now includes **293 passing tests across 65 files**, including list filtering, saved-order preservation, independent preparation/expansion, condition selection, menu dismissal, theme selection, and save feedback. Browser checks with temporary populated item/monster examples at **320, 360, 390, 768, and 1440 pixels** found no document overflow or new console errors. All mounted sheet controls were checked for nested buttons. Temporary examples were restored without saving them to the account. The production build succeeds; initial bundle size remains approximately 676 kB, with the existing initial-bundle and editor stylesheet warning thresholds still exceeded. Real-device gesture testing remains outstanding.

Remaining work from the wider review:

- Further simplification of feature metadata and source/filter density as real-session feedback warrants.
- Tap-accessible explanations for remaining hover-only details.
- Preserving unfinished presentation-specific drafts when switching between the dedicated mobile and desktop Sheet layouts during a viewport resize. Character data and the other mounted tabs are retained.
- Device-level checks for platform edge gestures, touch scrolling, modal behavior, accessibility, and theme variants.
- Further initial-bundle optimization to reach the 520 kB warning budget; on-demand sheet loading has brought the build comfortably below its 1 MB hard limit.

## Implementation approach for future work

Larger structural changes are acceptable when needed to deliver a usable mobile experience. Visual consistency with desktop does not require identical layouts, markup, or component structures on every screen size.

- Prefer dedicated mobile versions of components when mobile needs substantially different composition or interactions. Integrate them into the actual sheet flow, sharing data and behavior with desktop where practical.
- Prefer this approach over accumulating mobile flags and conditional branches throughout existing components. Use ordinary responsive styling when the difference is only spacing, sizing, or arrangement.
- Keep saving, syncing, resource tracking, and other gameplay logic shared so mobile and desktop presentations behave consistently.
- When switching responsive presentations, preserve character state and relevant UI context. Avoid running duplicate subscriptions or side effects for hidden versions, and prevent duplicate interactive controls from appearing in the accessibility tree.
- Use Tailwind utilities and responsive variants wherever practical. Reserve custom CSS for behavior or styling that utilities cannot express clearly, and preserve the existing theme tokens.
- Keep the implementation scoped to the sheet; shared editor components may be refactored or given sheet-specific counterparts as needed without unintentionally changing editor behavior.

These preferences apply to implementation and subsequent refinements. Only work listed in the implementation status section is complete; later recommendations remain a roadmap.

## Visual reference: original Android app

Use the user's [original Android app screenshot](<WhatsApp Image 2026-10-16 at 13.15.19.jpeg>) as inspiration for the mobile sheet. Its most useful characteristic is the hierarchy: character identity and useful stats above the tabs, followed by source information and compact spell entries.

**Style consistency:** The Android screenshot is inspiration only. The mobile UI should remain visually consistent with the current desktop version, using the same typography, theme colors, icons, component styling, and interaction conventions. Adapt layout, spacing, and information density for smaller screens while preserving a unified appearance across devices; do not reproduce the Android app as a separate visual style.

### Patterns to carry forward

| Visible pattern in the reference | Direction for the web sheet |
| --- | --- |
| Back arrow and character name at the top | Use a simple character-focused header with minimal repeated branding. |
| AC, initiative, proficiency bonus, level, and health grouped above navigation | Put important session information in a compact shared area that remains available across sheet tabs. Prioritize HP and AC if space is limited. |
| Current/max HP together with a health bar | Keep HP readable on one line and use the bar as a secondary visual cue, preserving numeric values. |
| Small secondary controls below the stats | Group occasional actions compactly, with accessible names and clear selected states. Confirm the purpose of any unfamiliar reference icons before adopting them. |
| Horizontal text tabs with a strong active underline | Make the current page obvious and keep adjacent tabs discoverable; support the requested page swipes alongside explicit tab buttons. |
| Casting-source cards beside one another, including save DC, attack bonus, and ability | Keep useful casting statistics within the requested horizontally scrollable source row. Size cards for compact reading. |
| Spell level heading followed by source and slot checkboxes | Keep the relationship between slot level, casting source, and remaining resources clear while arranging slot levels in the requested mobile row. |
| Spell name and secondary source text on the same card | Emphasize the name and de-emphasize reference metadata; allow long names to wrap without displacing controls. |
| A prominent C on the spell card | Use a consistent concentration marker with an accessible explanation. It may sit at the end of the basic-information row or in a stable trailing position in the card header; show it once. |
| A compact line of casting time, range, and duration below the name | Keep the requested basic-information row visible when collapsed, including components. Remove visible field labels and simplify duration text further, for example `10 Minutes`, omitting `Timed`. |
| Dark surfaces, rounded cards, restrained dividers, and pink accents | Use clear surface hierarchy and a consistent accent drawn from the selected web theme. Preserve the existing theme choices. |

### Adaptation for smaller web viewports

Use the reference's arrangement and emphasis while checking the actual available width. The entire stat area must not become so tall that it pushes tab content out of the first screen. A compact two-row summary is a reasonable starting point, with less-used details available on demand. Keep decorative stat shapes modest and preserve readable numbers.

The screenshot's large Manage Spells button, generous source-card padding, vertical gaps, and bottom application navigation are not requirements for the web app. Evaluate those elements against the goal of reducing scrolling; any new management control or global navigation would need a clear purpose in the current app.

Suggested mobile reading order:

1. Back navigation, character name, compact Save/sync status, and occasional-action menu.
2. Shared HP/AC summary, then compact secondary stats and active conditions as space permits.
3. Horizontally scrollable main tabs, with swipe navigation on eligible content areas.
4. The selected page's compact source, slot, and filter rows as applicable.
5. Compact entries with useful summaries and detail overlays.

The screenshot is a visual reference, not evidence that its tab bar is sticky or that it supports swipe navigation. Those behaviors remain explicit proposals and requirements elsewhere in this guide.

## Requested mobile changes

### Horizontal rows for sources, slots, and filters

On small screens, keep each collection in a single horizontally scrollable row:

- Feature Sources.
- Casting Sources.
- Spell slot levels within each spellcasting group.
- Spell list types, such as Prepared, Known, and Spellbook.
- Spell level filters.
- Feature type filters and comparable filter groups.

Each group remains its own row; do not combine all unrelated filters into one long toolbar. Retain group headings and selection feedback. Keep source statistics available within source cards, but prevent cards from wrapping into additional rows. Spellcasting groups can retain separate headings and separate rows of slot levels.

Implementation expectations:

- Scroll the row horizontally without creating horizontal overflow for the entire page.
- Keep options and slot cards from shrinking to unreadable widths.
- Preserve native touch scrolling and provide a visible indication that more content exists horizontally.
- Allow keyboard access to every option, with visible focus and selected states.
- Bring a selected or focused option into view without unexpectedly moving the page vertically.
- Scrolling across spell slots must not accidentally consume a slot.
- Preserve current filtering, slot tracking, recovery, and source-selection behavior.
- Keep the desktop layout appropriate for wide screens; this request primarily changes mobile presentation.

### Always-visible spell basic information

Keep a spell's basic information visible even when its description is collapsed. On mobile, display the basic information in **one horizontal row**, with no visible field labels.

Use this order:

1. Casting time.
2. Range.
3. Components.
4. Duration, including a **C** marker when concentration is required.

For example:

```text
1 Action · 60 feet · V, S · 10 Minutes C
```

Display `1 Action` instead of `Time: 1 Action`; likewise remove the visible `Range:`, `Components:`, and `Duration:` prefixes. Use separators or spacing to keep the values distinct.

For duration, show the duration value without spelling out concentration or adding a `Timed` prefix, for example `10 Minutes C`. Non-concentration spells do not receive the C marker. If C is displayed in the card header as in the Android reference, omit the duplicate marker from the duration row. Make the meaning of C accessible through an accessible label or tap-accessible explanation; do not rely solely on hover.

Additional expectations:

- Keep the information row separate from the description in the detail overlay.
- If the row does not fit, allow horizontal scrolling within it rather than stacking the values or widening the page.
- Preserve meaningful casting conditions, material requirements, alternative durations, and special duration values. Compact formatting must not silently discard rules information.
- Keep field meanings available to assistive technology even though visible labels are removed.
- Use correct singular/plural duration units and handle instantaneous, permanent, special, and missing values gracefully.
- Desktop may retain the existing labeled layout.

### Swipe between sheet pages

Where practical, allow horizontal swipes to switch between the main sheet tabs in their existing order: Sheet, Features, Spells, Equipment, Monsters, and Notes. Swiping left opens the next tab; swiping right opens the previous tab. Stop at the first and last tabs rather than wrapping around.

Implementation expectations:

- Keep the tab buttons available as the explicit alternative to gestures.
- Distinguish an intentional horizontal swipe from vertical scrolling using a minimum travel distance and horizontal-direction threshold.
- Give horizontally scrollable content priority: swiping within source pickers, spell slots, filters, spell basic-information rows, tables, and other horizontal scrollers must scroll that content rather than switch pages, including at the ends of those rows.
- Do not switch tabs while interacting with inputs, editable text, sliders, text selection, dialogs, or other controls that need the gesture.
- Preserve each tab's filters, expansion state, and scroll position when navigating by swipe, just as with tab buttons.
- Update the selected tab and bring it into view after a page switch.
- Avoid triggering browser back/forward gestures or interfering with platform gestures at screen edges.
- Respect reduced-motion preferences if page transitions are animated.
- Validate on actual touch devices as well as browser emulation; if gesture conflicts cannot be resolved reliably, retain button navigation for those cases.

## Findings from the initial review

The app was reviewed locally using the supplied test account at phone, tablet, and desktop widths. No gameplay values were intentionally changed. The test character had no inventory items or monsters, so recommendations for populated Equipment and Monsters entries also relied on their templates.

At a viewport of approximately **390 × 844 CSS pixels**:

| Destination | Approximate position from the top of the page |
| --- | ---: |
| Main navigation tabs | 410 px |
| Current HP input | 1,025 px |
| First spell, with descriptions collapsed | 1,970 px |
| End of the initially collapsed Features page | 6,050 px |

At 360 pixels wide, current and maximum HP wrapped onto separate lines, and damage/heal controls formed a tall vertical stack. These measurements describe the reviewed test character, not every possible sheet.

The main contributors were stacked headers and controls, nested padding, large stat shapes, filters above the lists, and substantial content remaining visible inside collapsed cards.

## General improvements for later consideration

### Prioritize information used during play

Place a compact character status strip above the main navigation tabs. Show current/max HP, AC, temp HP when present, and active conditions. Keep it available while using Features, Spells, Equipment, and Monsters.

Tapping HP could open the existing damage/heal controls in a panel from the bottom of the screen. Keep the status strip compact enough that it does not become another large header.

On the Sheet page, prioritize combat actions and frequently used resources, followed by ability modifiers, saves, and skills. Keep relevant resistances and bonuses easy to find. Move the round tracker near combat instead of after skills and proficiencies.

### Compress the header and action area

Use the character name as the primary heading while a sheet is open. Reduce repeated character naming, generic page headings, branding, and the tagline on phones.

- Keep Save directly accessible with accurate saved/unsaved feedback.
- Combine Short Rest and Long Rest under one Rest control.
- Move Edit and Theme into a More menu.
- Avoid giving occasional settings the same visual prominence as HP and other session information.

### Keep sync visible without a permanent large panel

Show a compact normal-state sync indicator near Save. Open details on demand: last successful sync, Sync Now, account identity, and Sign Out.

Distinguish local save status from cloud synchronization. Pending changes, offline status, errors, and conflicts must remain clear. Conflicts and changes requiring user action should still produce prominent notices and accessible resolution controls.

### Keep navigation reachable and preserve context

Consider making the compact status strip and tab bar sticky while scrolling. Shorten Features & Traits to Features on phones and make horizontally hidden tabs discoverable.

Preserve filters and scroll position for each tab when switching away and returning. Account for sticky controls when navigating to an entry so its heading remains visible.

### Reduce decorative space

Several tabs combine outer page padding, 32-pixel section padding, and additional card padding. Reduce mobile section padding toward 8–12 pixels where appropriate, use thinner borders, reduce shadows, and remove unnecessary nested boxes.

Keep desktop's useful columns while applying the same visual simplification where it improves clarity. Choose tablet layouts based on usable content width rather than allowing narrow columns to become cramped.

### Preserve comfortable interaction

- Reduce decoration before reducing text size or interactive target areas.
- Replace hover-only explanations with tap-accessible and keyboard-accessible details, including AC, movement speeds, properties, and masteries.
- Use readable labels such as Class feature and Long rest instead of raw identifiers such as `CLASS_FEATURE` and `LONG_REST`.
- Give resource consumption an explicit control rather than making an entire tracker card consume a use when tapped.
- Avoid nested interactive controls, such as a Delete button inside the button that opens an entry.
- Keep important state understandable without depending on color alone.

## Recommendations by page

### Sheet

- Replace the large circular AC, movement, initiative, proficiency, and perception displays with compact stat cells.
- Keep the three-across mobile ability layout, condense the desktop card style, and retain the score, modifier, saving throw, and proficiency indicator.
- Keep current and maximum HP together on one line.
- Move Base HP, Override, and Clear into secondary controls.
- Keep damage/heal controls compact and group temp HP nearby.
- Consider showing death saves automatically at zero HP, with manual access available otherwise.
- Include hit dice directly in the mobile health overlay, with remaining/total counts and down/up controls.
- Collapse character description, languages/proficiencies, and the full feature index when they are not needed.
- Avoid nested vertical scrolling in long combat and feature sections on mobile where page scrolling is sufficient.

### Features

Implement the requested single-row source and type filters first.

Later, consider a search field and compact entry summaries containing the name, useful source context, and remaining uses. Put detailed type/level/publication metadata, rules, and choice notes behind expansion. Keep frequently used trackers accessible without opening the full rules description.

Species information should not require a large introductory card before the feature list. Use a compact species summary that opens its full details in an overlay.

### Spells

Implement the requested horizontal slot/filter/source rows and always-visible, unlabeled basic-information row first. Retain basic information when descriptions are collapsed; the broader compact-card recommendation must not override this requirement.

Later improvements to consider:

- Add search and reduce the vertical space occupied by advanced filters.
- Keep prepared/known/spellbook selection easy to understand and preserve preparation-lock behavior.
- Make concentration and ritual indicators easy to scan.
- Show shared recovery information once per slot group where applicable rather than repeating it for every level.
- Consider a compact slot presentation using level, remaining/total, and tappable slot indicators.
- Keep relevant casting attack bonus and save DC easy to reach.
- Put school, publication source, and lengthy reference metadata in less prominent positions.

### Equipment

- Replace the large currency panel with a compact GP/SP/CP row.
- Offer equipped items first or provide an Equipped filter.
- Keep compact item summaries focused on name, quantity, equipped state, relevant damage/AC, and charges.
- Reveal weight, value, rarity, properties, bonuses, and the full description on expansion.
- Move Delete into an entry menu so it does not compete with normal play actions.
- Keep equip, attune, and quantity controls usable without unintended expansion or deletion.

### Monsters and companions

- Distinguish active companions from reference monsters.
- Give active companions immediate access to current/max HP, AC, and useful actions.
- Use compact collapsed entries for reference monsters.
- Move HP formulas, base values, and overrides into secondary details.
- Preserve full stat blocks and trackers on expansion.

### Notes

Retain readable note content and the existing collapsible groups. Apply shared spacing improvements where helpful. If notes grow lengthy, consider compact heading previews and search, while preserving Markdown readability and the distinction between applying a note draft and saving the sheet.

## Suggested sequence

1. Implement the specifically requested mobile rows and spell summary formatting, then add swipe navigation with gesture-conflict handling.
2. Add the compact status strip, simplify header actions, and compact normal sync status.
3. Improve navigation reachability and preserve tab context.
4. Reduce collapsed-card height and nested padding, respecting the always-visible spell basics requirement.
5. Refine page-specific layouts and accessibility details.

Use the implementation status section to identify what remains from this sequence.

## Validation checklist for future implementation

- Check phone widths around 360 and 390 pixels, a tablet width around 768 pixels, and a desktop width around 1440 pixels.
- Confirm that source, slot, and filter collections remain one horizontal row on phones.
- Confirm that only the relevant row scrolls horizontally and the page stays within the viewport.
- Check long source names, multiclass characters, multiple slot groups, and many spell levels.
- Verify selection and keyboard focus remain visible when rows scroll.
- Verify scrolling slot rows does not consume slots and all tracking controls still work.
- Confirm collapsed spells always retain their basic-information row.
- Check bonus actions, reaction conditions, long material components, concentration, alternative durations, and non-timed durations.
- Check screen-reader labels and touch access to the concentration explanation.
- Check left/right swipes across all main tabs, including the first and last tabs, and confirm the selected tab stays visible.
- Confirm horizontal row scrolling, vertical scrolling, text selection, form controls, and dialogs do not accidentally switch tabs.
- Check gesture behavior on actual touch devices, including browser edge gestures and reduced-motion settings.
- Confirm desktop presentation remains usable and shared editor components retain their existing behavior.
- Recheck HP visibility and the distance to the first feature/spell after each relevant layout change.
- When implemented, verify saving, syncing, rest actions, preparation, quantities, and companion HP behavior remain correct.

## Likely implementation locations

- `src/app/sheet/character-sheet.component.ts`: sheet header, actions, navigation, and shared status placement.
- `src/app/sheet/mobile-character-info-page.component.ts`: dedicated mobile Sheet composition using shared sheet logic.
- `src/app/sheet/mobile-sheet-status.component.ts` and `mobile-sheet-actions.component.ts`: mobile status/health panel and action menus.
- `src/app/sheet/sheet-health.ts`: shared damage, healing, and temporary-HP rules.
- `src/app/sheet/sheet-source-picker.component.ts`, `horizontal-row.directive.ts`, and `spell-summary.component.ts`: sheet source rows and compact spell presentation.
- `src/app/sheet/swipe-pages.directive.ts`: guarded touch gestures for page navigation.
- `src/app/sheet/character-info-page.component.ts`: HP, combat, ability, and general-stat layouts.
- `src/app/sheet/features-page.component.ts`: feature filters and cards.
- `src/app/sheet/spells-page.component.ts`: slot rows, spell filters, and always-visible spell summaries.
- `src/app/editor/feature-source-picker.component.ts`: shared source picker; scope mobile changes to sheet usage as needed.
- `src/app/sheet/source-stats.component.ts`: source statistics presentation.
- `src/app/sheet/character-helpers.service.ts`: compact spell formatting without losing full reference information.
- `src/app/sheet/equipment-page.component.ts`: currency and inventory layout.
- `src/app/sheet/equipment-page.component.html`: compact inventory cards, search, filters, and expanded item controls.
- `src/app/sheet/monsters-page.component.ts`: companion summaries and trackers.
- `src/app/sheet/monsters-page.component.html`: searchable companion/reference lists and expanded HP/stat-block details.
- `src/app/sheet/rule-details.component.ts`: touch/keyboard-accessible item property and mastery explanations.
- `src/app/sheet/feature-uses.component.ts`: compact and explicit resource tracking.
- `src/app/characters/sync/sync-status.component.ts`: compact synchronization status and expanded details.
- `src/app/app.html` and `src/app/app.css`: application branding and shared header spacing.


## App-inspired detail overlays and health panel (implemented)

The Android app remains layout inspiration. Keep the web app's existing theme, typography, and desktop styling consistent; dedicated components and larger structural changes are welcome when they simplify mobile use. Prefer Tailwind utilities.

- Mobile status uses an outlined AC shield and octagonal initiative badge, with the health card alongside them.
- Uses above five display a remaining/total counter with a down arrow to spend and an up arrow to restore. Up to five retain checkboxes; the progress bar animates.
- Features, species, spells, items, and monsters open formatted details in a shared modal on both mobile and desktop. Descriptions no longer expand underneath cards. Quick summaries and trackers remain available in lists.
- Detail dialogs retain notes, trackers, item equipment/quantity controls, full monster stat blocks and tracked HP controls. Spell reference information wraps inside the dialog so long material components remain readable; list summaries retain their compact horizontal row.
- Native modal behavior supports Escape, focus containment, backdrop dismissal, and return to the opener. A sticky close button stays visible while reading. Background scrolling is locked, and swiping inside a dialog cannot change sheet pages.
- Deleting an item closes its detail overlay before showing confirmation; cancelling returns to its details.
- The mobile health overlay contains damage, healing, temporary HP, hit dice, and conditions together. Hit dice show the healing formula and remaining/total, with bounded down/up controls. Spending a die records its use; apply the actual rolled healing separately.
- The mobile header always shows the conditions entry point, including an explicit None state. Active conditions remain visible there, and the health overlay shows their count and management controls.

Validated detail overlays at 320, 360, 390, 768, and 1440 px, including long item names, populated companion stat blocks, focus restoration, and scroll-lock release. Android hardware gesture testing remains useful.


### Mobile sheet follow-up (implemented)

- Skills are always expanded, using the desktop proficiency circles, expertise symbols, signed bonuses, and ability abbreviations. Ability cards retain the desktop visual hierarchy with smaller padding.
- The inline Health Details & Death Saves disclosure is removed. Its maximum-HP override and death-save controls now live in the health popup alongside hit dice and conditions.
- Clicking the mobile AC shield edits the override in place. Enter/blur saves, Escape cancels, and the reset control clears the override. The mobile control inherits the exact desktop AC editing methods.
- All use-tracker groups have a 12 px Tailwind gap, and tracker component hosts render as blocks.
- Preparation controls are 32 px icon buttons, retaining explicit accessible action labels, tooltips, and locking behavior.

Verification: 306 tests pass. Layout checks at 320, 360, 390, 768, and 1440 px show no horizontal overflow or browser console errors. The production build passes with the existing bundle and editor stylesheet budget warnings.


### Health and Section Styling Polish

- Keep one HP adjustment workflow: use Damage, Heal, and Set Temp HP; omit the duplicate direct current-HP input.
- Death Saves use the desktop candle/heart symbols, opposing failure/success tracks, theme colors, and grouped controls.
- General Stats and Languages & Proficiencies share the detail overlays' rounded borders, divided headings, surface colors, and inset content groups. Keep headings in title case, leaving short connecting words such as ?and? lowercase.


### Mobile Header and Combat Navigation

- Portrait and description remain visible in the mobile header on every tab, with portrait editing available on tap.
- Mobile Combat has its own tab after Sheet. Preserve desktop combat action styling, resource-specific colors, navigation links, and round tracking. Desktop Combat remains in Sheet.
- Mobile swipes follow the visible tab order; resizing to desktop while on Combat returns to Sheet.
- AC, initiative, and PB share a header row. HP and an inspiration icon share the next row. Remove the redundant passive-perception and walk/PB summary strip; retain walking speed in General Stats.
- Use trackers start with top margin as well as spacing between trackers. List/feature type filter labels use title case.


### Detail Overlay Width Containment

Detail dialogs use viewport-based width limits and a separate scrollable content area. Oversized imported content stays inside the modal; the title and close control remain fixed above it. Verified with 1400 px-wide content at viewport widths of 320, 360, 390, 768, and 1440 px.


### Companion Cards and Mobile Tabs

- Companion HP and Temp HP have separate outlined containers; Temp HP and its input use the green theme border. The controls share a row when space allows and wrap on narrow screens.
- AC, Initiative, Speed, and CR use compact stat containers in a responsive grid.
- Mobile tabs retain the desktop underline treatment, transparent inactive backgrounds, and a subtle primary-tinted background only for the selected tab.


## Full Sheet Review ? 16 October 2026

Reviewed every sheet tab at 320, 390, 768, and 1440 px in browser mobile/desktop emulation, with dark and light Monte Carlo theme checks. Scope: Sheet, mobile Combat, Features, Spells, Equipment, Monsters, and Notes. Used temporary populated inventory, companions, combat actions, and notes where the test character had empty lists; restored the original character and theme without saving those examples.

Checked species/feature/spell/item/monster overlays, note editing, health-popup scrolling, viewport containment, selected-tab visibility, and desktop/mobile transitions. No document overflow, off-screen overlay close controls, nested buttons, or runtime errors remained in those checks.

Fixes from this review:

- Desktop spell-slot grids fit the number of groups and available width, avoiding an unused column and unnecessary checkbox wrapping.
- Desktop tabs reserve scrollbar space so short pages do not shift the centered layout sideways.
- Tab rows reveal the active tab when their width changes, including desktop-to-phone transitions.
- Feature type labels use readable title case inside cards and overlays.
- Monster overlays avoid repeating creature size/type/alignment before the stat block.
- Equipment/monster searches, note fields, inline annotation fields, and portrait URL editing use readable mobile font sizes to avoid input-triggered zoom.

Validation: 309 tests pass. Production build succeeds with the existing initial-bundle and editor stylesheet budget warnings. Physical-device browser gesture behavior remains outside these emulated checks.


### Recovery Icons

Use a shared recovery indicator in the top-right corner of use trackers and spell-slot cards, in both mobile and desktop sheet views:

- Long Rest: bed.
- Short Rest: campfire.
- Short Rest +1: campfire with a small +1 marker.
- Manual: raised stop hand.

Viewer indicators have descriptive accessible labels and tooltips. Editor/creator previews show the same icons with recovery text retained; recovery selects keep readable option labels. Custom recovery descriptions remain visible rather than being replaced by an unexplained icon. Rest actions use matching bed/campfire imagery.

Validated on the populated character's Breath Weapon/Draconic Flight trackers with no horizontal overflow. All 312 tests pass; production build succeeds with the existing budget warnings.

### Confirmed Mobile Spell Overflow Cause

The remaining sideways-panning issue was reproduced with the affected character. Absolutely positioned screen-reader-only labels in spell summaries escaped horizontally scrollable rows because those rows lacked a positioning boundary. Giving horizontal rows position: relative confines those labels to their own scroller. The document width dropped from 640 px to the available viewport width at 320, 360, and 390 px; desktop remained unchanged. Removed the earlier document-level overflow-clipping workarounds.
