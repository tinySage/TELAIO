# Collaboration, review and access control: design

TELAIO currently runs entirely in the browser as a static site. Projects, revisions and review notes live in the browser's storage, and export files are the way to share and back up. Real collaboration needs a server. This document records how the existing local design maps onto one, so that adding it changes storage and transport but not the engineering model.

## What already carries over unchanged

| Local concept | Why it is server-ready |
| --- | --- |
| Revision = sealed snapshot with a parent link (`src/workflow/projects.ts`) | Content-addressed (SHA-256 over canonical JSON), immutable and append-only. It can be stored as-is, deduplicated by hash and verified by any client. |
| Simulation package (`src/sim/packages.ts`) | Self-verifying: the seal plus a re-run. A server never has to be trusted for results. |
| External solver request and results (`docs/SOLVER_CONTRACT.md`) | Results bind to a request hash. A server-side adapter only automates the file exchange. |
| Review notes outside the seal | Annotations on a hash, so concurrent reviews never conflict with content. |
| Provenance labels on every value | Travel inside the content and need no server-side interpretation. |

## What needs a server

1. **Shared storage.** Projects and revisions in a database, with large snapshots in object storage keyed by hash. Clients push new revisions and the server rejects any whose seal or parent does not verify. This is the same check `importProject` runs today.
2. **Identity.** Authenticated users replace the free-text author and reviewer fields, which are currently self-declared and unverified, as the UI implies.
3. **Access control** per project:
   - **Owner:** manage members, delete.
   - **Engineer:** commit, run studies, review.
   - **Reviewer:** review only.
   - **Viewer:** read only.
4. **Review workflow.** A revision can be required to have an `approved` review from a different user before it is marked *released*. Released revisions are what reports cite.
5. **Concurrency.** Two engineers committing on the same parent create a fork. Resolution is explicit: the second commit names the first as its parent after reviewing the diff (`diffSnapshots`). There is no silent last-write-wins.
6. **Privacy.**
   - Projects are private to members by default, and export stays available to members.
   - Sourced data with restricted distribution (team data, licensed tunnel results) can be marked `restricted` on the quantity's source record. Restricted values are withheld from viewers and from exported reports unless the exporter has the right.
7. **Audit log.** Who committed, restored, exported or changed membership, and when. It is append-only, like revisions.

## Not planned

- Real-time co-editing of a lab. Engineering changes go through commits and reviews on purpose.
- Server-side recomputation as a source of truth. Clients re-run sealed packages to verify, so the server stores and routes but is never trusted for numbers.
