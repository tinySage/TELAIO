# Phase 14 — Braking dynamics laboratory

Analysis → Braking. Straight-line braking with load transfer, fixed brake bias and a single friction coefficient, in SI units. The roadmap's rule was "distinguish simplified analytical models from higher-fidelity simulation". This is an analytical model and says so in every result's assumptions.

## Models (`src/engineering/braking.ts`)

- **Constant model**, used when any aero input is unknown. With no aerodynamic forces, achievable deceleration is closed-form:
  - Front lock: z = μf / (β − μh/L)
  - Rear lock: z = μ(1−f) / ((1−β) + μh/L)
  - Achievable z = the smaller of the two, with the limiting axle named.
  - Ideal bias = f + z·h/L.
- **Aero model**, used only when ClA, CdA, ρ and aero balance are all established. Downforce and drag scale with v². The brake-force limits are solved at each speed, and distance and time are integrated over speed (dx = v dv / a). With zero coefficients it reproduces the constant model, and a test enforces that.

Outputs:
- deceleration and the limiting axle
- ideal bias
- braking distance, stopping distance (with reaction time) and time to stop
- load transfer and axle loads
- brake torque per wheel and peak front brake power
- single-stop front rotor temperature rise: lumped, front energy = bias × brake work (kinetic energy minus drag work), no cooling

Tools:
- a bias sweep with the current and best bias marked
- a distance-vs-speed sweep
- normalised sensitivity: % change in distance per 1 % change in each input

## Reproducible studies

A study record holds the model id and version, the full inputs with provenance, and the outputs. Studies can be saved, exported as JSON and imported. Loading or importing re-runs the model and reports whether every output reproduces to 1e-9, and if not, which outputs differ, or that the model version changed.

## Linked to the mass lab

**From mass lab** takes total mass, front axle share and (with a scale) wheelbase from a mass configuration, carrying its provenance. **CoG height is deliberately not imported.** The study geometry is not to scale vertically: the wheel radius is 0.64 su against a 2.12 su wheelbase, about three times real proportions, so a derived height would come out near 1.1 m. That is wrong while still looking legitimate. The notice says so.

## No invented data

All inputs start UNKNOWN. **Demo** loads generic textbook-order single-seater values, labelled ILLUSTRATIVE, "not SF-24 or any real car data".

## Acceptance

Roadmap: *an engineer can change vehicle parameters and reproduce a braking study with documented assumptions and results.*

`src/engineering/braking.test.ts` (12 tests, 87 total):
- [x] At the ideal bias, deceleration = μ and distance = v²/(2μg) exactly.
- [x] Front and rear lock limits match the closed forms; the limiting axle is identified.
- [x] Load transfer = m·g·z·h/L; axle loads sum to the weight.
- [x] Rotor temperature rise and reaction distance match their formulas.
- [x] Distance elasticity is +2 for speed and 0 for mass (no aero).
- [x] A bias sweep peaks at the ideal bias.
- [x] Missing inputs give UNKNOWN with names.
- [x] With zero coefficients, the aero model equals the constant model; downforce and drag each shorten the stop; drag work reduces rotor heating; any unknown aero input falls back to the constant model and says so.
- [x] Studies reproduce exactly through JSON; tampered outputs and a changed model version are detected.

Browser: the mass-lab import fills mass, front share and wheelbase; the demo runs the aero model (5.46 g peak at 300 km/h, 114 m); a study exported to a file and re-imported reports "reproduces exactly".

## Limitations

- A single μ: no tyre load sensitivity, combined slip or temperature. Tyre models come in Phase 16.
- No ABS, brake fade, pad μ variation, pitch dynamics or brake-by-wire rear regeneration.
- Rotor heating is a single lumped stop with no convection, so it is an upper bound per stop, not a thermal model.
