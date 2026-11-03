# TELAIO Geometry Asset Pipeline

## Purpose
Move from hand-authored study primitives to replaceable, component-addressable geometry without coupling engineering identity to mesh names or a particular DCC tool.

## Phase 5 contract
- Authoring interchange: glTF 2.0 / GLB for browser delivery.
- One semantic component may own one or more render meshes.
- Every imported mesh maps through a manifest to a stable TELAIO component ID.
- Mesh node names are descriptive metadata only; never use them as database or selection identity.
- Preserve local transforms and parent-child relationships. The assembly model remains the source of engineering dependencies.
- Geometry is unit-tagged in the manifest. Unknown units must remain UNKNOWN; do not silently interpret dimensionless study coordinates as metres or millimetres.
- Keep source reference, licence/permission, authoring tool/version, export date, revision and provenance with each asset package.
- No external asset may enter the production scene without an explicit licence review.

## Manifest schema (v1)
A manifest entry should contain:
- `componentId`: stable ID matching `src/model/components.ts`.
- `assetUri`: relative GLB path.
- `nodeNames`: one or more GLTF node/mesh names mapped to that component.
- `system` and `parentComponentId`: semantic assembly placement.
- `coordinateFrame`: named frame and handedness.
- `units`: explicit length unit or `UNKNOWN`.
- `provenance`: SOURCED, DERIVED, ESTIMATED, ILLUSTRATIVE or UNKNOWN.
- `source`: URL or internal authoring record; include access date.
- `licence`: SPDX identifier or documented permission; never assume.
- `revision`: immutable asset revision identifier.

## Runtime loading requirements
1. Load GLB asynchronously with progress and a recoverable error state.
2. Validate manifest schema and component IDs before attaching geometry.
3. Clone materials before per-instance highlighting to avoid changing sibling parts.
4. Preserve a component-level group for selection, visibility, isolation and exploded transforms.
5. Dispose replaced geometries, materials and textures when unloading an asset.
6. Fall back to the current procedural study geometry if an asset is absent or invalid.
7. Do not report an imported asset as dimensionally verified merely because it has a scale.

## Geometry QA
- Check non-empty meshes, finite vertex coordinates and valid indices.
- Check bounding boxes and coordinate frame metadata.
- Report open boundaries/non-manifold conditions where tooling permits.
- Record triangle count, mesh count and file size.
- Compare exported preview against approved reference views.
- Record known deviations and unresolved surfaces.

## Current status
The application still renders procedural illustrative geometry. This phase adds hover pre-highlighting and defines the import/manifest contract; it does not claim that an SF-24 GLB or photorealistic CAD model exists yet.
