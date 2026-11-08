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
