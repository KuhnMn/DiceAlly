# Character creator rebuild reference

User specification recorded 2026-10-14. This is the reference for rebuilding the creator and supersedes the previous five-step creator design described in `LOCAL_CREATOR.md`. The previous implementation was rejected as unusable and does not meet the intended workflow.

## Direction and current scope

- Rebuild around the Android character editor's page setup and general layout, with small adjustments for the web.
- Inspect the actual Android screens before implementing their equivalents. Reference root: `C:/Users/maxim/AndroidStudioProjects/DnDAlly2/app/src/main/java/com/ltx/`.
- Follow the existing web application's visual language: its themes and Tailwind CSS. Avoid a separate visual system for the creator.
- Use ordinary, clearly labelled form controls. Do not expose rule-engine terminology such as "grants" or require users to edit JSON for ordinary character editing.
- The character is freely editable. A wizard prefills the sheet; it does not impose class/rules boundaries. Explicit manual edits take precedence over wizard-generated values.
- Work page by page with the user. **The immediate implementation scope is only the first page, Basic Info.** The remaining pages and wizard are recorded below for later work, not part of this first iteration.
- Hit Dice may be incorporated into Basic Info in the web editor, but its detailed implementation can be addressed when that part is reached.

## Page 1: Basic Info

- Name.
- Description.
- Portrait.
- Combat stats:
  - Level.
  - Maximum HP.
  - Armor Class:
    - Choose manual entry or calculated AC.
    - When calculation is enabled, offer an unarmored-defense toggle and a preferred ability for that calculation.
  - Resistances.
  - Senses with a range for each sense.
  - Speeds: Walk, Fly, Swim, Burrow.

Portrait input behavior, units, defaults, and detailed control presentation should follow the inspected Android editor and the existing web UI where applicable. Do not silently add rules restrictions that were not requested.

## Page 2: Ability Scores

Set the six ability scores directly.

## Page 3: Hit Dice

Manage hit dice. This may be moved onto Basic Info for the web editor.

## Page 4: Skill Proficiencies

- Show the complete list of skills.
- Each skill cycles/selects None, Half, Full proficiency, or Expertise.
- Allow a positive or negative manual bonus for each skill.

## Page 5: Saving Throw Proficiencies

- Show the saving throws.
- Full proficiency is a yes/no toggle; no half proficiency or expertise.
- Allow a positive or negative manual bonus, as with skills.

## Page 6: Other Proficiencies and Advantages

- Simple Weapons: checkbox.
- Martial Weapons: checkbox.
- Initiative proficiency: checkbox.
- Advantages/disadvantages: add/remove entries with what the effect applies to, a condition, and whether it is advantage or disadvantage.
- Tool proficiencies: select tools from the actual tools in the local content database.
- Language proficiencies: an editable list of strings with add/remove controls.

## Page 7: Feature Sources

- Feature Sources:
  - Add/remove sources.
  - A source can support general features, spellcasting, or both.
  - General features include feats, optional features, and class features.
  - Associate one or multiple abilities with a source, or specify a custom attack bonus and save DC.

## Conditional page: Spell Slots

Show when spellcasting sources exist. Manage each slot's source, spell level, total, and recovery policy:

- Short Rest.
- Short Rest +1: regain only one slot on a short rest. (This should be a general behaviour that will later be reused for features)
- Long Rest.
- Manual Only.

## Further pages: Features and Spells

Provide pages to add/manage features and spells. Detailed layouts will be discussed when those pages are implemented.

## Character Wizard: later iteration

- Offer the wizard before manual editing and make it accessible again from a persistent button.
- Select classes and matching subclasses; also support species in the web version.
- Prefill feature/casting sources, spells, features, maximum HP, level, hit dice, and other applicable sheet fields.
- Prefill is a convenience, not an ongoing validator or restriction on what the character may contain.
- Manual edits take precedence. Do not make ordinary saves depend on resolving automatic class choices or rule-engine previews.

## Acceptance for the immediate iteration

A usable Basic Info page matching the Android/editor visual direction, with the requested fields and AC modes, using the web application's theme and Tailwind styling. Other pages and wizard behavior must not be presented as complete by this iteration.

