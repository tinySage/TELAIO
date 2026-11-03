# Phase 8 — First brake asset

Status: implementation in progress.

The first imported geometry target is the existing `brake-disc` semantic component. The asset will be original TELAIO-authored study geometry, not Ferrari CAD and not a claim of SF-24 dimensional accuracy.

## Engineering integrity

- Geometry provenance: ILLUSTRATIVE.
- Units: UNKNOWN; no physical dimensions are asserted.
- Coordinate frame: right-handed local study frame.
- Source: original repository-authored geometry.
- Licence: original work created for this repository.

## Acceptance criteria

- A GLB asset loads through the existing manifest pipeline and maps to `brake-disc`.
- Rotor friction annulus, vent features, centre hat and mounting pattern are represented as inspectable geometry.
- Imported geometry supports hover pre-highlight and persistent selection.
- Failed or cancelled parallel loads dispose all cloned resources without disposing loader-owned shared resources.
- Empty or invalid asset configuration preserves procedural fallback.
- Typecheck and production build pass.

## Limitations

This is a geometry-pipeline and interaction milestone, not a validated brake design. No rotor material, thermal capacity, mass, dimensions, ventilation performance, or SF-24-specific specification is implied.