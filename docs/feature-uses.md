# Feature uses

`FeatureUsesComponent` in `src/app/sheet/feature-uses.component.ts` displays one
`FeatureUses` tracker from the portable character model. Sheet and editor callers
reuse it for features, spells and equipment.

## Inputs and updates

- `uses`: A `FeatureUses` value, or `undefined` for the empty state.
- `usesUpdated`: Emits `{ usedFreeUses: number; tag?: string }`. The parent applies
  this update to the corresponding tracker and handles persistence.

`totalFreeUses` defaults to one and `usedFreeUses` defaults to zero. Displayed use
counts and emitted updates are bounded between zero and the total. Trackers with
up to five uses show checkboxes; clicking one marks or clears the contiguous range
through that slot. Larger trackers show remaining-use controls. The progress bar
shows consumed uses.

The tracker uses the shared recovery indicator and theme tokens. An omitted regain
condition displays Long Rest, matching the rest service's existing recovery policy.
Zero-total trackers display an empty-state message.

## Related code

- `src/app/models/character.model.ts`: Persisted `FeatureUses` shape.
- `src/app/sheet/feature-uses.spec.ts`: Interaction and rendering coverage.
- `src/app/recovery-indicator.component.ts`: Shared recovery presentation.
- `src/app/services/rest.service.ts`: Recovery behavior.

Keep visual examples and field definitions in the implementation and tests; this
guide replaces the older separate usage and visual-reference documents.
