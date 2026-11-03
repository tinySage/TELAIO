# Visual Design Direction

## Chosen direction
**Motorsport CAD workstation × interactive 3D mechanical assembly simulator.**

The interface should take cues from professional CAD/CAE workstations: disciplined grids, dense but legible technical information, compact toolbars, precise selection states and a large modelling viewport. The vehicle and its mechanical structure—not dashboard cards—own the screen.

## Visual identity
- Main surfaces: graphite and charcoal, not pure black.
- Accent: restrained Rosso Corsa-inspired engineering red (proposed #E10600); this is a colour reference, not a claim of Ferrari affiliation.
- Secondary palette: steel grey, metallic silver and warm white.
- Typography: IBM Plex Sans for interface text; IBM Plex Mono for IDs, coordinates, units and numerical readouts.
- Icons: one consistent technical line-icon family.
- Borders: fine, low-contrast separators; avoid glowing outlines and decorative gradients.
- TELAIO has its own wordmark and visual identity. Do not reproduce Ferrari shields, team marks, sponsor logos or other protected brand assets.

## Layout principles
- Desktop-first workstation layout.
- Compact global header with project, vehicle and workspace context.
- Left dock: assembly tree, system filters and component hierarchy.
- Centre: dominant 3D viewport with camera, selection and view tools.
- Right dock: contextual properties, engineering data and component relationships.
- Bottom workspace: assembly sequence, load-path/engineering visualisation and analysis preview when relevant.
- Panels should be resizable/collapsible where useful; avoid nesting every control in a card.

## 3D presentation
Use an original or properly licensed, studio-lit vehicle model with physically based carbon fibre, painted bodywork, metal, rubber and brake materials. The initial vehicle is a reference study, not an official team CAD model. Support orbit, pan, zoom, orthographic views, fit-to-selection, isolate, hide/show, section/cutaway and exploded states. Maintain visual clarity for dark components.

## Interaction language
- Hover: subtle component pre-highlight and concise label.
- Selection: persistent red-accent outline or surface treatment plus inspector update.
- Multi-selection: clearly distinguish selected set.
- Component identity must be semantic and stable; render-mesh names are not the source of truth.
- Selecting a component updates the viewport, inspector, hierarchy and relationship view from the same selected-component state.
- Isolate/hide/show operate on the selected component and its actual geometry.
- Exploded view applies deterministic, reversible transforms to actual component instances; it is not a static exploded illustration.
- Assembly/disassembly respects component dependencies and interface constraints. Invalid placement must explain why it failed; valid placement provides a clear snap/confirmation state.
- Animation: purposeful, reversible, interruptible and reduced-motion aware.

## Engineering data integrity
Every numerical value shown in the product must carry a provenance classification:
- **SOURCED** — traceable to a cited source, dataset or supplied measurement.
- **DERIVED** — calculated from identified inputs and a visible equation/model.
- **ESTIMATED** — an approximation with method, assumptions and uncertainty/limitations stated.
- **ILLUSTRATIVE** — demonstration data used only to explain a UI or workflow; never presented as vehicle fact.
- **UNKNOWN** — not established; do not substitute a plausible-looking number.

Show units, assumptions, input values and source references close to the result. A chart must identify whether it shows measured, simulated, derived, estimated or illustrative data. Do not ship mockup numbers as factual engineering specifications. Clearly distinguish user-configured inputs from calculated outputs.

## Avoid
No neon gradients, purple/blue glow, oversized marketing headings, stacks of pill buttons, random floating panels, emoji icons, fake telemetry, fabricated specifications or perpetual decorative animation.

## Design approval
Approve one coherent high-fidelity workstation layout and its key interaction states before frontend implementation. Keep mockups consistent across Explorer, Inspector, Exploded View, Disassembly, Assembly and Engineering workspaces. The first implementation milestone must prove real component selection and geometry highlighting before expanding into advanced simulation.