## Page 1 implementation (2026-10-14)

- `/dev/characters` now opens Basic Info directly. The old multi-step UI has been replaced.
- Android references inspected: `CreateCharacterScreen.kt` (`Page1_NameAndVitals`, `ArmorClassCard`, `CharacterExtraStatsCard`) and creator defaults in `CreateCharacterViewModel.kt`.
- Stacked theme-aware cards follow the Android layout: Basic Information, Portrait, Combat Stats, Armor Class, General Stats. Tailwind provides responsive spacing/layout; component styles use the existing `--md-sys-color-*` palette.
- Includes name/description, uploaded or URL portrait, level/max HP steppers, manual or calculated AC, unarmored-defense ability selection, resistance chips, editable sense ranges, and Walk/Fly/Swim/Burrow speeds in feet. Climb is omitted from the visible form per the user's requested list; existing copied climb data is preserved.
- Save/reopen uses `ally-character-editor-v1` IndexedDB and freely editable sheet data. No compendium, class selection, or rules preview is needed. Original legacy storage and previous native saves are retained. The Characters menu can create a separate editor copy of a legacy saved character.
- Portrait uploads are embedded locally (PNG/JPEG/WebP/GIF, maximum 2 MB). Existing unrelated sheet fields survive basic-info saves.
- Fixed existing web unarmored-defense calculation to accept Android enum strings and earlier object-shaped web data.
- Tests: `basic-info.spec.ts` covers page scope, persistence, validation, stale saves, and AC modes. `scripts/basic-info-acceptance.mjs` verifies the browser workflow, portrait upload, and light/dark layouts at desktop, 390px, and 320px widths. Results: `basic-info-acceptance-results.json`. Physical-device checks remain deferred.
- The wizard, hit-dice editor, and subsequent pages remain future iterations.

## Page 2 implementation (2026-10-14)

Ability Scores is now the second editor page, reached from the page navigation or Next/Previous buttons. Its six named score rows follow Android's `Page2_AbilityScores` steppers, with direct numeric input and a small modifier readout. Both pages edit the same character and save together; switching pages preserves pending edits. The existing card/button styling is reused. Changing Dexterity or the selected unarmored-defense ability updates calculated AC on Basic Info. Missing ability fields in older editor/legacy copies default to 10. Scores require nonnegative whole numbers without imposing class, point-buy, or score-cap restrictions.

## Page 3 implementation (2026-10-14)

Hit Dice is a separate third page. Each die-type entry has its own bordered panel with a total stepper and Remove action. The Add Hit Dice controls occupy a separate panel. Used hit dice are session state and are not shown in the creator, per user clarification. Adding the same die type merges totals, matching Android's `addHitDie`, and preserves its used count. Common die types are suggested; custom numeric die types are accepted. Editing totals never silently resets usage. The shared save/reopen flow persists all three pages. Legacy text-shaped hit dice are preserved until the user explicitly chooses to replace them with an editable list. Currency and subsequent pages remain later work.

## Page 4 implementation (2026-10-14)

Skill Proficiencies lists all 18 skills in compact rows matching the main sheet. Clicking a 24px outlined circle cycles None → Half → Full → Expertise, using the sheet's empty-circle, ◐, ● and ✪ symbols and corresponding theme colors. Each row shows the total, name, associated ability, and a compact signed manual-bonus field. The total combines the ability modifier, proficiency rank and manual bonus; half proficiency rounds down as in the viewer. Values use the viewer's uppercase skill keys and preserve unrelated proficiencies. All four pages share local save/reopen. Saving throws and subsequent pages remain later iterations.

## Page 5 implementation (2026-10-14)

Saving Throws uses the same compact rows and 24px circle icons as Skills. Each of the six abilities has a full-proficiency toggle (no half/expertise), a signed manual bonus, and a live total. Saving throw proficiency uses the sheet's uppercase ability abbreviations; bonuses use lowercase abbreviations. Saves persist all five pages together and preserve existing skill settings. Other Proficiencies and subsequent pages remain future work.

## Page 6 implementation (2026-10-14)

