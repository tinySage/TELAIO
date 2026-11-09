# Phase 18 — Professional engineering workflow

The **Project** view turns the workspace into versioned engineering work. The roadmap's destination was: *open a vehicle configuration, make a change, run a study, compare results and produce a reproducible report.* Each step now exists, with a seal behind it.

## Projects and revisions (`src/workflow/projects.ts`)

- A **revision** is an immutable snapshot of the whole engineering workspace: Workbench saved states, mass configurations, suspension, braking inputs and studies, aero maps and wings, dynamics configurations and track, simulation jobs with their sealed packages, and external solver requests and results.
- Each revision records its **context**: a fingerprint of the assembly model (component IDs, positions, interfaces, install rules) and the asset integrity hashes. A revision made against a different model is flagged as "made against a different assembly model".
- Revisions are **sealed** with SHA-256 over canonical JSON and **chained** to their parent, like commits. History is append-only.
- **Load into workspace** restores any revision. History is unchanged, and the page reloads so every lab reads the restored state.
- **Verify history** checks every seal and parent link.

## Comparing revisions

Tick two revisions to see a structured diff, or select one to see its changes since its parent. Diffs are aware of quantities and provenance, for example:

> Braking inputs · mass: 800 kg · ILLUSTRATIVE · Generic textbook-order value… → 798 kg · SOURCED · Corner scales, 9 Nov

Arrays of records (configurations, wings, segments) are matched by id or name, so a reorder is not reported as a change.

## Provenance census and audit

For any revision:
- **Census:** every quantity counted by label.
- **Audit:** every SOURCED value without a source, and every ESTIMATED value without stated assumptions.

Simulation packages are excluded from the census because they hold copies of the lab inputs.

## Export and import

Project files (`telaio.project`) carry every revision. On import, every seal and parent link is verified, so a file whose history was edited is **refused**, naming the revision whose seal broke.

## User-defined studies

A study is a saved recipe: a solver plus overrides of specific lab inputs. Each override has its own value, provenance and reason, such as *inputs.speed = 330 km/h, ESTIMATED, "Qualifying entry"*. Running a study snapshots the current lab inputs, applies the overrides and queues a job in the shared Phase 17 runner. The result is a sealed package like any other.

## Review and reports

- **Review notes** (reviewer, verdict, comment) attach to a revision *outside* its seal, so reviewing never changes the reviewed content. The latest verdict shows as a badge in the history.
- The **Project report** (HTML) gives the revision and its hash, a warning if the assembly model differs, the census, audit issues, simulation packages with hashes, changes since the parent, and the reviews.

## What needs a server

Sharing, real identities, access control, enforced review workflows and privacy controls need a backend. The UI says so plainly: projects live only in this browser, and export files are the way to share. [COLLABORATION_DESIGN.md](COLLABORATION_DESIGN.md) records how the local design (content-addressed revisions, self-verifying packages, annotations outside seals) maps onto a server without changing the engineering model.

## Acceptance

`src/workflow/projects.test.ts` (10 tests, 134 total):
- [x] Snapshots capture only engineering domains, and restores clear absent ones.
- [x] Revisions chain; an edited revision or reordered history is detected.
- [x] Review notes don't affect seals.
- [x] Project files round-trip, and a tampered file is refused.
- [x] The assembly fingerprint is stable and changes when a component moves.
- [x] Diffs report quantity value and provenance changes and additions matched by id; identical snapshots give no diff.
- [x] The census counts by label, and the audit finds a SOURCED value without a source and an ESTIMATED value without assumptions.
- [x] Study overrides apply with their provenance, without mutating the base, and bad paths are reported.
- [x] The project report escapes HTML and states the hash, census and model warning.

Browser (production build):
1. Commit a baseline.
2. Change the braking mass to a SOURCED measured value and commit; the diff shows exactly that change with both provenances, and the census shows 1 SOURCED and 15 ILLUSTRATIVE.
3. The revision is made against the current assembly model, with 4 asset records.
4. Compare and verify history both pass.
5. A review marks the revision APPROVED.
6. A tampered export is refused, naming the revision; the genuine one imports with its seals verified.
7. A user-defined 330 km/h study runs through the job queue (127 m).
8. Restoring the baseline brings the mass back to 800 kg ILLUSTRATIVE, with history intact.

## Limitations

- Browser storage only, so size is bounded (the UI shows current usage). Export and delete old projects as needed.
- Authors and reviewers are self-declared text until there is a server with identity.
- Restoring reloads the page.
