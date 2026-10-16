# Combat quick references

The creator's Combat tab edits the existing portable `combatActions` array. Entries have a
name, action type (Action, Bonus Action, Reaction, Other), optional range, attack/save text,
and short damage/healing/effect text. Up/down controls reorder entries within their action
group using `orderIndex`; editing the action type moves the entry into another group.

Bookmark buttons on selected features, spells, species, items and monsters open a shared
review dialog. They do not add an entry until Save Combat Entry is selected. Monster bookmarks
offer individual actions, bonus actions, reactions and traits. Several references may point
to the same source, such as different attacks from one companion.

`src/app/editor/combat-actions.ts` contains the prefill and reference-resolution helpers:

- Spell casting time suggests the action group. Explicit spell attack/save metadata uses
  the selected casting source's current attack/DC, including custom source overrides.
- Imported attack/DC and dice tags supply numeric suggestions where available.
- Weapon damage uses its damage die, Strength/Dexterity (including Finesse), proficiency,
  and the basic weapon bonus. These are suggestions, not a complete combat rules engine:
  situational modifiers, unusual weapon proficiency, scaling and conditional effects need review.
- Other entries suggest a short textual effect. Unknown values stay editable rather than
  executing imported formulas or pretending to resolve ambiguous rules.

Numbers and summaries are snapshots; changing abilities or levels does not silently rewrite
manual combat edits. Links resolve the source's editorId first, so renaming it remains safe.
Old RAW exports can resolve name/source links. Removing a source leaves the combat summary
intact, marks its source as missing in the creator, and disables its viewer navigation.

The viewer groups/sorts the entries on the main Sheet page. Clicking a linked entry selects
the relevant page, clears obstructing filters, expands the target and scrolls/highlights it.
Combat-specific anchors include editorId to distinguish separate copies of the same item.
The same JSON persistence, exports and cloud sync carry these entries without a new backend schema.
