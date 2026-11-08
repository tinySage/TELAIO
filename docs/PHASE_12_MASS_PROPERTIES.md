# Phase 12 — Engineering data and mass properties

Phase 12 starts Generation II: real calculations with traceable inputs. It adds the provenance-carrying quantity type every later lab uses, and a mass-properties lab in the **Analysis** view.

## Provenance model (`src/engineering/quantity.ts`)

Every engineering value is a `Quantity`: value, unit, provenance label, plus a source record (required for SOURCED) or stated assumptions (required for ESTIMATED). Every result inherits the weakest label among its inputs:

| Inputs | Result |
| --- | --- |
| All SOURCED or DERIVED | DERIVED |
| Any ESTIMATED | ESTIMATED |
| Any ILLUSTRATIVE | ILLUSTRATIVE |
| Any UNKNOWN | UNKNOWN, with no value, and the missing inputs listed |

Results also carry their modelling assumptions, shown beneath every result panel.

## Mass properties (`src/engineering/massProperties.ts`)

For the components installed in the Workbench:

- **Total mass and CoG.** CoG is given in the study frame, and in metres once a study-frame scale is supplied.
- **Front axle share.** The static load split from the CoG position between the axle lines. It needs no scale, because it is a ratio of study-frame distances.
- **Inertia tensor about the CoG.** A point-mass approximation, labelled as a lower bound, since each component's own inertia is omitted. Needs the scale.
- **Ballast.** Items with mass and study-frame position, plus a solver for the ballast mass that reaches a target front share at a chosen x.
- **Configurations.** Named, duplicable sets of masses, exclusions, ballast and scale, stored in this browser and validated on load. Any two can be compared (Δ mass, Δ CoG, Δ front share).
- **Exclusions.** A component can be excluded from the totals with a reason. Exclusions are grouped by reason in the assumptions, so they are never silent.

The **study-frame scale** (metres per study unit) is itself a quantity with provenance. For example, a SOURCED wheelbase divided by the 2.12 su study wheelbase gives a DERIVED scale.

### No invented data

Every component starts UNKNOWN. The **Demo** button loads an opt-in configuration of round numbers that is labelled ILLUSTRATIVE throughout, named "Illustrative demo (not real data)", with a note on every value saying it is not SF-24 or any real car's data. Its scale assumes a 3.6 m wheelbase, also ILLUSTRATIVE.

## Workspace

The top nav now switches between **Workbench** and **Analysis**. Both views stay mounted, so the 3D scene and lab state survive switching. The Analysis view always uses the Workbench's installed set, so removing a part updates the mass results. Simulation and Project are disabled until Phases 17 and 18.

## Acceptance

Roadmap: *every calculated result can be traced back to its input geometry, assumptions and source data.*

- [x] 11 tests in `src/engineering/massProperties.test.ts` (61 total). They cover provenance propagation, source and assumption requirements, missing-input reporting, CoG and axle split for two point masses checked by hand, dumbbell inertia (2md², 2md², 0), weakest-input downgrade, exclusion assumptions, the ballast solve (adding the solved ballast lands exactly on the target), comparison deltas, the demo labelled ILLUSTRATIVE, and storage round-trips.
- [x] Browser: an empty configuration shows UNKNOWN everywhere. The demo gives 421 kg, a 39.1 % front share and a ballast solve, all ILLUSTRATIVE. Removing the 6 kg front wing in the Workbench drops the total to 415 kg. Configurations persist across a reload.

## Limitations

- Point masses at component anchors. Component CoG offsets and individual inertias need real geometry and material data.
- Static only: no fuel burn, driver mass or ride-height effects.
- The axle split assumes level ground and uses the front-left and rear-left wheel x positions as the axle lines.
