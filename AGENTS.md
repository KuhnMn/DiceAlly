# Working preferences

## Keep verification proportional

- For small styling, spacing, label, or icon changes, use focused checks.
- Reserve full test suites and production builds for changes affecting behavior,
  data, persistence, dependencies, or build configuration.
- After relevant checks pass, stop unless a specific unresolved concern remains.
- Keep changes focused; avoid unrelated cleanup and refactoring.
- Report completion promptly and state what was actually verified.

## Code Structure

- Keep Code well structured and humanly readable where possible
- Provide well typed structures for data where possible
- Provide mappings (e.g. M -> Medium or "Abjuration" -> "Abj.") in one place so they can easily be reused
- Do not write redundand code and reuse components where possible
- Provide folder structures to separate components if useful

## UI style

- Follow Existing Components: Compact, clearly grouped content with a
  strong label/value hierarchy, aligned baselines, and consistent spacing.
- Use subtle themed surfaces to group related details. Show short qualifiers as small badges; place longer conditions beneath their value as muted notes with an accent line, rather than a chain of parentheses.
- Use the shared SVG icons instead of emojis. Give unfamiliar icons a tooltip and accessible label; use the app's existing color tokens.
- Reuse existing component styles exactly for equivalent controls. Keep badge dimensions stable while editing, and place reset/extra-detail controls consistently.
- Preserve readable wrapping on mobile and desktop. Keep supporting information visibly connected to the value it describes without crowding the main row.
- Provide separate designs for desktop and mobile where necessary

# Extra

- Capitalize words at the beginnings of sections, after : and in enumerations
- When looking for features to implement in the data, look mainly for data from the sources XDMG, XPHB, XMM, EFA, and MPMM and maybe TCE and XGE. Other books are more optional. It is still fine to look in them for examples, but it should be lower priority. Schema is king though and should be the ground truth
