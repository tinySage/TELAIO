# Phase 11, part 1 — CAD interaction tools

Interaction tools for inspecting the 87-component assembly. The maths lives in `src/model/cad.ts` and `src/model/viewStates.ts`, independent of rendering; the scene only converts between the vehicle study frame and world space.

## Study frame and units

All tools work in the vehicle study frame: **x forward, y up, z left**, origin at the scene origin. Scene coordinates are dimensionless. Every measured value is labelled *study units* and never presented as millimetres or any physical unit (integrity rule 1).

## Tools

| Tool | How | Notes |
| --- | --- | --- |
| Collapsible explorer | Click a system to expand; counts show installed/total | Search matches name, system or ID and expands matching systems. Removed parts are tagged OUT; hidden parts show an eye icon. Selecting in the viewport expands that part's system. |
| Section view | Scissors button; choose X/Y/Z, drag the offset, Flip to keep the other side | One clipping plane in the vehicle frame, shown as a red outline. Picks on the cut-away side pass through to visible geometry behind. Default is a centreline (z = 0) cut. |
| Measure | Ruler button; Distance (2 points) or Angle (3 points, vertex second) | Picks on visible surfaces. Distance shows Δx/Δy/Δz. A new click after a complete measurement starts a fresh one. Esc exits. |
| Coordinate frames | Axes button | Large axes at the study-frame origin; small axes at the selected part's anchor, in its own orientation. |
| Focus | Focus button or F | Moves the orbit target to the selected part and brings the camera in along the current viewing direction. |
| Saved states | Name and Save in the Saved States panel; click a row to restore | Stores explode, hidden parts, isolation, installed set and section in this browser. Stored data is validated on load: unknown IDs are dropped with a warning, and a state whose installed set breaks prerequisite rules is refused. Camera pose is not saved. |

## Acceptance

Roadmap: *engineers can inspect and manipulate a mechanical assembly without relying on decorative or hardcoded visual behaviour.*

Automated (`src/model/cad.test.ts`, 12 tests; 37 total):

- [x] Section planes keep the correct side, flip, clamp to range; a centreline cut keeps exactly the left-hand corners.
- [x] Distance and angle are correct, including degenerate angles; values are in study units only.
- [x] Front track between wheel centres measures 1.920 study units.
- [x] Saved states round-trip, drop unknown IDs and out-of-range values with warnings, and refuse invalid installed sets.

Browser (headless Chrome, production build): explorer opens with one system expanded and search finds all 8 calipers; z and x sections render with the marker; a two-point measurement reads in study units with deltas and Esc clears it; frames and focus work; a saved state survives a reload and restores; a tampered invalid state is refused with the reason.

## Limitations

- Focus keeps the current viewing direction, so a near-side wheel can hide the focused part; hide the wheel or orbit.
- One section plane at a time; cut faces are not capped.
- Measurement picks surfaces only. There is no snapping to edges, vertices or hardpoints yet.
- Saved states live in browser storage and are not shared or versioned. Project-level storage belongs to Phase 18.

## Part 2

Asset pipeline tooling (repeatable validation, conversion, versioning, geometry checks), geometry replacement and revision management, and interface/constraint inspection.

# Phase 11, part 2 — Asset pipeline, geometry revisions and interface inspection

## Asset pipeline

`npm run assets:check` validates every geometry asset in the manifest, independent of three.js. It also runs in CI.

- Manifest schema (existing validator).
- glTF 2.0 structure: version, meshes present, manifest node names exist in the file.
- Buffers resolve (embedded `data:` or external relative files) and are as long as declared.
- Buffer views and accessors stay within their ranges, including byte strides.
- Every POSITION accessor declares min/max, and they match the actual vertex data.
- Vertex coordinates are finite; indices stay below the vertex count; triangle lists are multiples of 3.
- Report per asset: meshes, primitives, triangles, vertices, extent in asset units, SHA-256.

Binary `.glb` files are reported as unsupported by the checker for now.

### Revisions and integrity

Each manifest entry carries `integrity: { sha256, revision }`, written by `npm run assets:record`. The check enforces:

| Situation | Result |
| --- | --- |
| File matches the recorded hash and revision | Pass |
| No integrity record | Fail: run `assets:record` |
| File changed, revision unchanged | Fail: bump the revision first; `assets:record` refuses too |
| File changed, revision bumped | Fail until `assets:record` records the new geometry |
| Revision bumped, file unchanged | Fail: record it or revert the revision |

So geometry cannot change silently: every content change needs a revision bump and a recorded hash, both visible in review.

## Geometry in the inspector

The Component tab shows each part's geometry source. For imported assets it lists the file, revision, integrity hash and the revision it was recorded for, units, provenance, mesh and triangle counts and extent as loaded, and the licence record. **Compare with procedural envelope** swaps an imported part back to its procedural envelope in the viewport (geometry replacement for comparison) and back again.

## Interface inspection

- The Relations tab lists interfaces declared *by* the part and *onto* it, each with its type colour. Clicking a row selects the other part; hovering highlights it. Rows for hidden or removed parts are dimmed.
- The **links** toolbar button draws a line from the selected part to every visible related part, coloured by type (mount, pivot, coaxial, contact; conceptual dashed), drawn through occluding geometry, with a legend and a visible/total count.
- The link maths (`interfaceLinks`, `partAnchor`) lives in `src/model/cad.ts`.

## Tooling

Tests and scripts now typecheck under their own Node-typed project (`tsconfig.node.json`), and the browser app's config stays DOM-only.

## Acceptance

- [x] `src/model/assetChecks.test.ts` (10 tests): the committed rotor passes with 2,712 triangles and correct bounds; corrupted variants fail (wrong version, missing node, out-of-range view, mismatched bounds, bad indices, partial triangles, unresolved buffers); integrity verdicts cover all revision cases; every manifest entry matches the committed file.
- [x] Interface tests (3): both directions, link count and anchors, visibility filter. 50 tests total.
- [x] CLI: editing the rotor without a revision bump fails both `assets:check` and `assets:record`.
- [x] Browser: inspector shows the rotor's asset, revision, integrity and 2,712 triangles, matching the CLI; the procedural comparison toggle works; the caliper shows 3 outgoing and 2 incoming interfaces; links render with legend; clicking a relation selects the master cylinder.

## Not yet

- `.glb` support in the checker; automated conversion from CAD exchange formats (STEP etc.) needs an external toolchain.
- Interfaces are still `CONCEPTUAL`; constraint geometry (axes, points, planes) arrives with the suspension and brake labs, where it is needed for calculation.
