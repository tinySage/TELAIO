/**
 * Suspension kinematics for one corner. The upright is a rigid body with six degrees of freedom held by
 * five fixed-length links; a sixth equation fixes the wheel-centre vertical travel. The pose is solved
 * with Newton's method on the 6×6 system (numerical Jacobian, continuation along the sweep), so the same
 * solver handles a double wishbone (two links per arm sharing a ball joint) and a five-link rear.
 *
 * Positions are in the vehicle study frame (study units). Angles are scale-free; travel and roll-centre
 * height are in study units. Sign conventions: camber negative when the top of the wheel leans inboard;
 * toe positive for toe-in. Valid for either side: the corner's own outboard direction is used.
 */
import type { Vec3 } from '../model/components'
import type { CornerHardpoints } from '../model/hardpoints'
import { isKnown, result, type Provenance, type Quantity, type Result } from './quantity'

type V = Vec3
const add = (a: V, b: V): V => [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
const sub = (a: V, b: V): V => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
const scale = (a: V, k: number): V => [a[0] * k, a[1] * k, a[2] * k]
const dot = (a: V, b: V) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const cross = (a: V, b: V): V => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
const norm = (a: V) => Math.sqrt(dot(a, a))
const unit = (a: V): V => scale(a, 1 / norm(a))
const deg = (radians: number) => radians * 180 / Math.PI

/** Rotation by rotation vector r (Rodrigues). */
function rotate(p: V, r: V): V {
  const angle = norm(r)
  if (angle < 1e-15) return p
  const k = scale(r, 1 / angle), c = Math.cos(angle), s = Math.sin(angle)
  return add(add(scale(p, c), scale(cross(k, p), s)), scale(k, dot(k, p) * (1 - c)))
}

/** Pose: rotation vector and translation, applied about the static wheel centre. */
export type Pose = { r: V; t: V }
const apply = (pose: Pose, point: V, centre: V): V => add(add(rotate(sub(point, centre), pose.r), centre), pose.t)

function solveLinear(a: number[][], b: number[]): number[] | null {
  const n = b.length, m = a.map((row, i) => [...row, b[i]])
  for (let col = 0; col < n; col++) {
    let pivot = col
    for (let row = col + 1; row < n; row++) if (Math.abs(m[row][col]) > Math.abs(m[pivot][col])) pivot = row
    if (Math.abs(m[pivot][col]) < 1e-14) return null
    ;[m[col], m[pivot]] = [m[pivot], m[col]]
    for (let row = 0; row < n; row++) {
      if (row === col) continue
      const f = m[row][col] / m[col][col]
      for (let k = col; k <= n; k++) m[row][k] -= f * m[col][k]
    }
  }
  return m.map((row, i) => row[n] / row[i])
}

export type CornerState = {
  travel: number; steer: number
  wheelCentre: V; spinAxis: V
  camberDeg: number; toeDeg: number
  actuationLength: number
  /** Largest link-length error after solving; ~1e-12 when the constraints close. */
  residual: number
  pose: Pose
}

/**
 * Solves the upright pose for a given vertical wheel travel (su, positive = bump) and steering rack
 * displacement (su, moves the tie-rod/toe-link inboard point along z). Returns null if Newton fails.
 */
export function solveCorner(h: CornerHardpoints, travel: number, steer = 0, guess?: Pose): CornerState | null {
  const centre = h.wheelCentre
  const lengths = h.links.map((link) => norm(sub(link.outboard, link.inboard)))
  const steerIndex = h.links.findIndex((link) => link.id === 'tie-rod' || link.id === 'toe-link')
  const inboard = h.links.map((link, i) => i === steerIndex ? add(link.inboard, [0, 0, steer]) : link.inboard)
  const residuals = (x: number[]): number[] => {
    const pose: Pose = { r: [x[0], x[1], x[2]], t: [x[3], x[4], x[5]] }
    return [
      ...h.links.map((link, i) => norm(sub(apply(pose, link.outboard, centre), inboard[i])) - lengths[i]),
      apply(pose, centre, centre)[1] - centre[1] - travel,
    ]
  }
  let x = guess ? [...guess.r, ...guess.t] : [0, 0, 0, 0, travel, 0]
  for (let iteration = 0; iteration < 50; iteration++) {
    const f = residuals(x)
    if (Math.max(...f.map(Math.abs)) < 1e-12) break
    const jacobian: number[][] = Array.from({ length: 6 }, () => Array(6).fill(0))
    for (let j = 0; j < 6; j++) {
      const h1 = 1e-7, xp = [...x], xm = [...x]
      xp[j] += h1; xm[j] -= h1
      const fp = residuals(xp), fm = residuals(xm)
      for (let i = 0; i < 6; i++) jacobian[i][j] = (fp[i] - fm[i]) / (2 * h1)
    }
    const step = solveLinear(jacobian, f.map((v) => -v))
    if (!step) return null
    x = x.map((v, i) => v + step[i])
  }
  const pose: Pose = { r: [x[0], x[1], x[2]], t: [x[3], x[4], x[5]] }
  const f = residuals(x)
  const residual = Math.max(...f.slice(0, 5).map(Math.abs))
  if (!(residual < 1e-9) || Math.abs(f[5]) > 1e-9) return null

  const wheelCentre = apply(pose, centre, centre)
  const outboard = unit(sub(wheelCentre, apply(pose, h.spinAxisPoint, centre)))
  const camberDeg = -deg(Math.asin(Math.max(-1, Math.min(1, outboard[1]))))
  // With the outboard spin-axis direction, toe-in tilts it forward (+x) on either side, so one formula serves both.
  const toeDeg = deg(Math.atan2(outboard[0], Math.abs(outboard[2])))
  const actuationLength = norm(sub(apply(pose, h.actuation.outboard, centre), h.actuation.inboard))
  return { travel, steer, wheelCentre, spinAxis: outboard, camberDeg, toeDeg, actuationLength, residual, pose }
}

/** Sweeps travel from −range to +range, solving outward from the static pose for continuity. */
export function sweepTravel(h: CornerHardpoints, range: number, steps = 24, steer = 0): CornerState[] {
  const states: CornerState[] = []
  const stat = solveCorner(h, 0, steer)
  if (!stat) return []
  const walk = (direction: 1 | -1) => {
    const out: CornerState[] = []
    let guess = stat.pose
    for (let i = 1; i <= steps / 2; i++) {
      const state = solveCorner(h, direction * range * i / (steps / 2), steer, guess)
      if (!state) break
      out.push(state); guess = state.pose
    }
    return out
  }
  states.push(...walk(-1).reverse(), stat, ...walk(1))
  return states
}

/** Derivative of a state quantity with respect to travel at static, by central difference. */
function slopeAtStatic(h: CornerHardpoints, pick: (s: CornerState) => number, d = 1e-4): number | null {
  const up = solveCorner(h, d), down = solveCorner(h, -d)
  return up && down ? (pick(up) - pick(down)) / (2 * d) : null
}

/** Front-view roll centre height above the contact patch (su), from the arm instant centre. Symmetric car assumed. */
export function rollCentreHeight(h: CornerHardpoints): number | null {
  const project = (v: V): [number, number] => [v[2], v[1]] // (z, y) front view
  const arm = (prefix: 'lower' | 'upper') => {
    const legs = h.links.filter((link) => link.id.startsWith(prefix))
    if (legs.length === 0) return null
    const inner = legs.reduce<V>((acc, link) => add(acc, scale(link.inboard, 1 / legs.length)), [0, 0, 0])
    const outer = legs.reduce<V>((acc, link) => add(acc, scale(link.outboard, 1 / legs.length)), [0, 0, 0])
    return [project(inner), project(outer)] as const
  }
  const lower = arm('lower'), upper = arm('upper')
  if (!lower || !upper) return null
  const contact: [number, number] = [h.wheelCentre[2], h.wheelCentre[1] - h.tyreRadius]
  const intersect = (a: readonly [[number, number], [number, number]], b: readonly [[number, number], [number, number]]): [number, number] | null => {
    const [p, p2] = a, [q, q2] = b
    const r: [number, number] = [p2[0] - p[0], p2[1] - p[1]], s: [number, number] = [q2[0] - q[0], q2[1] - q[1]]
    const denom = r[0] * s[1] - r[1] * s[0]
    if (Math.abs(denom) < 1e-12) return null
    const t = ((q[0] - p[0]) * s[1] - (q[1] - p[1]) * s[0]) / denom
    return [p[0] + t * r[0], p[1] + t * r[1]]
  }
  const ic = intersect(lower, upper)
  // Parallel arms: the instant centre is at infinity along the arm direction.
  const direction: [number, number] = ic ? [ic[0] - contact[0], ic[1] - contact[1]] : [lower[1][0] - lower[0][0], lower[1][1] - lower[0][1]]
  if (Math.abs(direction[0]) < 1e-12) return null
  const t = (0 - contact[0]) / direction[0]
  return contact[1] + t * direction[1] - contact[1]
}

export type SpringDamperInputs = { springRate: Quantity; rockerRatio: Quantity; damperCoefficient: Quantity; cornerMass: Quantity }

export type KinematicSummary = {
  staticState: CornerState | null
  camberGain: Result<number>
  toeGain: Result<number>
  motionRatio: Result<number>
  rollCentre: Result<number>
  installationRatio: Result<number>
  wheelRate: Result<number>
  rideFrequency: Result<number>
  dampingRatio: Result<number>
}

/**
 * Static kinematic outputs plus spring/damper rates. Geometry-derived values take the hardpoint set's
 * provenance; rates also need the spring, rocker, damper and corner-mass inputs.
 */
export function summarise(h: CornerHardpoints, geometry: Provenance, inputs: SpringDamperInputs): KinematicSummary {
  const staticState = solveCorner(h, 0)
  const kinematic = ['Rigid links and upright; no compliance', 'Travel is vertical wheel-centre displacement with the chassis fixed']
  const camber = slopeAtStatic(h, (s) => s.camberDeg), toe = slopeAtStatic(h, (s) => s.toeDeg), mr = slopeAtStatic(h, (s) => s.actuationLength)
  const rc = rollCentreHeight(h)
  const g = [geometry]
  const motionRatio = result(mr === null ? null : Math.abs(mr), 'ratio', g, [], [...kinematic, 'Actuation-rod length change per unit wheel travel at static, with the rocker pickup held fixed'])
  const missingOf = (entries: [string, Quantity][]) => entries.filter(([, q]) => !isKnown(q)).map(([key]) => key)
  const irMissing = missingOf([['rockerRatio', inputs.rockerRatio]])
  const installation = irMissing.length || motionRatio.value === null ? null : motionRatio.value * inputs.rockerRatio.value!
  const installationRatio = result(installation, 'ratio', [geometry, inputs.rockerRatio.provenance], irMissing, ['Installation ratio = push/pull-rod motion ratio × rocker ratio (spring travel per rod travel), linearised at static'])
  const rateMissing = [...irMissing, ...missingOf([['springRate', inputs.springRate]])]
  const wheelRateValue = installation !== null && isKnown(inputs.springRate) ? inputs.springRate.value * installation * installation : null
  const wheelRate = result(wheelRateValue, 'N/mm', [geometry, inputs.rockerRatio.provenance, inputs.springRate.provenance], rateMissing, ['Wheel rate = spring rate × installation ratio²'])
  const freqMissing = [...rateMissing, ...missingOf([['cornerMass', inputs.cornerMass]])]
  const freq = wheelRateValue !== null && isKnown(inputs.cornerMass) && inputs.cornerMass.value > 0 ? Math.sqrt(wheelRateValue * 1000 / inputs.cornerMass.value) / (2 * Math.PI) : null
  const rideFrequency = result(freq, 'Hz', [geometry, inputs.rockerRatio.provenance, inputs.springRate.provenance, inputs.cornerMass.provenance], freqMissing, ['Ride frequency from wheel rate and sprung corner mass; tyre stiffness ignored'])
  const dampMissing = [...freqMissing, ...missingOf([['damperCoefficient', inputs.damperCoefficient]])]
  const ratio = freq !== null && installation !== null && isKnown(inputs.damperCoefficient) ? inputs.damperCoefficient.value * installation * installation / (2 * Math.sqrt(wheelRateValue! * 1000 * inputs.cornerMass.value!)) : null
  const dampingRatio = result(ratio, 'ratio', [geometry, inputs.rockerRatio.provenance, inputs.springRate.provenance, inputs.cornerMass.provenance, inputs.damperCoefficient.provenance], dampMissing, ['Linear damper; damping ratio = c × IR² / (2√(k_wheel × m_corner))'])
  return {
    staticState,
    camberGain: result(camber, 'deg/su', g, [], kinematic),
    toeGain: result(toe, 'deg/su', g, [], kinematic),
    motionRatio,
    rollCentre: result(rc, 'su', g, [], [...kinematic, 'Front-view roll centre from the arm instant centre; symmetric left/right geometry assumed; contact patch directly below the wheel centre']),
    installationRatio, wheelRate, rideFrequency, dampingRatio,
  }
}
