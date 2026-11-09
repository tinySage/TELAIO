# TELAIO

**Formula Engineering Environment** — an independent browser-based 3D vehicle engineering workstation.

TELAIO explores vehicle assemblies, mechanical relationships and transparent engineering studies. The current reference is an SF-24-informed reconstruction based on public technical reporting and original procedural geometry. It is not affiliated with Ferrari, Scuderia Ferrari or Formula 1 and does not reproduce proprietary CAD.

## Current status

**All 18 roadmap phases implemented.**

- **Generation I (Phases 0–11): mechanical workstation.** An 89-component study vehicle with stable IDs, interfaces and dependency-aware assembly; section views, measurement, saved states; a validated glTF asset pipeline with integrity and revision checks.
- **Generation II (Phases 12–16): engineering laboratories.** Mass properties, suspension kinematics, braking, aerodynamics and vehicle dynamics with lap simulation. Every value carries provenance (SOURCED, DERIVED, ESTIMATED, ILLUSTRATIVE, UNKNOWN) and every result inherits its weakest input.
- **Generation III (Phases 17–18): platform.** Worker-based simulation jobs; sealed, re-runnable packages; engineering reports; an external FEA/CFD/thermal solver contract; versioned projects with provenance-aware diffs, audits, user-defined studies and review notes.

Everything starts UNKNOWN. Demo values are opt-in and labelled ILLUSTRATIVE. The study geometry is not to scale, and results that depend on it say so.

Current vehicle surfaces are illustrative study geometry. Scene coordinates are dimensionless; vehicle dimensions, masses, material grades, hardpoints and performance values remain unknown unless supported by traceable evidence.

## Run locally

Requires Node.js 22 or later.

```bash
npm install
npm run dev
```

Quality checks:

```bash
npm run typecheck
npm run build
npm test
npm run assets:check    # validate geometry assets
npm run assets:record   # record integrity after a deliberate, revision-bumped asset change
```

## Documentation
- [SF-24 reference reconstruction](docs/SF24_REFERENCE_RECONSTRUCTION.md)
- [Current vehicle geometry](docs/VEHICLE_GEOMETRY.md)
- [Geometry asset pipeline](docs/GEOMETRY_ASSET_PIPELINE.md)
- [Technical architecture](docs/ARCHITECTURE.md)
- [Product brief](docs/PRODUCT_BRIEF.md)
- [Visual design](docs/VISUAL_DESIGN.md)
- [Testing and acceptance](docs/TESTING.md)
- [Phase 9 brake corner assembly](docs/PHASE_9_BRAKE_ASSEMBLY.md)
- [Phase 10 full vehicle assembly](docs/PHASE_10_RUNNING_GEAR.md)
- [Phase 11 CAD interaction tools](docs/PHASE_11_CAD_INTERACTION.md)
- [Phase 12 mass properties](docs/PHASE_12_MASS_PROPERTIES.md)
- [Phase 13 suspension](docs/PHASE_13_SUSPENSION.md)
- [Phase 14 braking laboratory](docs/PHASE_14_BRAKING_LAB.md)
- [Phase 15 aerodynamics laboratory](docs/PHASE_15_AERO_LAB.md)
- [Phase 16 vehicle dynamics](docs/PHASE_16_VEHICLE_DYNAMICS.md)
- [Phase 17 simulation platform](docs/PHASE_17_SIMULATION_PLATFORM.md)
- [Phase 18 professional workflow](docs/PHASE_18_PROFESSIONAL_WORKFLOW.md)
- [Collaboration and access control design](docs/COLLABORATION_DESIGN.md)
- [External solver contract](docs/SOLVER_CONTRACT.md)

## Development policy
Work proceeds through feature branches and pull requests. The project owner reviews and merges each milestone. See [CONTRIBUTING.md](CONTRIBUTING.md).
