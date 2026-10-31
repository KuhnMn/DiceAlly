# Global reprint visibility

The shared Source Books panel offers Hide Reprinted Content. It defaults to off
and persists as the device-wide `ally-hide-reprinted-content` browsing preference.
The existing account-synced source-book array and category-local book selections
keep their current format and behavior. This new flag is not cloud-synced.

`isReprinted` in `content/content-visibility.ts` recognizes only explicit boolean
`isReprinted: true` or historical `reprinted: true`. It reads both ordinary record
payloads and canonical reference definitions, such as vehicles. `legacy`, editions,
`reprintedAs` links, numeric values and strings do not implicitly hide an entry.

The preference applies to creator catalogs, class/subclass choices, tools,
Compendium category lists and cross-category search. Filtering happens before
paging and result totals. With reprints hidden, category facets are derived from
the visible records rather than the unfiltered cached summary. Re-enabling them
restores the normal summary path. Local search text and list filters survive a
visibility change.

Subclass visibility is checked before legacy-copy deduplication so a hidden copy
cannot suppress an otherwise visible original. Already selected creator classes,
subclasses, species and backgrounds remain selectable. Existing character lists,
snapshots and notes are never removed by changing this browsing preference.

The Class Wizard excludes new deprecated spell-list suggestions and optional
feature candidates while retaining existing spell entries and confirmed choices.
Mandatory feature/spell grants still resolve against the complete pinned library;
the browsing filter does not invalidate a character's mechanical dependencies.

No content import or schema is changed. Existing imported flags are used directly.
Tests cover strict flag semantics, preference persistence and restoration,
retained character selections, paging/facets, global search and subclass copies.
