# Visual Design Direction

## Chosen direction
**Motorsport CAD workstation × interactive 3D mechanical assembly simulator.**

The interface should take cues from professional CAD/CAE workstations: disciplined grids, dense but legible technical information, compact toolbars, precise selection states and a large modelling viewport. The vehicle and its mechanical structure—not dashboard cards—own the screen.

## Visual identity
- Main surfaces: graphite and charcoal, not pure black.
- Accent: restrained Ferrari-inspired Rosso Corsa red (#E10600 proposed).
- Secondary palette: steel grey, metallic silver and warm white.
- Typography: IBM Plex Sans for interface text; IBM Plex Mono for IDs, coordinates, units and numerical readouts.
- Icons: one consistent technical line-icon family.
- Borders: fine, low-contrast separators; avoid glowing outlines and decorative gradients.

## Layout principles
- Desktop-first workstation layout.
- Compact global header with project, vehicle and workspace context.
- Left dock: assembly tree, system filters and component hierarchy.
- Centre: dominant 3D viewport with camera, selection and view tools.
- Right dock: contextual properties, engineering data and component relationships.
- Bottom strip: selection details, command feedback or task progress when relevant.
- Panels should be resizable/collapsible where useful; avoid nesting every control in a card.

## 3D presentation
Use a studio-lit, physically based vehicle render with credible carbon fibre, painted bodywork, metal, rubber and brake materials. Support orbit, pan, zoom, orthographic views, fit-to-selection, isolate, hide/show, section/cutaway and exploded states. Maintain visual clarity for dark components.

## Interaction language
- Hover: subtle component pre-highlight and concise label.
- Selection: persistent red-accent outline or surface treatment plus inspector update.
- Multi-selection: clearly distinguish selected set.
- Invalid assembly placement: explicit message and non-colour-only warning.
- Valid placement: restrained snap/confirmation feedback.
- Animation: purposeful, reversible, interruptible and reduced-motion aware.

## Avoid
No neon gradients, purple/blue glow, oversized marketing headings, stacks of pill buttons, random floating panels, emoji icons, fake telemetry, fabricated specifications or perpetual decorative animation.

## Design approval
Approve one coherent high-fidelity workstation layout and its key interaction states before frontend implementation. Keep mockups consistent across Explorer, Inspector, Exploded View, Disassembly, Assembly and Engineering workspaces.
