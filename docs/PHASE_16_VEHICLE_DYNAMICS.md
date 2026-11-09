# Phase 16 — Vehicle dynamics laboratory

Analysis → Vehicle dynamics. Two vehicle configurations (A and B) on a user-built track, with every result provenance-tracked. SI units.

## Models (`src/engineering/dynamics.ts`)

| Model | What it gives | Key assumptions |
| --- | --- | --- |
| Longitudinal | Traction-, power- and drag-limited acceleration; 0–100 and 0–200 times; top speed (power = resistance); braking at ideal bias | Rear-wheel drive; RWD traction with load transfer; no gears |
| Lateral | Steady cornering speed m v²/R = μ(m g + ½ρv²ClA), capped at top speed; lateral limit; lateral load transfer | Point mass; downforce adds grip in proportion |
| Tyre | Magic-formula-style Fy = μFz·sin(C·atan(Bα)), with B fitted to cornering stiffness | Shape factor 1.3; no load sensitivity or combined slip in the curve |
| Handling | Linear single-track model: understeer gradient (deg/g), characteristic or critical speed, yaw-rate gain, yaw-mode natural frequency and damping from the 2-state eigenvalues, stability verdict | Small angles, linear tyres, constant speed |
| Lap | Quasi-steady: speed limit per point from cornering grip, forward (acceleration) and backward (braking) passes under a friction ellipse, closed lap iterated to a consistent start speed | Point mass; ideal brake bias; no transients, tyre temperature or energy deployment |

## Tools

- **A vs B comparison** of every metric and the lap, with a speed-trace overlay and per-segment time deltas that sum to the lap delta.
- **Track editor:** straights and constant-radius corners, validated, with provenance.
- **Single-parameter sweep:** lap time against any input. When the best value sits at the edge of the range, the lab says there is **no optimum inside the range** and explains why: one parameter alone usually carries no penalty here (more ClA without more CdA is always faster). That flag exists because the first version reported such an edge as an "optimum".
- **Wing-configuration study:** runs the lap for each wing configuration from the Aerodynamics lab, at its operating point on its map. This is the coupled downforce-versus-drag decision. On the invented demo loop, high downforce beats low drag by 0.73 s.
- **From braking lab:** imports mass, weight split, CoG height, wheelbase, μ and aero inputs, keeping their provenance.

## Phase 12 correction: geometry provenance

Building this lab exposed a gap in Phase 12. The study geometry is not to scale vertically (Phase 14 found this), nor laterally: its track-to-wheelbase ratio is about 0.9, against roughly 0.44 for a real car. Yet the mass lab labelled CoG, axle share and inertia DERIVED whenever the masses were sourced.

Position-based results now inherit the geometry's ILLUSTRATIVE label, with an assumption that says why. Total mass can still be DERIVED. So yaw inertia for this lab must be entered from a real source, not taken from the study geometry.

## No invented data

All inputs start UNKNOWN. **Demo** loads generic single-seater-order values, and **Demo loop** loads an invented layout, explicitly "not a real circuit". Both are ILLUSTRATIVE.

## Acceptance

Roadmap: *the system can run repeatable simulations and compare multiple vehicle configurations.*

`src/engineering/dynamics.test.ts` (15 tests; 113 total):
- [x] A traction-limited standing start matches t = √(2d/a) with a = μg(1−f)/(1−μh/L).
- [x] A constant-radius circle without aero laps at √(μgR).
- [x] Top speed = ∛(2Pη/ρCdA).
- [x] Downforce raises the cornering limit up to top speed.
- [x] The tyre curve's slope at zero equals the cornering stiffness, and its peak equals μFz.
- [x] Neutral steer gives K = 0 and yaw gain v/L.
- [x] The characteristic speed is √(L/K).
- [x] An oversteering car is stable below its critical speed and unstable above it.
- [x] Missing yaw inertia is reported.
- [x] Laps are deterministic, respect the speed limit everywhere and close (finish speed = start speed).
- [x] Downforce helps and drag hurts.
- [x] Segment deltas sum to the lap delta.
- [x] Sweeps run, track validation works, and missing inputs give UNKNOWN.

Browser: the demo car gives 339 km/h, 0–100 in 2.69 s, 3.11 g lateral at 200 km/h and a 54.54 s lap. B with ClA 5 is 1.80 s faster. The yaw mode is stable (3.56 Hz, ζ 1.04). Edge-of-range sweeps are flagged, and the wing study ranks the three configurations.

## Limitations

- A point-mass lap model. No combined-slip tyre model in the lap, no transient handling, gears, tyre temperature, fuel burn or energy deployment.
- The handling model is linear, and aero is excluded from the handling terms.
- Tracks are straights and constant-radius arcs, with no elevation, banking or clothoids.
