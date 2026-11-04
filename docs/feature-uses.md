# Feature uses

FeatureUsesComponent displays a portable FeatureUses tracker. Features, species,
spells, equipment and companions reuse the same component and model.

## Data model

Feature trackers and source resources both store a complete total: UsesTotal
and a separate used: number counter:

```ts
{ total: { kind: 'fixed', value: 7 }, used: 2 }
{ total: { kind: 'ability-modifier', ability: 'wisdom' }, used: 2 }
{ total: { kind: 'proficiency-bonus', multiplier: 0.5 }, used: 1 }
```

The fixed value and PB multiplier are required in their respective variants.
ProficiencyMultiplier permits 0.5 through 4 in steps of 0.5. PB products are
rounded down. Ability modifiers use the owning character's current ability score,
with a minimum of zero; PB uses the current character level.

Both editors offer Fixed Value, Proficiency Bonus and Ability Modifier. The Total
field becomes a Stat or PB Multiplier selector as appropriate. Switching kinds
preserves spent uses; inactive choices are remembered only during that editing
session, keeping the saved definition self-contained.

## Compatibility

portableCharacter converts old totalFreeUses, usedFreeUses, numeric resource
totals and separate totalCalculation objects on a detached copy before validation.
Missing legacy feature totals default to one, missing consumption to zero, and
legacy PB calculations without a multiplier to one. Saved and exported documents
contain only the canonical fields. Migration is idempotent and preserves resource
wizard fingerprints when the generated definition has not been manually edited.
Native document projections use the same conversion for retained legacy entries.

## Inputs and updates

- uses: A FeatureUses value, or undefined for the empty state.
- character: The owning character for dynamic totals.
- usesUpdated: Emits { used: number; tag?: string }. The parent applies the
  update and handles persistence.

Displayed counts and emitted updates are bounded between zero and the resolved
total. Trackers with up to four uses show checkboxes; clicking one marks or clears
the contiguous range through that slot. Larger trackers show remaining-use
controls. The progress bar shows consumed uses. A reduced maximum never resets
the stored consumption. Zero-total trackers display an empty-state message.

The tracker uses the shared recovery indicator and theme tokens. An omitted regain
condition displays Long Rest, matching the rest service's recovery policy.
