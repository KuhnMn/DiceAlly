# Local Class Wizard

The Class Wizard button is available from every creator tab at `/dev/characters`. It opens an optional prefill workflow; ordinary editing and saving remain independent of class selection and the content library.

## Workflow

1. Select ordered classes, levels, matching subclasses and optionally a materialized species from the local import. The first class determines first-level HP and starting proficiencies. Source Books restricts catalog choices, without discarding selections already made.
2. Select the sections to prefill and answer proficiency, optional-feature and additional-spell choices. Class spell lists can populate Known through each class's available spell level. Wizard classes default to using a spellbook; this remains editable. Unsupported or incomplete options require explicitly choosing to finish them manually.
3. Review what will be filled, updated, removed or kept. Apply updates the draft atomically; Save persists it. Cancel does not apply selections.

## Prefill behavior

- Uses the existing qualified class-feature, level/slot, proficiency, optional-progression, species and additional-spell handlers. Subclasses must match the selected class and its source book.
- Fills character level, average maximum HP using current Constitution, hit dice, feature/casting sources, class/subclass and chosen optional features, proficiencies, known spell lists, granted spells, spell slots, and supported species movement/senses/resistances/languages.
- Multiclass slots are pooled under Shared Spellcasting; pact slots remain source-specific and recover on a short rest. Ordinary spell slots recover on a long rest. Limited daily/rest spell casts use the existing trackers and preparation lock.
- Each known, prepared and spellbook membership remains independent. Normal spellbook and preparation choices continue in the spell editor; the wizard does not automatically prepare the entire class spell list.
- First application preserves existing nondefault sheet values. Subsequent applications compare each value with its last generated baseline. Manual changes, manual deletions, unrelated records and annotated removed features remain protected. Session HP and used counters are never reset. Edited or still-linked sources remain available.
- Generated entities contain snapshots and exact content references. Wizard selections and their prefill baseline save with the character. Reopening prefers the original cached revision; using a different revision requires an explicit choice if the original is unavailable. Missing content does not prevent normal character editing.

## Limits and manual completion

The wizard is a convenience, not complete automation of all upstream mechanics. Descriptive tool choices, unsupported additional-spell structures and other unsupported options are surfaced for manual completion. Species ability-score options are left on Ability Scores. Optional-feature selection does not impose ongoing prerequisite restrictions on the free editor. The wizard does not assign equipment, enforce spell preparation limits, or automatically select every feat/ability-score improvement from feature descriptions.

## Validation

`class-wizard.spec.ts` covers ordered multiclass HP/proficiencies, exact subclass matching, pooled/pact slots, spell usage, species, repeat application, level changes, preserved manual values/deletions/annotations/counters, and save/reopen.

`scripts/class-wizard-acceptance.mjs` uses a source-derived synthetic local import in an isolated Chrome profile. It verifies all three steps at 320, 390, 768 and 1100px in both themes, plus apply/save/reopen and increasing level with manual HP, notes and used dice preserved. Results are in `class-wizard-acceptance-results.json`; the phone preview is `.angular/class-wizard-mobile.png`. Physical-device checks and broad real-content mechanic parity remain unverified.
