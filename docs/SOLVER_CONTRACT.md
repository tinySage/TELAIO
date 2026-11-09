# External solver contract

TELAIO runs analytical and numerical models in the browser (braking, lap, suspension). It does **not** run finite element analysis (FEA), computational fluid dynamics (CFD) or detailed thermal solvers, and never presents results as if it had. Those need meshing, solver numerics and compute that belong in dedicated tools.

This contract lets such a tool take part in TELAIO's traceability. TELAIO hands out a sealed request, and accepts results only when they answer exactly that request.

## 1. Request (`telaio.external-request`, version 1)

TELAIO produces it from any finished simulation package (Simulation → select a job → *Send to an external solver*).

```json
{
  "format": "telaio.external-request",
  "formatVersion": 1,
  "createdAt": "2026-11-09T01:00:00.000Z",
  "solver": { "name": "ExampleFEA", "version": "2.1", "discipline": "Thermal" },
  "settings": { "mesh": "2 mm tetrahedral", "convection": "h = 90 W/m²K" },
  "source": { "...": "the complete TELAIO simulation package this request derives from" },
  "description": "Front rotor transient thermal, one stop from 300 km/h",
  "sha256": "<SHA-256 of the canonical JSON of every field above except sha256>"
}
```

- `settings` is free-form and recorded verbatim (mesh, boundary conditions, load cases, solver options). It is part of the sealed content, so the record shows exactly what was asked.
- `source` embeds the originating package, with its own seal, so the external engineer has every input with its provenance.
- Canonical JSON means object keys are sorted recursively, arrays keep their order, and `undefined` fields are omitted (`src/sim/packages.ts → canonicalJson`).

## 2. Results (`telaio.external-results`, version 1)

The external tool, or the engineer running it, returns:

```json
{
  "format": "telaio.external-results",
  "formatVersion": 1,
  "requestSha256": "<the request's sha256, exactly>",
  "solver": { "name": "ExampleFEA", "version": "2.1", "discipline": "Thermal" },
  "completedAt": "2026-11-09T03:12:00.000Z",
  "values": { "Peak rotor temperature": { "value": 612.4, "unit": "°C" } },
  "provenance": "DERIVED",
  "notes": "Mesh-converged at 2 mm; validated against dyno run 44"
}
```

TELAIO accepts it only if all of these hold:

1. `requestSha256` matches a request stored in this browser.
2. That stored request still matches its own seal (it has not been edited).
3. `solver.name` matches the solver the request was made for.
4. `provenance` is one of SOURCED, DERIVED, ESTIMATED, ILLUSTRATIVE, UNKNOWN. The engineer decides it. A validated, converged run might be DERIVED; an unvalidated one ESTIMATED.
5. There is at least one value, and every value has a number or string and a unit.

Accepted values are displayed with the line "computed externally by <solver> <version>". They are never mixed into TELAIO's own solver outputs.

## 3. Adapters

This version supports file exchange: export the request, run it externally, and import the results. A live adapter (submit, poll, fetch over an API) would implement the same two documents, so nothing about traceability changes when one is added:

```ts
interface ExternalSolverAdapter {
  solver: ExternalSolver
  submit(request: ExternalRequest): Promise<{ jobRef: string }>
  poll(jobRef: string): Promise<'queued' | 'running' | 'done' | 'failed'>
  fetch(jobRef: string): Promise<ExternalResults>   // must satisfy section 2
}
```

A live adapter needs a server, credentials and a solver licence. A static site cannot hold those, so none ships here.

## Related: simulation packages (`telaio.simulation-package`, version 1)

These are TELAIO's own reproducible results: solver id and version, inputs, outputs and `sha256` over the canonical JSON of `{ solver, inputs, outputs }`. Importing one checks two things in order:

1. **The seal.** Has the file been edited since it was created?
2. **The re-run.** Does running the same solver on the same inputs give the same outputs, to 1e-9 relative?

The second check catches a forged seal and a model that has changed since the package was made. The solver version is reported either way.
