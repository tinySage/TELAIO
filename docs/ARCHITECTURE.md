# TELAIO — Technical Architecture

## Phase 1 scope
The first implementation is a browser-only interactive foundation. It deliberately uses a small, original, parametric study assembly rather than implying access to an official Formula 1 CAD model.

## Stack
- React + TypeScript + Vite for the application shell.
- Three.js through React Three Fiber for scene rendering.
- Drei for orbit controls, contact shadows and orientation gizmo.
- Lucide React for consistent interface icons.
- Static typed component metadata in the first milestone.

## State model
The selected component ID is the canonical selection state. The assembly tree, viewport highlight and inspector derive from that ID. Visibility, isolation and explode amount are separate view state:
- `selectedId: string`
- `hiddenIds: string[]`
- `isolatedId: string | null`
- `explode: number` in the inclusive range [0, 1]

Component IDs are semantic identifiers, not Three.js mesh names. Render geometry is a view of the component record.

## Geometry strategy
Phase 1 uses simple parametric geometry to validate interaction contracts. It is not dimensionally accurate vehicle CAD. The next asset milestone should introduce a modular glTF/GLB assembly with stable component IDs, local coordinate frames, parent-child hierarchy, interfaces and source/licence metadata.

## Engineering data integrity
Unknown engineering quantities remain unknown. The UI must not infer material, mass, dimensions, spring rate or vehicle setup from the appearance of generic geometry. Any future numerical result must record provenance, units, input values, method/model version and limitations.

## Planned evolution
1. Replace parametric study geometry with an original/licensed segmented model.
2. Add a shared scene/assembly data schema and validated interfaces.
3. Add dependency-aware disassembly and reversible assembly operations.
4. Add isolated engineering modules with reproducible, unit-aware calculations.
5. Add persisted projects and server-side services only when the product requires them.

## Non-goals
This prototype is not a certified CAD/CAE package, production race simulator, CFD/FEA solver or exact reproduction of a real team's vehicle.
