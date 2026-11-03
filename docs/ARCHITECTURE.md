# TELAIO — Technical Architecture

## Phase 4: modular vehicle study geometry
The vehicle scene is expanded from a single suspension corner into a generic formula-style vehicle envelope assembled from independently selectable semantic components.

### Component schema
Each component has a stable ID, system, role, parent assembly label, provenance, local position, deterministic explode vector, primitive geometry type and optional primitive size. Rods are multi-segment endpoint geometry. Render geometry is not used as component identity.

### Current geometry coverage
- Chassis/structure: central body, nose reference.
- Aerodynamics: floor reference, front/rear wing envelopes, left/right sidepod envelopes.
- Powertrain: engine-cover envelope only; no engine or hybrid internals.
- Front suspension: upright, upper/lower wishbone study links, push-rod and brake disc.
- Wheels/tyres: four wheel/tyre envelopes.

All geometry is original procedural study geometry authored for TELAIO. It is deliberately generic, not a reproduction of an identifiable team's car or a dimensionally accurate CAD model. Material, dimensions, mass and performance values remain unknown.

### Transform contract
Each semantic component owns its position and explode vector. Primitive geometry is generated within its local component frame. Explode applies a single translation to the component group; multi-segment links receive the same translation for every segment.

### Limitations
The current primitive envelope does not model surface curvature, detailed aero profiles, fasteners, steering, rear suspension, brakes at all corners, cooling paths or internal powertrain architecture. No aerodynamic or structural performance can be inferred from this geometry.

## Next
1. Replace envelope primitives with original/licensed segmented GLB assets and a manifest.
2. Add full front/rear suspension assemblies and interface coordinate frames.
3. Add assembly constraint/mating solver and interference checks.
4. Add validated unit-aware engineering modules.
