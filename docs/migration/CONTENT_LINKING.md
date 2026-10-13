# Content reference linking

Milestone 2 linking step implemented in `content-linker.ts` and `content-dependencies.ts`. Links were introduced in adapter version 5; current version 6 also applies [audited copy semantics](COPY_SEMANTICS_AUDIT.md). Explicit reimport is required. No presentation projection is persisted.

## Linked references

| Reference | Scope | Behavior |
| --- | --- | --- |
| Fixed additional/attached spells | rule | Required; missing spells block activation |
| Explicit spell choices and expanded lists | catalog | Candidates must resolve; not automatically included in snapshots |
| Filter-based `choose`/`all` spell selectors | catalog | Deferred query retained; rules engine evaluates it later |
| Item-group members | catalog | Required; can target playable items or generic magic-variant definitions |
| Class/subclass feature lists | catalog | Required; select relevant levels in the future rules engine |
| Parent/definition/template references | provenance | Followed by default |
| Supported inline tags and structured feature entries | description | Optional; missing/ambiguous references warn |

Links retain their role, target, scope, resolution status, requirement flag and, where extracted, source field path and original reference. Raw fields remain intact, including spell grant levels, frequencies, choice counts and abilities. The linker identifies references; it does not apply character levels or evaluate selection filters.

The index resolves explicit publications without substituting editions. Spell UID suffixes such as `#c` are stripped for lookup and retained in the original reference. Generated items expose their variant publication as an alias; ambiguous generated candidates stay ambiguous. Generic item references can resolve to a magic-variant definition. Merged subraces expose upstream parenthetical names as aliases to the playable species.

Description traversal covers entries/templates, actions, bonus actions, reactions, traits, legendary/mythic/variant entries, spellcasting and header/footer entries. Supported tags include spells, items, creatures, races, feats, optional features, conditions, variant rules, tables, classes and class/subclass features. Other tag types remain in raw text for future rendering; this is not a complete upstream renderer.

## Selected dependency snapshots

`collectDependencies(cache, revisionId, roots, options)` returns detached records from one pinned revision. Traversal handles cycles and repeated roots, supports cancellation, and defaults to a limit of 1,000 records. Missing roots or required dependencies fail explicitly. Optional unresolved links are reported when followed.

Catalogues and descriptions are excluded by default. `includeDescriptions` follows description links, and a `follow` callback can choose individual catalogue links. Character creation must supply selected features/spells/items rather than treating every candidate as selected. The graph can include provenance definitions and their fixed grants; the later rules engine still determines which grants apply at the character's level. This helper is ready for character snapshot integration; persisted character creation and updates belong to later milestones.

## Validation

The full default-source probe passed at commit `8c026b807fac21862a309379a0c3228a0683198b`: 157 files, 21,629 records, 24,058,503 downloaded bytes and 47,375,420 serialized record bytes. All required references resolved. Adapter version 6 reports 100 nonblocking diagnostics: 37 earlier mapping warnings and 63 missing/ambiguous description references. Deferred selectors are expected inputs and do not create warning diagnostics.

Tests cover fixed grants, explicit choices, expanded lists, deferred queries, publication isolation, generic variant membership, ambiguous aliases, structured feature references, subrace aliases, removed/malformed grants, cycle handling, selection, detached snapshots, limits, cancellation and failed-import rollback. Real browser/mobile performance and semantic parity remain separate acceptance gates.
