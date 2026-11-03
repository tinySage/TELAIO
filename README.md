# TELAIO

**Formula Engineering Environment** — a browser-based interactive 3D vehicle engineering workstation.

TELAIO is an independent educational project exploring vehicle assemblies, mechanical relationships and transparent engineering studies. It is not affiliated with Ferrari, Scuderia Ferrari or Formula 1 and does not claim to reproduce proprietary vehicle CAD.

## Current status

**Phase 1 — Interactive foundation (in progress).** The initial prototype contains a parametric study assembly with semantic component IDs, 3D selection/highlighting, an assembly explorer, contextual inspector, hide/isolate controls and reversible exploded transforms.

The geometry is intentionally generic and illustrative. Vehicle-specific material, mass, dimensions and setup values remain unknown until supported by traceable sources or measured inputs.

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
- [Product brief](docs/PRODUCT_BRIEF.md)
- [Visual design](docs/VISUAL_DESIGN.md)
- [Workspaces](docs/WORKSPACES.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Testing and acceptance](docs/TESTING.md)
- [Phase 0 exit criteria](docs/PHASE_0_EXIT_CRITERIA.md)

## Development policy
Work proceeds through feature branches and pull requests. The project owner reviews and merges each milestone. See [CONTRIBUTING.md](CONTRIBUTING.md).
