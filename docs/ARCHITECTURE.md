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
1. Deliver a validated GLB loader and schema-checked component manifest.
2. Replace illustrative bodywork with original/licensed segmented assets.
3. Complete mirrored front/rear suspension and steering/brake corner assemblies.
4. Add coordinate frames, mating constraints and interference checks.
5. Introduce unit-aware engineering calculations with reproducible inputs.
