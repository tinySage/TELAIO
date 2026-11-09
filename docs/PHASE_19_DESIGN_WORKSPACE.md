# Phase 19: Design workspace (parametric CAD)

A **Design** view between Workbench and Analysis, with three tools that share one document (`telaio.design.v1`, captured in project revisions).

## Parametric hardpoint editing
- Suspension pickup points appear as handles on the ghosted car. Click one, then drag the axis arrows (study frame) or type x, y, z.
- Camber gain, bump steer, roll centre and motion ratio re-solve live with the same rigid-link solver as the Suspension lab.
- Edits write the Suspension lab's data (`telaio.suspension.v1`). Both views update through a storage event, so there is one source of truth.
- Results keep the hardpoint set's provenance. Dragging a point does not make it measured.

## Sketch-to-solid
- **Parameters** are named expressions (`nut_len = nut_r * 1.5`). Every sketch and feature dimension is an expression, so changing a parameter regenerates everything that depends on it.
- Expressions support `+ − * / ^`, parentheses, `pi`, and `sqrt abs min max sin cos tan` (degrees). Cycles, unknown names, duplicates and malformed input are reported per parameter, never turned into zero.
- **Features**: a rectangle, circle or polygon profile on the XY, YZ or ZX plane at an offset, which is then **extruded** (one-sided or symmetric) or **revolved** about the plane's u or v axis.
  - Planes are right-handed: XY (u=x, v=y), YZ (u=y, v=z), ZX (u=z, v=x).
  - Polygon points can be clicked on the sketch pad or typed as expressions.
- Area (shoelace), centroid and volume are exact: area × depth for an extrusion, Pappus's theorem for a revolution. Tests check them against the enclosed volume of the display mesh (divergence theorem).
- Crossing edges, zero area, a profile straddling the revolve axis, and non-positive dimensions are reported instead of drawn.
- Volumes are in su³. No material or mass is implied, and features do not enter the Mass lab.

## 2D drafting
- Side, top and front orthographic views of the car envelopes, the user solids and both sides of the suspension linkage, each on its own layer.
- Edges are boundary, crease (> 30°) and view-dependent silhouette edges. Hidden lines are **not** removed, and imported glTF assets are drawn as their procedural envelopes. The title block states both.
- **Tools:** select/pan, line (chained), and dimension (aligned, horizontal, vertical; third click places the line). Notes are added from the command line.
- **Snapping:** endpoint, then midpoint, then grid.
- **Command line:** `LINE 0,0 @1,0`, `DIM a b H|V|A [offset]`, `NOTE u,v text`, `UNDO`, `ERASE ALL`, `GRID 0.05|OFF`, `VIEW SIDE|TOP|FRONT`, `FIT`.
- Keys: Esc, Delete, Ctrl+Z. Annotations are stored per view. **Export SVG** downloads the sheet.

## Not done
- DXF/DWG exchange.
- Sketch constraints (coincident, tangent…).
- Booleans between solids.
- Fillets.
- Hidden-line removal.
