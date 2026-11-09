# Phase 17 — Engineering simulation platform

The **Simulation** view turns lab studies into managed, reproducible jobs. The roadmap's warning, "we shouldn't pretend a Three.js scene is a physics solver", sets the scope: TELAIO runs its own analytical and numerical models properly, and connects to real FEA, CFD and thermal solvers through a traceable contract instead of imitating them.

## Solvers (`src/sim/solvers.ts`)

| Solver | Model | Version |
| --- | --- | --- |
| `braking-study` | Phase 14 braking with bias and speed sweeps and sensitivity | 1.0.0 |
| `lap-simulation` | Phase 16 lap and performance metrics | 1.0.0 |
| `lap-parameter-sweep` | Phase 16 lap time over one input, with the edge-of-range flag | 1.0.0 |
| `suspension-sweep` | Phase 13 kinematics and rates, with the closure error reported | 1.0.0 |

Each solver is a pure function from JSON to JSON. The worker, the tests and package verification all call the same `runSolver`, so a re-run is the same code path as the original run.

## Jobs

- Inputs are **snapshotted from the lab at submission**, so later edits in a lab don't change a queued job.
- Jobs run **in a Web Worker** (`src/sim/worker.ts`), one at a time, oldest first, with progress. The UI never blocks.
- **Cancel** removes a queued job, or terminates and replaces the worker for a running one.
- Jobs persist in this browser (newest 30 finished, never dropping active ones). Jobs interrupted by a reload come back marked failed with the reason.

## Reproducible packages (`src/sim/packages.ts`)

Every finished job is sealed into a `telaio.simulation-package`: solver id and version, inputs, outputs, and SHA-256 over a canonical JSON encoding (keys sorted recursively). Import or **Verify** checks two things:

1. **The seal.** Was the file edited after creation?
2. **A re-run.** Does the solver reproduce every output to 1e-9 relative?

The second check catches a re-forged seal and a model that has changed since. The solver version is reported either way.

## Reports (`src/sim/reports.ts`)

**Report HTML** is self-contained and prints to PDF; **Report MD** suits version control. Each lists:
- results with provenance, and a warning when any result is ESTIMATED, ILLUSTRATIVE or UNKNOWN
- missing inputs
- every input, with value, unit, provenance and source or assumptions
- the assumptions
- the package hash and verification status

All content is HTML-escaped.

## External solvers: FEA, CFD, thermal

See [SOLVER_CONTRACT.md](SOLVER_CONTRACT.md). From any finished job, TELAIO exports a sealed **request** for a registered external solver: the source package, free-form solver settings, and a description. It imports **results** only when they reference that exact request hash, come from the named solver, carry a provenance the engineer assigns, and give every value a unit. Accepted values are shown as "computed externally by <solver> <version>" and never mixed into TELAIO's own outputs.

**Not provided:** a live solver connection. That needs a server, credentials and licences, which a static site cannot hold. The adapter interface is specified, so adding one doesn't change the traceability.

## Acceptance

`src/sim/sim.test.ts` (11 tests, 124 total):
- [x] Canonical encoding ignores key order and keeps array order.
- [x] The registry runs the same model as the labs, reports progress, and rejects unknown solvers.
- [x] Packages reproduce after a JSON round-trip.
- [x] An edit breaks the seal; a re-forged seal is still caught by the re-run.
- [x] A solver-version mismatch is reported.
- [x] External results are rejected for the wrong request, the wrong solver, missing units, or an edited request.
- [x] Reports escape HTML, list all 16 braking inputs with provenance, and state the hash.
- [x] Interrupted jobs restore as failed; the store cap never drops active jobs.

Browser (production build):
- The job form reads the current lab state.
- A braking job runs in the worker in 0.08 s.
- Six queued 201-step sweeps run oldest first; the last, cancelled while queued, ends cancelled while the rest complete.
- Verify reports "reproduced exactly"; a tampered download reports "Seal broken"; the genuine file re-imports and reproduces.
- Results for a nonexistent request are rejected; correct results are accepted and labelled external.

## Limitations

- Jobs, packages and requests live in browser storage. Shared, durable storage is Phase 18 and, beyond that, a server.
- One worker, so jobs run sequentially. The current solvers finish in well under a second.
