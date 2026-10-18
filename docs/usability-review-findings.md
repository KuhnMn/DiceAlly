# Viewer and Creator Usability Review Findings

Review date: 18 October 2026.

## Scope and evidence

This review covers the viewer and creator, including the library/import, game-data,
and export/share screens. It complements the earlier, viewer-focused
[UI Improvement Guide](ui-improvement-guide.md).

The review combined source inspection with 55 rendered states in Chrome using a
synthetic multiclass character with spells, resources, equipment, and a companion.
The main layouts were inspected at 390 px, 768 px, and 1366 px widths. Additional
320 px checks covered the library and game-data screens.

Physical-device keyboard behavior and populated wizard/catalog flows still need
hands-on testing. Measurements depend on character content, viewport, and expanded
sections. Findings below distinguish observed behavior and source-confirmed issues
from proposed enhancements.

This document records recommendations, not completed implementation or approval to
change behavior. D&D automation should retain manual overrides for house rules and
character-specific exceptions.

## Overall assessment

The main usability issues are excessive scrolling during play, unclear distinctions
between related D&D concepts, and actions that change more than a player would
expect. The viewer's separation into pages is useful. No page-wide horizontal
overflow was found in the main viewer/creator screens at the tested widths;
the library/import screen did overflow at 320 px.

## Highest-priority findings

### F01 — Preserve maximum-HP and AC overrides when opening the editor

- **Evidence:** Source-confirmed behavior.
- **Affected flow:** Viewer → Edit → Save; mobile and desktop.
- **Finding:** Opening the editor copies maximum-HP and AC overrides into the base
  stats. Saving then clears the overrides.
- **Player impact:** A character with 52 base maximum HP temporarily reduced to 40
  can end up with 40 as the permanent base after an unrelated edit.
- **Recommendation:** Keep base values and temporary overrides separate. Changing
  the base should be an explicit editing action.
- **Reference:** [Local editor](../src/app/editor/local-editor.component.ts),
  especially `open()` and `save()`.

### F02 — Separate equipped state from attunement

- **Evidence:** Reproduced in the browser and confirmed in source.
- **Affected screen:** Equipment; mobile and desktop.
- **Finding:** Unequipping an attuned item also removes its attunement.
- **Player impact:** Taking off a cloak should disable worn benefits while
  preserving the attunement bond.
- **Recommendation:** Maintain equipped and attuned states independently. Add an
  attunement count and a separate action for ending attunement, allowing exceptions
  for class features and house rules.
