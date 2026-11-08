# TELAIO — Technical Architecture

## Current vehicle study
The scene is an SF-24-informed independent reconstruction using original procedural study geometry. Public reporting supports broad architectural cues only; all current surfaces and pickup coordinates remain ILLUSTRATIVE.

## Semantic component model
Each component has a stable ID independent of Three.js mesh names. A component may own multiple render meshes. The component record carries system, role, parent assembly, provenance, local position and deterministic explode vector. Engineering dependencies and conceptual interfaces are defined separately in `src/model/assembly.ts`.

## Geometry backends
- **Procedural study geometry:** current fallback, dimensionless and illustrative.
- **GLB asset backend:** planned interchange for original/licensed detailed meshes. See [Geometry Asset Pipeline](GEOMETRY_ASSET_PIPELINE.md).
- Geometry backend replacement must not change semantic component IDs or dependency records.

## Interaction contract
- Hover pre-highlights a component transiently; pointer exit restores its prior appearance.
- Click selects persistently and updates the inspector.
- Hide, isolate and exploded transforms operate on the semantic component group, not individual mesh names.
- Imported meshes must be grouped by manifest mapping to a component ID.

## Engineering data integrity
All unknown values remain explicitly unknown. A mesh scale does not establish physical dimensions. Conceptual interfaces are not validated mechanical constraints; no CAE or vehicle performance claim is made.

## Next
1. Integrate the validated GLB loader into the scene with recoverable fallback and lifecycle management.
2. Author and review an original/licensed segmented asset set; no unlicensed team CAD.
3. Complete mirrored front/rear suspension and steering/brake corner assemblies. All four corners, steering, spring-damper units and brake hydraulics are in place (Phase 10, part 1). Chassis structure, powertrain, cooling and diffuser followed in part 2; every component now has interface records. Phase 11 part 1 adds sections, measurement, coordinate frames, focus and saved states, with the maths in `src/model/cad.ts` kept independent of rendering. Next: Phase 11 part 2 (asset pipeline tooling, geometry revisions, constraint inspection).
4. Add coordinate frames, mating constraints and interference checks.
5. Introduce unit-aware engineering calculations with reproducible inputs.
