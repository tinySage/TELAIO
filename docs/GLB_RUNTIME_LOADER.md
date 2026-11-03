# TELAIO GLB Runtime Loader

## Phase 6 scope
This phase adds a runtime boundary for original or licensed GLB component assets. It does not add a vehicle asset or change the current procedural scene by itself.

## Manifest validation
`src/model/geometryAssets.ts` validates schema version, stable component IDs, duplicate entries, node mappings, coordinate-frame handedness, explicit units, provenance, source record, licence/permission and immutable asset revision. Unknown physical units remain `UNKNOWN`; no automatic scale conversion is performed.

## Runtime loader
`src/scene/loadGeometryAsset.ts` loads a component GLB asynchronously with byte progress, maps only the manifest-declared node names, clones geometry and materials for component-level styling, validates finite vertex coordinates and index bounds, and returns mesh/triangle counts and a bounding box. A component with no matching nodes or invalid geometry fails explicitly.

Callers own fallback UI and must retain procedural geometry until a replacement asset has loaded and passed validation. Swap only after success; dispose the previous asset with `disposeComponentAsset`. The loader does not infer engineering dimensions from a GLB's scale.

## Integration contract
- Validate the complete manifest before starting any asset requests.
- Match each entry to a stable component ID; never use a render-node name as engineering identity.
- Apply component transforms at the semantic group level.
- Keep asset units and coordinate frame visible in engineering metadata.
- Treat missing assets, load failures and validation errors as recoverable; keep the procedural study fallback visible.
- Review the licence/permission record before importing any third-party asset.
- Perform browser visual QA for orientation, scale, normals, materials, interaction and disposal before replacing study geometry.

## Current limitation
No detailed SF-24 CAD or production-ready vehicle GLB is included. Current scene geometry remains illustrative and dimensionless. The loader is infrastructure, not a claim of vehicle fidelity.
