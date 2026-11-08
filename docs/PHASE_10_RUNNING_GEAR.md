# Phase 10, part 1 — Running gear

Phase 10 expands the single front-left corner into a complete vehicle, system by system. Part 1 covers the running gear: all four corners, steering, spring-damper units and brake hydraulics. Part 2 covers chassis subdivision, powertrain, aerodynamics and cooling.

The assembly grows from 29 to 76 components. Every new component is a procedural study envelope with provenance `ILLUSTRATIVE` and dimensions "Not established".

## Orientation fix

Before this phase, every wheel and the brake rotor spun about the vehicle's longitudinal (x) axis, so the tyres stood across the car. The front-left brake corner also sat 0.3 units ahead of the wheel centre instead of on the axle. Both errors would have been copied into three more corners, so they are fixed first:

- Wheels: the torus already lies in the XY plane, so its axis is lateral (z). The extra 90° rotation was removed.
- Rotor: the glTF asset and the procedural disc both use local x as the rotor axis. The `brake-disc` part now carries `rotation: [0, π/2, 0]`, which the scene applies to imported assets as well as primitives.
- Front axle at x = 0.9 and rear axle at x = −1.22. Wheels, hubs and discs on each axle are coaxial, with the disc and hub inboard of the wheel.
- Phase 9 brake parts were re-laid to straddle the rotor along z. Their IDs, relations and service order are unchanged.

## Derived corners

`src/model/corners.ts` derives the other three corners from the authored front-left corner using explicit ID maps:

| Corner | Derived from | Transform |
| --- | --- | --- |
| Front-right | Front-left suspension, brakes and wheel | Mirror across z = 0 |
| Rear-left | Front-left brake set | Translate front axle → rear axle; attach to the existing rear upright and wheel |
| Rear-right | Rear-left suspension and brakes | Mirror across z = 0 |

Each map lists the source ID, derived ID and display name. Where the derived component already existed (the rear upright and the three other wheels), only relations are merged, so existing IDs are stable. Interfaces, dependencies and install prerequisites are derived with the same maps. A relation is kept only when both ends map into the corner or the target is shared (`chassis-node`).

The rear-right corner also mirrors the rear suspension (upright, two upper links, lower link, pull-rod), which previously existed on the left only.

All four discs use the original illustrative rotor asset. Front and rear rotor differences are not established.

## New authored systems

| System | Components |
| --- | --- |
| Steering | `steering-rack`, `steering-column`, `tie-rod-left`, `tie-rod-right` |
| Spring-damper units | `front-rocker-left/right`, `front-damper-left/right`, `rear-rocker-left/right`, `rear-damper-left/right` |
| Brake hydraulics | `master-cylinder-front`, `master-cylinder-rear` |

Push-rods and pull-rods now end at a rocker instead of a conceptual chassis pickup, so a rocker cannot be removed while its rod is fitted. Each master cylinder has a `CONCEPTUAL` hydraulic interface to the two calipers on its axle. Brake lines are not modelled.

## Acceptance criteria

Roadmap: *a complete, navigable vehicle assembly with stable component identities, meaningful parent-child relationships and interface definitions.* Part 1 covers this for the running gear.

Automated (`npm test`, `src/model/runningGear.test.ts`, 12 tests):

- [x] Unique IDs; no dangling references; the full set is a valid installed state.
- [x] Every component has illustrative provenance, unestablished dimensions and an install rule.
- [x] Every running-gear component has at least one interface.
- [x] Each wheel is coaxial with its hub and disc, which sit inboard of it.
- [x] Right-hand corners are exact mirrors of the left.
- [x] For each of the four corners: the removal sequence starts with that wheel, removes pads before the caliper, never touches another corner, and fully rebuilds.
- [x] Rods end at rockers; the rack carries both tie rods; hydraulics split front and rear.

Browser check (headless Chrome, production build): 76 / 76 installed, all four rotors load (GEOMETRY READY), top view symmetric, exploded view separates all four corners.

## Known gaps

- Bodywork envelopes (floor, nose, wings, sidepods, engine cover) still have no interface records. They get them with the chassis and aero split in part 2.
- The explorer lists 76 components grouped by system; collapsible groups would help and belong to Phase 11.
- Pickup points for the new links are illustrative and have not been checked for clashes with bodywork.
