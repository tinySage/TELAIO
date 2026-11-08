# Phase 13 — Suspension engineering

A suspension workspace (Analysis → Suspension) with defined hardpoints, a general rigid-link kinematic solver, and spring and damper rates.

## Hardpoints (`src/model/hardpoints.ts`)

The earlier wishbones were visual only: their legs ran fore-aft and ended at two different outboard points, so no kinematic solver could use them. Phase 13 defines proper hardpoint sets for the left-hand corners (the right-hand corners are mirrored), and the 3D links are now drawn from them:

- **Front:** double wishbone. Two legs per arm meet at a single ball joint, plus the steering tie rod and a push-rod to the rocker.
- **Rear:** five-link. Two lower links, two upper links and a new **toe link** (`rear-toe-link` / `rear-right-toe-link`, 89 components now), plus the pull-rod.

The hardpoints are **ILLUSTRATIVE**: a generic layout chosen to be kinematically sensible, not SF-24 pickup points. The set's provenance is selectable, so a measured or sourced set can be labelled correctly.

## Solver (`src/engineering/suspension.ts`)

The upright is a rigid body with 6 degrees of freedom, constrained by 5 fixed link lengths plus the wheel-centre vertical travel. Newton's method on the 6×6 system, with a numerical Jacobian and continuation along the sweep, solves both corner types with the same code. Every solved pose is checked to close all link lengths to 10⁻⁹ su, and the lab shows the closure error.

Outputs:
- camber and toe across travel, shown as charts
- camber gain and bump steer at static
- push/pull-rod motion ratio
- front-view roll centre height
- a rack or toe-link shift for steer studies

Angles and ratios are independent of scale. Travel and roll-centre height are in study units.

Spring and damper calculations, given spring rate, rocker ratio, damper coefficient and sprung corner mass (all UNKNOWN by default):
- installation ratio
- wheel rate = k·IR²
- ride frequency
- damping ratio

## Bump steer, designed rather than tuned

The first default layout had 2.6° of toe change over ±0.06 su at the front, which no real car would accept. The fix is the classic front-view rule, applied fully: the tie rod must point at the wishbones' instant centre, with its inner end on the line through the inner pivots.

That rule needs pivot axes that run straight fore-aft, so the arm pivots were levelled first (removing an anti-dive inclination). Working the instant centre by hand then gives an inner point of (−0.0175, 0.184), and the solver confirms **0.0068°** peak toe change. A numerical search around that point finds nothing better, so the theory and the solver agree.

The five-link rear has no single instant centre, so its toe-link inner point was found by numerical search: **0.023°**. Both limits are enforced by tests.

## Acceptance

Roadmap: *changing suspension geometry produces reproducible, mathematically consistent kinematic outputs.*

`src/engineering/suspension.test.ts` (14 tests, 75 total):
- [x] Static closure with zero camber and toe, for front and rear.
- [x] Full sweeps close every constraint and hit the requested travel.
- [x] **Parallelogram identities:** zero camber and toe change throughout, roll centre at ground level, and motion ratio equal to the rod's vertical direction cosine.
- [x] Negative camber gain in bump, from the shorter upper arm.
- [x] Exact left/right mirror symmetry.
- [x] Bit-identical reproducibility.
- [x] Opposite rack shifts give opposite toe.
- [x] The five-link rear solves.
- [x] Bump steer limits for both corners.
- [x] Spring and damper formulas, missing-input reporting, and ILLUSTRATIVE inherited from the hardpoints.
- [x] The 3D wishbones share a single ball joint and mirror correctly.

Browser: front camber gain −6.96°/su, bump steer −0.01°/su, motion ratio 0.765, roll centre −0.027 su; entering spring and damper inputs yields a wheel rate, ride frequency and damping ratio, all ILLUSTRATIVE.

## Limitations

- Rigid links only: no bushing compliance and no chassis roll (the chassis is fixed, and travel is the wheel's).
- The roll centre assumes left/right symmetry and a contact patch directly below the wheel centre.
- The motion ratio holds the rocker pickup fixed. The rocker ratio is an input, not geometry.
- Hardpoint edits in the lab drive the calculations. The 3D view draws the default set.