- **References:** [Equipment actions](../src/app/sheet/equipment-page.component.ts),
  `toggleEquipped()`;
  [D&D attunement rules](https://www.dndbeyond.com/sources/dnd/br-2024/equipment#EndingAttunement).

### F03 — Make resting recoverable and clarify the rules version

- **Evidence:** Immediate rest changes reproduced in the browser; recovery behavior
  confirmed in source.
- **Affected flow:** Short Rest and Long Rest; mobile and desktop.
- **Finding:** Rest buttons immediately change HP and multiple resource counters.
  There is no dedicated Undo action. The recovery policy is not presented as an
  explicit 2014/2024 character setting.
- **Player impact:** A mistaken Long Rest is difficult to reverse manually. Players
  can also assume recovery rules that differ from the selected campaign rules.
- **Recommendation:** Offer a recovery preview or Undo action and make the rest
  rules explicit. In particular, 2014 normally restores only some spent Hit Dice,
  whereas 2024 restores all of them.
- **References:** [Sheet rest actions](../src/app/sheet/character-sheet.component.ts),
  [rest service](../src/app/services/rest.service.ts),
  [2014 rest rules](https://www.dndbeyond.com/sources/dnd/basic-rules-2014/adventuring),
  [2024 rest rules](https://www.dndbeyond.com/sources/dnd/br-2024/rules-glossary/#LongRest).

### F04 — Protect unfinished note drafts

- **Evidence:** Source-confirmed separation between note drafts, applied sheet data,
  saving, and navigation protection.
- **Affected screen:** Notes; mobile and desktop.
- **Finding:** Notes require Apply Changes followed by saving the sheet. The main
  Save action does not include an unapplied draft, and navigation protection checks
  the sheet rather than the draft.
- **Player impact:** A player can write session notes, press Save, and reasonably
  believe that the draft is safe when it has not been included in the saved sheet.
- **Recommendation:** Include drafts in saving, or clearly identify pending drafts
  and warn before leaving with one.
- **References:** [Notes component](../src/app/sheet/notes-page.component.ts),
  [notes template](../src/app/sheet/notes-page.component.html),
  [navigation guard](../src/app/guards/unsaved-changes.guard.ts).

### F05 — Warn when combat references become outdated

- **Evidence:** Source-confirmed snapshot behavior.
- **Affected screens:** Combat creator and viewer; mobile and desktop.
- **Finding:** Combat entries contain saved attack bonuses, damage, and DCs.
  Changing an ability score, level, or weapon does not automatically refresh those
  strings.
- **Player impact:** A player can use an outdated attack bonus or saving-throw DC
  after leveling up or changing equipment.
- **Recommendation:** Offer Refresh from Source with a preview that preserves
  deliberate customizations. Indicate when a linked entry may be outdated.
- **References:** [Combat prefilling](../src/app/editor/combat-actions.ts),
  [combat entry dialog](../src/app/editor/combat-action-dialog.component.ts),
  [viewer combat data](../src/app/sheet/character-info-page.component.ts).

### F06 — Track active concentration

- **Evidence:** Enhancement opportunity identified through source and screen review.
- **Affected screens:** Spellcasting, Combat, and Health; mobile and desktop.
- **Finding:** Spells that require concentration are marked, but there is no
  dedicated indication of the effect on which the character is currently
  concentrating.
- **Player impact:** Players must remember the active effect, replacement of an
  existing effect, and concentration saves after damage.
- **Recommendation:** Add a persistent control such as Concentrating: Entangle,
  with an end action and a reminder after taking damage. Support custom effects
  because concentration is not limited to spells.
- **References:** [Spellcasting viewer](../src/app/sheet/spells-page.component.ts),
  [health adjustments](../src/app/sheet/sheet-health.ts),
  [concentration rules](https://www.dndbeyond.com/sources/dnd/br-2024/rules-glossary/#Concentration).

## Improvements across layouts

| ID | Area | Finding | Recommended improvement |
| --- | --- | --- | --- |
| F07 | Mobile screen space | At 390 px, creator content starts around 570 px down. The first spell in the viewer starts around 1,240 px down. | Compress branding, account controls, identity details, and filters. Prioritize controls needed for the current task. |
| F08 | Desktop screen space | Large identity cards, borders, and stat badges push frequently used information down the page. | Offer a compact play layout, particularly for combat, skills, and spellcasting. |
| F09 | Touch controls | Some proficiency buttons are 24×24 px, resource arrows are similarly small, and equipment actions are 32×32 px. | Give frequent actions roughly 44 px touch areas, with spacing between spending, restoring, and deleting. |
| F10 | Navigation | Nine creator tabs require horizontal scrolling on phones. Tablet labels wrap into tall blocks. Creator navigation scrolls away on long pages. | Add a compact page selector or sticky navigation with a clear current-page indicator. |
| F11 | Saving and syncing | Saved, Save Entry, Apply Changes, and cloud synchronization describe different stages. | Use consistent wording such as Apply to Character, Saved on This Device, and Synced to Account. |

## Viewer screen findings

These recommendations include workflow enhancements as well as refinements to
existing controls. F01–F06 above cover the highest-priority state-management issues.

| ID | Screen | Recommended improvements |
| --- | --- | --- |
| F12 | Sheet | Show passive Perception on mobile without requiring mental calculation. Keep frequently requested values near skills and saves. Make the effects of equipment and overrides easy to inspect. |
| F13 | Health | When HP reaches zero, prioritize death saves over maximum-HP configuration. Provide a clear reset/stabilized workflow. Combine spending a Hit Die and entering its healing result into one interaction; these are currently separate operations. |
| F14 | Conditions & Effects | Add the missing Invisible preset and an exhaustion level counter. Let players inspect a short rules reminder. Clearly distinguish a recorded condition from an effect that actually changes calculations. Exhaustion needs more information than an on/off tag; see the [exhaustion rules](https://www.dndbeyond.com/sources/dnd/br-2024/rules-glossary/#ExhaustionCondition). |
| F15 | Combat | Put linked resource spending beside the action where practical. Let custom entries expand to show their complete text: unlinked entries are currently disabled buttons, while long effects can be truncated. |
| F16 | Features & Traits | Allow favorites or a Limited-use Abilities view. During combat, players usually need Rage, Wild Shape, or Second Wind faster than they need to browse every class feature. |
| F17 | Spells | Add an optional Cast action that chooses a slot level or free-use tracker, retaining manual spending. Collapse advanced filters and put search nearer the list. Make ritual casting and upcasting explicit without assuming every casting consumes a slot. |
| F18 | Equipment | Add quick quantity adjustments and Use One for ammunition and consumables. Offer coin adjustments such as Spend 15 GP rather than requiring replacement of totals. Show attunement usage separately from equipment state. |
| F19 | Monsters & Companions | Reuse the character's Damage/Heal interaction instead of requiring players to calculate and overwrite HP. Allow frequently used companion actions to remain visible beside their trackers. |
| F20 | Notes | Add search and pinned notes for objectives, NPCs, and important clues. Avoid making an entire note chip a deletion action without an Undo option. Protect unapplied drafts as described in F04. |

## Creator screen findings

| ID | Screen | Recommended improvements |
| --- | --- | --- |
| F21 | Basic Info | Move Portrait below essential setup. Bring HP, AC, and hit dice closer together. Explain what automatic AC includes. Offer a Ready to Play checklist for missing HP, hit dice, and other essentials while allowing incomplete drafts. |
| F22 | Ability Scores | Offer optional standard-array and point-buy helpers, with a manual mode. Distinguish base scores from increases where the character's rules support them. |
| F23 | Proficiencies & More | Offer direct rank selection alongside the cycling icon. Going from None to Expertise currently requires cycling through intermediate states. Display a short explanation of the resulting total. |
| F24 | Feature Sources / Spell Slots | Explain Feature Source using examples such as Ranger, Cleric, or a magic item. Distinguish a casting ability from the slot pool used to cast spells. Make multiclass shared spellcasting and Pact Magic particularly clear. |
| F25 | Species & Features | Keep species traits and class/feat selections visibly distinct. Offer descriptions while choosing options so players can compare benefits before adding them. |
| F26 | Spells | Avoid opening on an empty Known list when the character already has Prepared spells. Explain Known, Available, Spellbook, and Prepared according to class and rules. Treat Always Prepared separately from whether a spell has a use tracker. |
| F27 | Items | Give custom weapons and armor optional structured fields for damage, AC, properties, and weight. Custom items are currently easier to describe than to configure mechanically. |
| F28 | Monsters | Use an explicit Track HP switch followed by a starting-HP choice. Requiring a maximum-HP value to enable tracking is difficult to discover. |
| F29 | Combat | Offer starting templates for weapon attacks, spell attacks, saving-throw abilities, and common actions. Explain what a bookmark creates and which values remain manually maintained. Address stale references as described in F05. |
| F30 | Class Wizard | Provide a clearly named Level Up entry point. Explain proposed changes before applying them, make unfinished choices conspicuous, and let players inspect option descriptions during selection. Explain where background and starting-equipment choices belong in first-time setup. |

## Supporting screen findings

| ID | Screen | Finding and recommended improvement |
| --- | --- | --- |
| F31 | Library / Import | At a requested 320 px width, the layout expands to 340 px; the Share Code Load button extends beyond the viewport. Fix input/button sizing. For larger libraries, add search, sorting, and possibly duplication. |
| F32 | Game Data / First-run Setup | The wizard's empty-library state presents an error telling the user to import content. Replace this with guided setup explaining what is needed and how to return to the draft. |
| F33 | Export / Share | Share via Code Sync suggests an ongoing connection, although importing creates an independent copy. Rename it accordingly. Use the same focus containment and Escape handling as the other dialogs. |

## Suggested implementation order

1. Address unexpected state changes and draft protection: F01–F05.
2. Improve play-time visibility and interaction: F06–F17, especially scrolling,
   touch controls, concentration, and spellcasting.
3. Improve creator guidance and explain D&D concepts: F21–F30.
4. Finish supporting-screen fixes and optional convenience features: F18–F20 and
   F31–F33.

Before implementation, review intentional behavior changes against the selected
D&D rules version and the tool's support for freeform character editing.

## Implementation progress (18 October 2026)

The first implementation pass keeps manual control and uses the following scope:

- **F01:** The editor reads and edits base maximum HP and AC without replacing or
  clearing temporary overrides. Active overrides are identified beside the base controls.
- **F02:** Equipping and attunement are independent. Attunement remains accessible
  while unequipped, and the inventory shows a count without enforcing a limit.
- **F03:** All viewer rest entry points show a cancellable recovery preview. The
  existing recovery policy is retained and described explicitly, including full
  Hit Dice recovery on a long rest. No 2014/2024 selector or Undo is introduced in
  this pass; manual resource adjustments remain available.
- **F04:** Main Save includes an open note draft. Drafts participate in unsaved-change
  protection for navigation, refresh, and browser closing. Opening another note
  asks before discarding a changed draft. Apply to Character remains available.
- **F05:** Newly bookmarked combat entries store their generated source values.
  The creator Combat page indicates changed suggestions or missing sources and offers a
  field-by-field refresh preview. Customized fields start unchecked; older entries
  without a baseline require explicit field selection. Older monster bookmarks
  without a reliable source ability must be bookmarked again. Suggestions retain
  the existing prefill's supported formulas; arbitrary custom formulas are manual.
- **F06:** A concentration icon beside the round tracker in mobile and desktop
  Combat opens the existing dialog design to track a spell or custom effect, replace
  it, or end concentration. While concentrating, damage adjustments open a reminder
  with Okay and End Concentration; dismissing the popup keeps concentration. The
  creator Spells tab provides a per-character reminder toggle (enabled by default).
  Saves and spell casting remain manual. Concentration state and reminder settings
  are included in normal sheet saving.

Validation: automated regression tests cover override persistence, independent
attunement, note-draft saving, rest preview/cancellation, combat change detection
and customization preservation, and concentration tracking/reminders. Physical
mobile-device interaction remains unverified.
