# TELAIO

**Formula Engineering Environment** — an independent browser-based 3D vehicle engineering workstation.

TELAIO explores vehicle assemblies, mechanical relationships and transparent engineering studies. The current reference is an SF-24-informed reconstruction based on public technical reporting and original procedural geometry. It is not affiliated with Ferrari, Scuderia Ferrari or Formula 1 and does not reproduce proprietary CAD.

## Current status

**Phase 7 complete; Phase 8 in progress.** The prototype includes a semantic assembly model, interactive 3D selection and hover pre-highlighting, component inspection, hide/isolate controls, dependency-aware assembly/disassembly, reversible exploded transforms and a validated glTF/GLB runtime loader with procedural fallback. The first imported asset is an original, illustrative ventilated brake-rotor study geometry; its units and physical dimensions are intentionally unknown.

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
```

## Documentation
- [SF-24 reference reconstruction](docs/SF24_REFERENCE_RECONSTRUCTION.md)
- [Current vehicle geometry](docs/VEHICLE_GEOMETRY.md)
- [Geometry asset pipeline](docs/GEOMETRY_ASSET_PIPELINE.md)
- [Technical architecture](docs/ARCHITECTURE.md)
- [Product brief](docs/PRODUCT_BRIEF.md)
- [Visual design](docs/VISUAL_DESIGN.md)
- [Testing and acceptance](docs/TESTING.md)

## Development policy
Work proceeds through feature branches and pull requests. The project owner reviews and merges each milestone. See [CONTRIBUTING.md](CONTRIBUTING.md).
