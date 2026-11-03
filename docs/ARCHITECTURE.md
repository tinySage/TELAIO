# TELAIO — Technical Architecture

## Phase 2: assembly model
The application separates stable component identity from render geometry and connection metadata.

### Component identity
Every component uses a semantic ID independent of Three.js mesh names. Multiple render meshes can belong to one component and selection remains at the component level.

### Interfaces and dependencies
`src/model/assembly.ts` defines interface records with stable IDs, owner and target component IDs, a conceptual connection type and a definition status. Dependencies are declared separately and can be used by later assembly/disassembly workflows.

Current interfaces are **CONCEPTUAL**. They do not assert verified pickup coordinates, tolerances, joint constraints or real vehicle architecture. The model validator checks referential integrity only; it is not a mechanical constraint solver.

### Geometry and exploded transforms
Rod components can contain multiple endpoint-defined segments. Every segment receives the same component explode vector, preserving the component's internal geometry during an exploded view. Geometry remains generic study geometry, not a dimensionally accurate vehicle CAD model.

## Engineering data integrity
Vehicle-specific materials, masses, dimensions and setup values remain UNKNOWN until supported by traceable sources or measurements. Conceptual interface records are not engineering specifications.

## Next milestones
1. Import an original/licensed segmented GLB with a stable component manifest.
2. Add local coordinate frames and interface transforms.
3. Implement dependency-aware removal, restoration and assembly validation.
4. Add unit-aware engineering calculations with reproducible input records.
5. Add browser-level interaction tests and visual regression checks.

## Non-goals
TELAIO is not a certified CAD/CAE package, production race simulator, CFD/FEA solver or exact reproduction of a real team's vehicle.
