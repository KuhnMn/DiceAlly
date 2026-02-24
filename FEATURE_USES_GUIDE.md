# FeatureUses Component - Usage Guide

## Overview
The `FeatureUsesComponent` is a reusable component for tracking uses of abilities, spells, and features. It displays checkboxes that allow users to mark how many uses have been consumed.

## Component Features
- **Visual Progress Bar**: Shows the ratio of used to total uses
- **Checkbox Tracking**: Interactive checkboxes for each available use slot
- **Regain Condition Display**: Shows when uses are regained (e.g., "LONG_REST")
- **Two-Way Updates**: Changes are emitted back to the parent component

## Usage

### In Spells Page
```typescript
@if (spell.uses?.length) {
  <div class="mt-4 border-t border-gray-200 pt-4">
    @for (use of spell.uses; track use.tag) {
      <app-feature-uses 
        [uses]="use"
        (usesUpdated)="updateSpellUses(spell, $event)"
      />
    }
  </div>
}
```

### In Features Page
```typescript
@if (feature.uses?.length) {
  <div class="mt-4 border-t border-gray-200 pt-4">
    @for (use of feature.uses; track use.tag) {
      <app-feature-uses 
        [uses]="use"
        (usesUpdated)="updateFeatureUses(feature, $event)"
      />
    }
  </div>
}
```

## Component Inputs
- `uses`: Required input of type `FeatureUses | undefined`

## Component Outputs
- `usesUpdated`: Emits an object with:
  - `usedFreeUses`: Number of uses currently marked as used
  - `tag`: Optional tag/identifier for the use entry

## Update Methods
Each parent component should implement an update method:

```typescript
updateSpellUses(spell: any, event: { usedFreeUses: number; tag?: string }) {
  if (spell.uses) {
    const useEntry = spell.uses.find((u: any) => u.tag === event.tag);
    if (useEntry) {
      useEntry.usedFreeUses = event.usedFreeUses;
    }
  }
}
```

## FeatureUses Model
```typescript
export interface FeatureUses {
  tag?: string;                        // Identifier for the use entry
  totalFreeUses?: number;              // Total number of uses available
  usedFreeUses?: number | 0;           // Number of uses currently consumed
  freeUsesRegainCondition?: string;    // When uses refresh (e.g., "LONG_REST")
  userAdded?: boolean;                 // Whether user-added or from source
}
```

## How It Works

1. **Display Logic**: Shows X checkboxes where X = totalFreeUses
2. **Checkbox State**: Checkboxes are filled up to usedFreeUses count
3. **Interaction**:
   - Clicking an unchecked box marks all boxes up to and including it
   - Clicking a checked box unchecks it and all boxes after it
4. **Persistence**: Parent component updates the model on (usesUpdated) event

## Example Data Flow

```
Feature/Spell (SpellEntryFull or FeatureEntryFull)
  └── uses: FeatureUses[]
        └── { tag: "action surges", totalFreeUses: 4, usedFreeUses: 1, freeUsesRegainCondition: "SHORT_REST" }

User clicks checkbox #2 (unchecked)
  → Component emits: { usedFreeUses: 2, tag: "action surges" }
  → Parent updates: useEntry.usedFreeUses = 2
  → Model reflected in component
```

## Files Modified
- `src/app/sheet/feature-uses.component.ts` - New component
- `src/app/sheet/spells-page.component.ts` - Added FeatureUses integration
- `src/app/sheet/features-page.component.ts` - Added FeatureUses integration

## Future Enhancements
- Equipment page integration
- Refund/reset button
- Undo/redo functionality
- Bulk tracking UI
