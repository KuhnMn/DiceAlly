# Source-derived parity cases

These are synthetic specifications derived from inspected Android code, not captures from an Android runtime and not official rules assertions. Entity names below are invented (`Test Fighter`, `Test Mage`, publication `TEST`); no upstream descriptions or personal characters are included. M3 should turn these into executable fixtures. Cases labeled correction/extension intentionally improve preservation beyond Android behavior.

## Deterministic Android baselines

| ID | Input / action | Expected output from observed Android code | Evidence |
| --- | --- | --- | --- |
| B01 | First class d10, level 3; CON 14; apply HP/dice | HP = 12 + 2*(6+2) = 28; generated d10 total 3; total level 3 | Creator 343-409 |
| B02 | Ordered classes d10 level 2 then d6 level 3; CON 14 | HP = 12+8+3*(4+2) = 38; level 5; d10 total 2, d6 total 3 | Same formula; first class gets full first die |
| B03 | Reverse B02 order | HP = 8+2*6+2*8 = 36; same total level/dice | Ordering is a real creation input |
| B04 | Class references invented F1 at level1, F3 at level3, F5 at level5; selected class level3 | F1/F3 granted; F5 absent; resolve publication + class + level | Creator 545-594 |
| B05 | Apply B04 twice with F1 note and used counter | No duplicate F1/F3; retained matching feature notes/uses | Creator backup and matching logic 343/573 |
| B06 | Full caster3 + half caster3 + artificer3 + third caster3 | Caster level = 3+1+2+1 = 7; slots [4,3,3,1], LONG_REST | Creator 859-886; SpellSlotProgression |
| B07 | Pact caster5 plus full caster3 | Separate pact pool 2 level3 slots SHORT_REST; regular [4,2] LONG_REST | Same sources and tables |
| B08 | Level2 pact caster | Observed Android table: 1 level1 slot; flagged for M3 policy review | SpellSlotProgression pactMagicProgression |
| B09 | HP20/temp5/max30; damage8 | HP17/temp0; healing100 -> HP30 | HealthManagementViewModel 37/47 |
| B10 | HP25, base max30; set max override18 | Override18/HP18; clear override -> max30, HP remains18 | HealthManagementViewModel 57 |
| B11 | Death saves set success9/failure-1 | Success3/failure0 | HealthManagementViewModel setDeathSaves |
| B12 | Short rest; resources used3 of5 for LONG, SHORT, SHORT_ONE, MANUAL | Used [3,0,2,3]; long rest -> [0,0,0,3] | CharacterCompendiumData recoverOnRest |
| B13 | Long rest: HP4/max override40; dice pools total3 used3 and total2 used2; temp7 | HP40; used dice2 and1; temp7 unchanged | Detail VM 550 (per-pool recovery) |
| B14 | Unarmored, DEX14, no shield/bonuses | Calculated AC12; with CON16 unarmored defense ->15 | calculateArmorClass 1410 |
| B15 | DEX14; medium armor AC14; shield AC2 | Calculated AC18 | Same armor/shield formula |

B06 describes Android's implemented contribution policy, not a guarantee of edition-specific correctness. For B14/B15 pass already eligible/equipped item inputs; separately test the calling filter for equip/attunement prerequisites.

## Preservation and web acceptance cases

| ID | Scenario | Required outcome | Milestones |
| --- | --- | --- | --- |
| W01 | Feature with same name/publication in different classes or levels | Distinct refs and grants; no name-only match | M2, M3 |
| W02 | Class removed or subclass replaced | Preview obsolete generated grants; manual features and shared grants survive | M3, M4 |
| W03 | Resource total5 used4 becomes total2 | Explicit conflict/adjustment preview; counters never silently reset | M3, M4 |
| W04 | Regenerate slots and dice after level-up | Preserve stable pool counters; new pools start unused | M3 |
| W05 | User suppresses a generated feature or overrides maxHP/DC | Subsequent application preserves suppression/override | M3, M4 |
| W06 | Species changes with existing manual fly speed and resistance | Replace old species contributions only; preserve manual values | M3, M4 |
| W07 | Full legacy export lacks classes/initiative/source revision | Sheet preserved; creation incomplete; explicit reconstruction before leveling | M4 |
| W08 | Minimal state file targets two identical items/monsters | Ask which instance; do not fabricate a complete character | M4, M7 |
| W09 | Rename source label; same source ID | Spell/feature grouping and linked actions remain connected | M3, M4 |
| W10 | Content reimport fails/cancels or references a missing base record | Prior active revision usable; failure/diagnostics visible | M2 |
| W11 | Check updates, import updates, then update one character | Each action explicit; other characters unchanged; accepted character retains notes/usage | M2, M4 |
| W12 | Two devices edit from revision7 | First save succeeds; second retains both versions and asks; overwrite compares latest revision | M5, M6 |
| W13 | Share same character twice; recipient already has its legacy UUID | Independent new IDs every time, intact internal links and snapshots | M7 |
| W14 | Signed-out/unapproved recipient redeems code | Denied server-side; active member succeeds only before expiry | M5, M7 |
| W15 | Offline edit, reload, reconnect after session expiry | Durable draft/outbox retained; reauthenticate before upload | M6 |
| W16 | Custom item with unknown raw fields and annotations | Selected snapshot survives export/share/cache purge and future migration | M2, M4, M7 |
| W17 | Inventory duplicates, multiple spell lists/casting sources, notes/action ordering | Independent instance state and link remapping survive round-trip | M4, M7 |

## Verification status

Source calculations B01-B03, B06-B15 were manually derived from the inspected arithmetic/branches. B04/B05 specify observed intent requiring executable validation. No Android emulator was launched; no recorded runtime fixture exists yet. In M3 compare against a locally captured Android example where available, retaining sanitized structural results rather than committing private characters or compendium text.

Known divergences needing explicit policy tests: Android vs web long rest; pact level2; unsupported expanded spell filters; malformed feature level defaulting to zero; class edits capping HP without considering override. Unresolved rule choices should be visible diagnostics, not silently guessed values.
