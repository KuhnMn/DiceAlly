# FeatureUses Component - Visual Reference

## Component Display

```
┌─────────────────────────────────────────────────┐
│ Uses          [2 / 4]                           │
├─────────────────────────────────────────────────┤
│ [████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░] │
│ [✓] 1  [✓] 2  [ ] 3  [ ] 4                      │
│ Regain: SHORT_REST                              │
└─────────────────────────────────────────────────┘
```

### States:

#### Full Uses (0 Used)
```
Uses          [0 / 3]
[░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░]
[ ] 1  [ ] 2  [ ] 3
Regain: LONG_REST
```

#### Partially Used (2 of 4)
```
Uses          [2 / 4]
[████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░]
[✓] 1  [✓] 2  [ ] 3  [ ] 4
Regain: SHORT_REST
```

#### Fully Used (4 of 4)
```
Uses          [4 / 4]
[████████████████████████████████████████████]
[✓] 1  [✓] 2  [✓] 3  [✓] 4
Regain: LONG_REST
```

### Interaction Example

**Initial State:**
```
Spell: Fireball
Uses:    [1 / 3]
[████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░]
[✓] 1  [ ] 2  [ ] 3
Regain: LONG_REST
```

**User Clicks Checkbox #2:**
```
Spell: Fireball
Uses:    [2 / 3]
[████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░]
[✓] 1  [✓] 2  [ ] 3
Regain: LONG_REST
```

**User Clicks Checkbox #2 Again (uncheck):**
```
Spell: Fireball
Uses:    [1 / 3]
[████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░]
[✓] 1  [ ] 2  [ ] 3
Regain: LONG_REST
```

## Integration Points

### In Spells Page
Displays below the spell's "At Higher Levels" section:

```
Spell Name                    [Level 3]  [Evocation]

Time: 1 action
Range: 150 feet
Components: V, S, M
Duration: Instant

[Description and mechanics...]

At Higher Levels
[Effect at higher levels...]

│ USES COMPONENT
│ ┌─────────────────────────────────────────────┐
│ │ Uses          [1 / 3]                       │
│ │ [████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░] │
│ │ [✓] 1  [ ] 2  [ ] 3                         │
│ │ Regain: LONG_REST                           │
│ └─────────────────────────────────────────────┘
```

### In Features Page
Displays below the feature's description:

```
Feature Name                                Type: CLASS_FEATURE

Source: Barbarian (XPHB)
[Description and mechanics...]

│ USES COMPONENT
│ ┌─────────────────────────────────────────────┐
│ │ Rage          [2 / 3]                       │
│ │ [████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░] │
│ │ [✓] 1  [✓] 2  [ ] 3                         │
│ │ Regain: SHORT_REST                          │
│ └─────────────────────────────────────────────┘
```

## Styling Details

### Progress Bar
- Background: `bg-gray-200` (light gray)
- Fill: `bg-sky-600` (blue)
- Height: `h-2` (8px)
- Smooth transition on updates

### Checkboxes
- Border: `border-gray-300`
- Text color: `text-gray-600`
- Checked state: `text-sky-600`
- Focus ring: `focus:ring-2 focus:ring-sky-500`

### Container
- Background: `bg-gray-50`
- Border: `border border-gray-200`
- Padding: `p-3`
- Rounded: `rounded-lg`

### Typography
- Title: `text-sm font-semibold text-gray-700`
- Counter: `text-xs text-gray-600`
- Regain text: `text-xs text-gray-500`
