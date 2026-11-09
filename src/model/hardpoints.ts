/**
 * Suspension hardpoints for the left-hand corners, in the vehicle study frame (x forward, y up, z left,
 * study units). Right-hand corners are mirrored. These are ILLUSTRATIVE: a generic layout chosen to be
 * kinematically sensible for the study geometry, not measured or sourced SF-24 pickup points.
 *
 * Every corner is five fixed-length links between a chassis point and an upright point, plus a spring
 * actuation rod. Double wishbone arms are two links sharing one outboard ball joint.
 */
import type { Vec3 } from './components'

export type Link = { id: string; label: string; inboard: Vec3; outboard: Vec3 }
export type CornerHardpoints = {
  corner: 'front' | 'rear'
  links: Link[]
  /** Spring actuation rod: outboard end moves with the upright, inboard end is the rocker pickup. */
  actuation: { label: string; outboard: Vec3; inboard: Vec3 }
  wheelCentre: Vec3
  /** A point inboard along the wheel spin axis, defining the axis direction. */
  spinAxisPoint: Vec3
  /** Loaded tyre radius in study units, for the contact patch. */
  tyreRadius: number
}

export const FRONT_HARDPOINTS: CornerHardpoints = {
  corner: 'front',
  links: [
    { id: 'lower-front', label: 'Lower wishbone, front leg', inboard: [1.18, -0.345, 0.16], outboard: [0.9, -0.3, 0.8] },
    { id: 'lower-rear', label: 'Lower wishbone, rear leg', inboard: [0.58, -0.345, 0.16], outboard: [0.9, -0.3, 0.8] },
    { id: 'upper-front', label: 'Upper wishbone, front leg', inboard: [1.12, 0.2, 0.2], outboard: [0.88, 0.28, 0.76] },
    { id: 'upper-rear', label: 'Upper wishbone, rear leg', inboard: [0.66, 0.2, 0.2], outboard: [0.88, 0.28, 0.76] },
    // Bump steer: in the front view the tie rod points at the wishbones' instant centre, with its inner end
    // on the line through the arm inner pivots. Derived by hand; toe change stays under 0.01° over ±0.06 su.
    { id: 'tie-rod', label: 'Steering tie rod', inboard: [0.74, -0.0175, 0.184], outboard: [0.74, 0.05, 0.776] },
  ],
  actuation: { label: 'Push-rod', outboard: [0.9, -0.22, 0.74], inboard: [0.86, 0.36, 0.2] },
  wheelCentre: [0.9, 0, 0.96],
  spinAxisPoint: [0.9, 0, 0.86],
  tyreRadius: 0.64,
}

export const REAR_HARDPOINTS: CornerHardpoints = {
  corner: 'rear',
  links: [
    { id: 'lower-front', label: 'Lower link, front', inboard: [-0.9, -0.34, 0.16], outboard: [-1.2, -0.3, 0.8] },
    { id: 'lower-rear', label: 'Lower link, rear', inboard: [-1.5, -0.36, 0.16], outboard: [-1.24, -0.3, 0.8] },
    { id: 'upper-front', label: 'Upper link, forward', inboard: [-0.95, 0.2, 0.22], outboard: [-1.18, 0.28, 0.76] },
    { id: 'upper-rear', label: 'Upper link, rearward', inboard: [-1.55, 0.22, 0.22], outboard: [-1.26, 0.28, 0.76] },
    // Toe-link inner point found by numerical search (minimum peak toe change over ±0.06 su: 0.023°).
    { id: 'toe-link', label: 'Toe link', inboard: [-1.4, -0.11, 0.1777], outboard: [-1.4, -0.05, 0.78] },
  ],
  actuation: { label: 'Pull-rod', outboard: [-1.22, -0.25, 0.72], inboard: [-0.65, 0.45, 0.22] },
  wheelCentre: [-1.22, 0, 0.94],
  spinAxisPoint: [-1.22, 0, 0.84],
  tyreRadius: 0.71,
}

export const mirror = (v: Vec3): Vec3 => [v[0], v[1], -v[2]]

/** Damper line of action from the rocker; fixed chassis-side eye. */
export const FRONT_DAMPER_CHASSIS: Vec3 = [0.45, 0.4, 0.06]
export const REAR_DAMPER_CHASSIS: Vec3 = [-0.3, 0.42, 0.06]

const link = (h: CornerHardpoints, id: string) => {
  const found = h.links.find((item) => item.id === id)
  if (!found) throw new Error('Missing hardpoint link ' + id)
  return [found.inboard, found.outboard] as [Vec3, Vec3]
}

/** Rod segments for the left-hand 3D suspension parts, drawn from the hardpoints. */
export function suspensionSegments(): Record<string, [Vec3, Vec3][]> {
  const f = FRONT_HARDPOINTS, r = REAR_HARDPOINTS
  return {
    'lower-wishbone': [link(f, 'lower-front'), link(f, 'lower-rear')],
    'upper-wishbone': [link(f, 'upper-front'), link(f, 'upper-rear')],
    'push-rod': [[f.actuation.outboard, f.actuation.inboard]],
    'tie-rod-left': [link(f, 'tie-rod')],
    'tie-rod-right': [link(f, 'tie-rod').map(mirror) as [Vec3, Vec3]],
    'front-damper-left': [[f.actuation.inboard, FRONT_DAMPER_CHASSIS]],
    'front-damper-right': [[mirror(f.actuation.inboard), mirror(FRONT_DAMPER_CHASSIS)]],
    'rear-lower-link': [link(r, 'lower-front'), link(r, 'lower-rear')],
    'rear-upper-link-front': [link(r, 'upper-front')],
    'rear-upper-link-rear': [link(r, 'upper-rear')],
    'rear-toe-link': [link(r, 'toe-link')],
    'rear-pull-rod': [[r.actuation.outboard, r.actuation.inboard]],
    'rear-damper-left': [[r.actuation.inboard, REAR_DAMPER_CHASSIS]],
    'rear-damper-right': [[mirror(r.actuation.inboard), mirror(REAR_DAMPER_CHASSIS)]],
  }
}

/** Rocker positions at the actuation rod inboard ends. */
export const rockerPositions = (): Record<string, Vec3> => ({
  'front-rocker-left': FRONT_HARDPOINTS.actuation.inboard, 'front-rocker-right': mirror(FRONT_HARDPOINTS.actuation.inboard),
  'rear-rocker-left': REAR_HARDPOINTS.actuation.inboard, 'rear-rocker-right': mirror(REAR_HARDPOINTS.actuation.inboard),
})