User adjustments: Feature Sources has its own tab after Other Proficiencies. Advantages use an Add Entry button that creates an immediately editable entry; the separate Add panel was reverted at the user's request. Entry controls and spacing are compact, with roll type, target and condition on one row on wider screens. Tool search is inside the tool picker popup, with selection adding the tool directly; it is not a separate page-level field. The Add Sense button on Basic Info is visibly disabled while the sense name is empty.

Other Proficiencies includes separate theme-aware cards for combat proficiency checkboxes, conditional advantage/disadvantage entries, tools, languages, and feature sources. Tools come from the configured active local import, filtered by Android's actual `ItemDao.getAllToolItems` categories (`T`, `AT`, `GS`, `INS`, including publication-qualified type strings). An IndexedDB cursor retains only tools rather than loading the full item corpus. Selected tools store their stable content reference and snapshot; legacy numeric tool values remain unchanged. Missing content does not block ordinary editing.

Languages are independent strings and display alongside legacy custom entries in the sheet. Feature sources support general features, spellcasting, or both; multiple associated abilities; custom attack/save values; and spellbook mode. Source renames update existing feature/spell/slot label references. Removing a linked source explicitly asks the user and retains its existing entities. Custom-only sources with both attack/save values display in the existing feature/spell views. All six pages share the same save/reopen flow. The conditional Spell Slots page remains the next iteration.

## Spell Slots implementation (2026-10-14)

The Spell Slots tab follows Feature Sources and appears when a named spellcasting source exists. It offers source, level (1–9), total and Short Rest / Short Rest +1 / Long Rest / Manual Only recovery. Entries are grouped by source and use the established bordered panels and total steppers. Adding matching source/level slots increases the total and preserves usage; a different recovery requires explicitly editing the existing row first. Existing entries can move between sources when the target has no conflicting level. Used slots remain session state and are not shown in the creator. Slots belonging to removed/noncasting sources remain stored. The web rest service now restores one slot for SHORT_REST_ONE, using the existing web policy on short/long rests. Features and Spells management pages remain the next iterations.

## Features editor implementation (2026-10-14)

User refinements: Source selection uses compact cards like the sheet, including per-ability attack/save values and custom overrides. Notes consist of named headings with individually addable/editable/removable entries; multiline text remains one entry rather than implicitly splitting into entries. Plain upstream description strings render directly without JSON quotation marks.

Further refinements: Description expands from a full-width 40px click target. Feature cards, settings sections, and inner note/use panels use distinct borders and surface tones. Note entries appear as tertiary chips, with inline Add/Edit text saved on Enter or blur, Shift+Enter for a newline, and Escape to cancel. Each note heading has an Editable on the character sheet checkbox. This flag persists independently of creator edits; unchecked headings remain configurable here but cannot be edited through the sheet's notes controls.

Feature management now lives inside the creator, rather than relying on compendium access from the finished character. The Features tab is always available after the conditional Spell Slots tab. It separates Class Features (including subclass features), Feats, and Optional Features, following Android's `FeatureManagementScreen` and `FeatureManagementViewModel` type/source separation.

Selected entries use compact expandable rows with source assignment, self-contained descriptions, note groups and multiple use trackers. Note labels/text and use labels/totals/recovery are editable; recovery uses the same four options as slots. Existing used counters are preserved when totals change, and an above-total counter is surfaced without resetting it. Current usage stays on the finished sheet, not in the creator. The sheet updates individual tracker objects, so duplicate editable labels do not make trackers share counters.

The local catalog offers type-specific search by name, class/subclass, level or publication, bounded to 30 results per page, description previews, and addition to a general feature source or Unassigned. Stable content keys include class/subclass qualifiers; duplicate additions are blocked for the same content/source. Selected entity data and exact revision metadata are stored with the character; the full library is not copied. Selected descriptions/notes/uses remain editable if the cache is missing. Custom features of each type can also be created locally. No class-level/prerequisite limits are imposed on manual selection.

Automated tests cover category/source identity, catalog pagination, notes/multiple trackers and counters across save/reopen, absent-cache editing, custom entries, and rest recovery. The Spells editor remains the next iteration; it is not included in this feature-management change.
