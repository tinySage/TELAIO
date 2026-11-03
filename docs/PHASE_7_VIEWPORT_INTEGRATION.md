# Phase 7 — Viewport asset integration

The viewport now reads `/geometry/manifest.json`, validates it with the Phase 6 schema, loads each declared GLB component and renders imported geometry inside its semantic component group. If the manifest is absent, invalid or has no entries, the procedural study geometry remains active and the runtime status reports the reason.

## Add an asset
1. Place an original or licensed GLB under `public/geometry/`.
2. Add a manifest entry using an existing stable component ID and exact GLTF node names.
3. Include units, coordinate frame, provenance, source record, licence/permission and asset revision.
4. Run typecheck/build, then browser QA for orientation, scale, selection, hover, hide/isolate, explode and disposal.

No model asset is included in this integration change. The committed manifest intentionally has zero entries; it is a valid empty manifest that exercises the procedural fallback path.
