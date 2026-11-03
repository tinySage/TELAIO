# Generic Vehicle Geometry — Study Asset Specification

## Intent
A selectable, explodable, generic formula-style vehicle envelope exercises TELAIO's component hierarchy and inspection workflow. It is not a reference for a specific season, team, chassis or technical regulation.

## Component inventory
- Central monocoque study body and underfloor reference
- Nose and front-wing reference volumes
- Left/right sidepod envelopes
- Power-unit cover envelope and rear-wing reference
- Front upright, upper/lower wishbone study links, push-rod and brake-disc reference
- Four wheel/tyre envelopes

All parts are original procedural study geometry authored for TELAIO. Their provenance is ILLUSTRATIVE. Material, dimensions and mass remain unknown.

## Coordinates and units
Coordinates are dimensionless scene coordinates. They are not metres, millimetres or sourced vehicle dimensions. The interface labels the scene as a study coordinate frame, not SI measurements.

## Geometry limitations
The primitive envelope does not model surface curvature, detailed aerodynamic profiles, fasteners, steering, rear suspension, brakes at all corners, cooling paths or internal powertrain architecture. No aerodynamic, structural or vehicle performance can be inferred.

## Acceptance criteria
- Every visible component is selected by stable semantic ID.
- Selecting a component updates the inspector and viewport highlight.
- Hiding/removing a component affects its actual geometry.
- Explode offsets move each component as a rigid group.
- The generic study model is not presented as official team CAD.
