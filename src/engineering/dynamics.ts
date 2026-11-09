/**
 * Vehicle dynamics laboratory. SI units. Models, in increasing scope:
 *  - Longitudinal: traction-, power- and drag-limited acceleration; braking at ideal bias; top speed.
 *  - Lateral: steady cornering limit of a point mass with downforce; lateral load transfer.
 *  - Tyre: magic-formula-style lateral force curve, fitted to peak μ and cornering stiffness.
 *  - Linear single-track (bicycle) model: understeer gradient, characteristic/critical speed, yaw-rate
 *    gain, and the yaw-mode eigenvalues (natural frequency, damping) from the 2-state model.
 *  - Quasi-steady lap simulation: speed limit per track point from cornering grip, then forward
 *    (acceleration) and backward (braking) passes under a friction ellipse; closed lap by iteration.
 *
 * Rear-wheel drive. A point-mass lap model: no transient handling, gears, tyre temperature or energy
 * deployment. Every result carries the provenance of the inputs it used.
 */
import { gather, isKnown, result, type Provenance, type Quantity, type Result } from './quantity'

export const G = 9.80665
export const DYNAMICS_MODEL = { id: 'telaio.dynamics', version: '1.0.0' } as const

export type VehicleConfig = {
  name: string
  mass: Quantity; wheelbase: Quantity; frontWeightFraction: Quantity; cogHeight: Quantity; track: Quantity
  power: Quantity; drivelineEfficiency: Quantity; mu: Quantity; rollingResistance: Quantity
  clA: Quantity; cdA: Quantity; airDensity: Quantity
  corneringStiffnessFront: Quantity; corneringStiffnessRear: Quantity; yawInertia: Quantity
}

export const VEHICLE_SPECS: { key: Exclude<keyof VehicleConfig, 'name'>; label: string; unit: string; group: string }[] = [
  { key: 'mass', label: 'Mass (with driver)', unit: 'kg', group: 'Mass & geometry' },
  { key: 'frontWeightFraction', label: 'Static front weight fraction', unit: 'fraction', group: 'Mass & geometry' },
  { key: 'cogHeight', label: 'CoG height', unit: 'm', group: 'Mass & geometry' },
  { key: 'wheelbase', label: 'Wheelbase', unit: 'm', group: 'Mass & geometry' },
  { key: 'track', label: 'Average track width', unit: 'm', group: 'Mass & geometry' },
  { key: 'yawInertia', label: 'Yaw inertia Iz', unit: 'kg·m²', group: 'Mass & geometry' },
  { key: 'power', label: 'Peak power at the wheels before losses', unit: 'kW', group: 'Powertrain' },
  { key: 'drivelineEfficiency', label: 'Driveline efficiency', unit: 'fraction', group: 'Powertrain' },
  { key: 'mu', label: 'Peak tyre friction μ', unit: '–', group: 'Tyres' },
  { key: 'corneringStiffnessFront', label: 'Front axle cornering stiffness', unit: 'N/rad', group: 'Tyres' },
  { key: 'corneringStiffnessRear', label: 'Rear axle cornering stiffness', unit: 'N/rad', group: 'Tyres' },
  { key: 'rollingResistance', label: 'Rolling resistance coefficient', unit: '–', group: 'Tyres' },
  { key: 'clA', label: 'ClA', unit: 'm²', group: 'Aero' },
  { key: 'cdA', label: 'CdA', unit: 'm²', group: 'Aero' },
  { key: 'airDensity', label: 'Air density', unit: 'kg/m³', group: 'Aero' },
]

export const emptyVehicle = (name = 'Configuration'): VehicleConfig => ({ name, ...Object.fromEntries(VEHICLE_SPECS.map((s) => [s.key, { value: null, unit: s.unit, provenance: 'UNKNOWN' }])) } as VehicleConfig)

/** Numeric core used by the point-mass models. */
export type Core = { m: number; L: number; f: number; h: number; P: number; eta: number; mu: number; crr: number; clA: number; cdA: number; rho: number }
const CORE_KEYS = ['mass', 'wheelbase', 'frontWeightFraction', 'cogHeight', 'power', 'drivelineEfficiency', 'mu', 'rollingResistance', 'clA', 'cdA', 'airDensity'] as const

export function coreOf(v: VehicleConfig): { core: Core | null; provenances: Provenance[]; missing: string[] } {
  const g = gather(Object.fromEntries(CORE_KEYS.map((k) => [k, v[k]])) as Record<(typeof CORE_KEYS)[number], Quantity>)
  if (g.missing.length) return { core: null, provenances: g.provenances, missing: g.missing }
  const x = g.values
  const valid = x.mass > 0 && x.wheelbase > 0 && x.frontWeightFraction > 0 && x.frontWeightFraction < 1 && x.cogHeight >= 0 && x.power > 0 && x.drivelineEfficiency > 0 && x.drivelineEfficiency <= 1 && x.mu > 0 && x.cdA >= 0 && x.airDensity > 0
  if (!valid) return { core: null, provenances: g.provenances, missing: ['valid ranges'] }
  return { core: { m: x.mass, L: x.wheelbase, f: x.frontWeightFraction, h: x.cogHeight, P: x.power * 1000, eta: x.drivelineEfficiency, mu: x.mu, crr: x.rollingResistance, clA: x.clA, cdA: x.cdA, rho: x.airDensity }, provenances: g.provenances, missing: [] }
}

const q = (c: Core, v: number) => 0.5 * c.rho * v * v
const resistance = (c: Core, v: number) => q(c, v) * c.cdA + c.crr * (c.m * G + q(c, v) * c.clA)

/** Maximum lateral acceleration at speed v (point mass, downforce adds grip). */
export const lateralLimit = (c: Core, v: number) => c.mu * (c.m * G + q(c, v) * c.clA) / c.m

/** Forward acceleration available at speed v with no lateral demand: min(traction, power) minus resistance. */
export function accelerationLimit(c: Core, v: number): number {
  // Rear-wheel drive: Fx ≤ μ (m g (1−f) + downforce share + Fx h / L) ⇒ Fx ≤ μ N_r0 / (1 − μ h / L). Downforce split ∝ weight here.
  const nRear0 = (c.m * G + q(c, v) * c.clA) * (1 - c.f)
  const traction = c.mu * c.h / c.L < 1 ? c.mu * nRear0 / (1 - c.mu * c.h / c.L) : Infinity
  const power = v > 0.1 ? c.P * c.eta / v : Infinity
  return (Math.min(traction, power) - resistance(c, v)) / c.m
}

/** Braking deceleration at speed v at ideal bias (all four tyres at μ), plus resistance. */
export const brakingLimit = (c: Core, v: number) => (c.mu * (c.m * G + q(c, v) * c.clA) + resistance(c, v)) / c.m

/** Top speed: where power-limited drive force equals resistance. Bisection. */
export function topSpeed(c: Core): number {
  let lo = 1, hi = 200
  if (c.P * c.eta / hi > resistance(c, hi)) return hi
  for (let i = 0; i < 100; i++) { const mid = (lo + hi) / 2; if (c.P * c.eta / mid > resistance(c, mid)) lo = mid; else hi = mid }
  return (lo + hi) / 2
}

/** Steady cornering speed limit at radius R: m v²/R = μ(m g + ½ρv² ClA), capped at top speed. */
export function corneringSpeed(c: Core, radius: number): number {
  const denom = 1 - c.mu * c.rho * c.clA * radius / (2 * c.m)
  const vTop = topSpeed(c)
  if (denom <= 0) return vTop
  return Math.min(vTop, Math.sqrt(c.mu * G * radius / denom))
}

/** Time and distance to reach `target` m/s from rest, straight line, by integration in time. */
export function accelerationRun(c: Core, target: number, dt = 0.001): { time: number; distance: number } | null {
  let v = 0, x = 0, t = 0
  while (v < target) {
    const a = accelerationLimit(c, v)
    if (a <= 1e-6 || t > 120) return null
    v += a * dt; x += v * dt; t += dt
  }
  return { time: t, distance: x }
}

/** Magic-formula-style lateral force Fy(α) = μFz·sin(C·atan(Bα)), with B from cornering stiffness. */
export function tyreLateralForce(alphaRad: number, fz: number, mu: number, axleStiffness: number, shape = 1.3): number {
  const B = axleStiffness / (shape * mu * fz)
  return mu * fz * Math.sin(shape * Math.atan(B * alphaRad))
}

export type HandlingReport = {
  understeerGradient: Result<number>; characteristicSpeed: Result<number>; criticalSpeed: Result<number>
  yawRateGain: Result<number>; yawNaturalFrequency: Result<number>; yawDamping: Result<number>; stable: boolean | null
}

/** Linear single-track model at speed v (m/s). Axle cornering stiffnesses in N/rad (both tyres). */
export function handling(v: VehicleConfig, speed: number): HandlingReport {
  const g = gather({ mass: v.mass, wheelbase: v.wheelbase, frontWeightFraction: v.frontWeightFraction, corneringStiffnessFront: v.corneringStiffnessFront, corneringStiffnessRear: v.corneringStiffnessRear })
  const assumptions = ['Linear single-track model: small angles, linear tyres, constant speed, no load transfer or aero in the handling terms']
  const r = (value: number | null, unit: string, extra: Quantity[] = [], extraMissing: string[] = []) => result(value, unit, [...g.provenances, ...extra.map((x) => x.provenance)], [...g.missing, ...extraMissing], assumptions)
  if (g.missing.length) return { understeerGradient: r(null, 'deg/g'), characteristicSpeed: r(null, 'km/h'), criticalSpeed: r(null, 'km/h'), yawRateGain: r(null, '1/s'), yawNaturalFrequency: r(null, 'Hz', [], ['yawInertia']), yawDamping: r(null, 'ratio', [], ['yawInertia']), stable: null }
  const { mass: m, wheelbase: L, frontWeightFraction: f, corneringStiffnessFront: Cf, corneringStiffnessRear: Cr } = g.values
  const a = L * (1 - f), b = L * f // CoG to front axle, CoG to rear axle
  const K = (m / L) * (b / Cf - a / Cr) // rad per m/s²
  const Kdeg = K * G * 180 / Math.PI
  const gain = speed / (L + K * speed * speed)
  let wn: number | null = null, zeta: number | null = null, stable: boolean | null = null
  const Iz = isKnown(v.yawInertia) && v.yawInertia.value > 0 ? v.yawInertia.value : null
  if (Iz && speed > 0.5) {
    // States [β, r]: A = [[−(Cf+Cr)/(m u), (b Cr − a Cf)/(m u²) − 1], [(b Cr − a Cf)/Iz, −(a² Cf + b² Cr)/(Iz u)]]
    const u = speed
    const A11 = -(Cf + Cr) / (m * u), A12 = (b * Cr - a * Cf) / (m * u * u) - 1, A21 = (b * Cr - a * Cf) / Iz, A22 = -(a * a * Cf + b * b * Cr) / (Iz * u)
    const trace = A11 + A22, det = A11 * A22 - A12 * A21
    stable = trace < 0 && det > 0
    if (det > 0) { wn = Math.sqrt(det) / (2 * Math.PI); zeta = -trace / (2 * Math.sqrt(det)) }
  }
  return {
    understeerGradient: r(Kdeg, 'deg/g'),
    characteristicSpeed: r(K > 1e-12 ? Math.sqrt(L / K) * 3.6 : null, 'km/h', [], K > 1e-12 ? [] : ['understeering car (K > 0)']),
    criticalSpeed: r(K < -1e-12 ? Math.sqrt(-L / K) * 3.6 : null, 'km/h', [], K < -1e-12 ? [] : ['oversteering car (K < 0)']),
    yawRateGain: r(Number.isFinite(gain) && gain > 0 ? gain : null, '1/s', [], Number.isFinite(gain) && gain > 0 ? [] : ['speed below critical speed']),
    yawNaturalFrequency: r(wn, 'Hz', [v.yawInertia], Iz ? [] : ['yawInertia']),
    yawDamping: r(zeta, 'ratio', [v.yawInertia], Iz ? [] : ['yawInertia']),
    stable,
  }
}

export type TrackSegment = { name: string; length: number; radius: number } // radius 0 = straight
export type Track = { name: string; segments: TrackSegment[]; provenance: Provenance; note?: string }

export type LapResult = {
  lapTime: number; distance: number[]; speed: number[]; limit: number[]
  segmentTimes: { name: string; time: number; minSpeed: number; maxSpeed: number }[]
  maxSpeed: number; fullThrottleFraction: number; iterations: number
}

/**
 * Quasi-steady lap: v ≤ cornering limit at every point; accelerate forward and brake backward under a
 * friction ellipse (longitudinal grip scaled by √(1 − (ay / ay,max)²)). Closed lap: the start speed is
 * iterated to equal the finish speed. `standingStart` instead starts from rest (open run).
 */
export function simulateLap(c: Core, track: Track, ds = 2, standingStart = false): LapResult {
  const points: { kappa: number; segment: number }[] = []
  track.segments.forEach((segment, index) => {
    const n = Math.max(1, Math.round(segment.length / ds))
    for (let i = 0; i < n; i++) points.push({ kappa: segment.radius > 0 ? 1 / segment.radius : 0, segment: index })
  })
  const step = track.segments.map((s) => s.length / Math.max(1, Math.round(s.length / ds)))
  const n = points.length
  const vTop = topSpeed(c)
  const limit = points.map((p) => p.kappa > 0 ? corneringSpeed(c, 1 / p.kappa) : vTop)
  const ellipse = (v: number, kappa: number) => { const ay = v * v * kappa, ayMax = lateralLimit(c, v); return ayMax > 0 ? Math.sqrt(Math.max(0, 1 - (ay / ayMax) ** 2)) : 0 }
  let startSpeed = standingStart ? 0 : Math.min(...limit)
  let speed: number[] = []
  let throttle = 0, iterations = 0
  for (; iterations < 20; iterations++) {
    const forward = new Array<number>(n + 1)
    forward[0] = startSpeed
    let onThrottle = 0
    for (let i = 0; i < n; i++) {
      const v = Math.min(forward[i], limit[i])
      const a = Math.max(0, accelerationLimit(c, v)) * ellipse(v, points[i].kappa)
      forward[i + 1] = Math.min(Math.sqrt(v * v + 2 * a * step[points[i].segment]), i + 1 < n ? limit[i + 1] : Infinity)
      if (forward[i + 1] > v + 1e-9 && forward[i + 1] < (i + 1 < n ? limit[i + 1] : Infinity) - 1e-9) onThrottle++
    }
    const backward = new Array<number>(n + 1)
    backward[n] = standingStart ? Infinity : forward[n]
    for (let i = n - 1; i >= 0; i--) {
      const v = Math.min(backward[i + 1], limit[i])
      const d = brakingLimit(c, v) * ellipse(v, points[i].kappa)
      backward[i] = Math.sqrt(v * v + 2 * d * step[points[i].segment])
    }
    speed = Array.from({ length: n + 1 }, (_, i) => Math.min(forward[i], backward[i], i < n ? limit[i] : Infinity))
    throttle = onThrottle / n
    if (standingStart || Math.abs(speed[n] - startSpeed) < 1e-6) break
    startSpeed = speed[n]
  }
  let lapTime = 0
  const distance = [0]
  const segmentTimes = track.segments.map((s) => ({ name: s.name, time: 0, minSpeed: Infinity, maxSpeed: 0 }))
  for (let i = 0; i < n; i++) {
    const h = step[points[i].segment], vAvg = (speed[i] + speed[i + 1]) / 2
    const dt = vAvg > 1e-9 ? h / vAvg : Infinity
    lapTime += dt; distance.push(distance[i] + h)
    const s = segmentTimes[points[i].segment]
    s.time += dt; s.minSpeed = Math.min(s.minSpeed, speed[i]); s.maxSpeed = Math.max(s.maxSpeed, speed[i + 1])
  }
  return { lapTime, distance, speed, limit: [...limit, limit[n - 1]], segmentTimes, maxSpeed: Math.max(...speed), fullThrottleFraction: throttle, iterations: iterations + 1 }
}

export type DynamicsReport = {
  topSpeed: Result<number>; zeroTo100: Result<number>; zeroTo200: Result<number>
  peakLateral: Result<number>; lateralAt200: Result<number>; lateralTransferAt1g: Result<number>
  brakingAt200: Result<number>; lap: Result<LapResult>; handling: HandlingReport
}

export function analyseDynamics(v: VehicleConfig, track: Track | null, handlingSpeedKmh = 150): DynamicsReport {
  const { core, provenances, missing } = coreOf(v)
  const assumptions = ['Point-mass, rear-wheel drive, single peak μ; downforce adds grip in proportion; no gears, tyre temperature or energy deployment']
  const r = <T,>(value: T | null, unit: string, extra: Quantity[] = [], extraMissing: string[] = [], more: string[] = []) => result(value, unit, [...provenances, ...extra.map((x) => x.provenance)], [...missing, ...extraMissing], [...assumptions, ...more])
  const run = (kmh: number) => core ? accelerationRun(core, kmh / 3.6) : null
  const trackMissing = isKnown(v.track) ? [] : ['track']
  return {
    topSpeed: r(core ? topSpeed(core) * 3.6 : null, 'km/h'),
    zeroTo100: r(run(100)?.time ?? null, 's'),
    zeroTo200: r(run(200)?.time ?? null, 's'),
    peakLateral: r(core ? lateralLimit(core, topSpeed(core)) / G : null, 'g', [], [], ['At top speed']),
    lateralAt200: r(core ? lateralLimit(core, 200 / 3.6) / G : null, 'g'),
    lateralTransferAt1g: r(core && isKnown(v.track) ? core.m * G * core.h / v.track.value : null, 'N', [v.track], trackMissing, ['Total lateral load transfer at 1 g = m·g·h / track (both axles)']),
    brakingAt200: r(core ? brakingLimit(core, 200 / 3.6) / G : null, 'g', [], [], ['Ideal brake bias assumed']),
    lap: result(core && track ? simulateLap(core, track) : null, 's', [...provenances, ...(track ? [track.provenance] : [])], [...missing, ...(track ? [] : ['track layout'])],
      [...assumptions, 'Quasi-steady lap: friction-ellipse combined grip, ideal brake bias, closed lap iterated to a consistent start speed']),
    handling: handling(v, handlingSpeedKmh / 3.6),
  }
}

/** Lap time across a range of one parameter, holding everything else; returns the best value. */
export function parameterSweep(v: VehicleConfig, track: Track, key: Exclude<keyof VehicleConfig, 'name'>, from: number, to: number, steps = 21) {
  const values = Array.from({ length: steps }, (_, i) => from + (to - from) * i / (steps - 1))
  const times = values.map((x) => { const { core } = coreOf({ ...v, [key]: { ...v[key], value: x, provenance: v[key].provenance === 'UNKNOWN' ? 'ESTIMATED' : v[key].provenance } }); return core ? simulateLap(core, track).lapTime : null })
  const known = times.map((t, i) => [t, i] as const).filter((p): p is readonly [number, number] => p[0] !== null)
  const best = known.length ? known.reduce((b, p) => p[0] < b[0] ? p : b) : null
  return { values, times, best: best ? { value: values[best[1]], time: best[0] } : null }
}

/** Two-configuration comparison on the same track: lap and per-segment time deltas (B − A). */
export function compareLaps(a: LapResult, b: LapResult) {
  return { lapDelta: b.lapTime - a.lapTime, segments: a.segmentTimes.map((s, i) => ({ name: s.name, delta: b.segmentTimes[i].time - s.time })) }
}

/** Opt-in values of generic single-seater order: ILLUSTRATIVE, not SF-24 data. */
export function illustrativeVehicle(name = 'Illustrative single-seater (not real data)'): VehicleConfig {
  const note = 'Generic order-of-magnitude value for exploring the lab; not SF-24 or any real car data'
  const qv = (value: number, unit: string): Quantity => ({ value, unit, provenance: 'ILLUSTRATIVE', note })
  return {
    name, mass: qv(800, 'kg'), wheelbase: qv(3.6, 'm'), frontWeightFraction: qv(0.45, 'fraction'), cogHeight: qv(0.3, 'm'), track: qv(1.6, 'm'), yawInertia: qv(1000, 'kg·m²'),
    power: qv(700, 'kW'), drivelineEfficiency: qv(0.92, 'fraction'), mu: qv(1.6, '–'), corneringStiffnessFront: qv(180000, 'N/rad'), corneringStiffnessRear: qv(260000, 'N/rad'), rollingResistance: qv(0.015, '–'),
    clA: qv(4, 'm²'), cdA: qv(1.2, 'm²'), airDensity: qv(1.2, 'kg/m³'),
  }
}

/** Invented test loop (not a real circuit): ILLUSTRATIVE. */
export function illustrativeTrack(): Track {
  return {
    name: 'Illustrative test loop (invented, not a real circuit)', provenance: 'ILLUSTRATIVE', note: 'Invented layout for exercising the lap model',
    segments: [
      { name: 'Main straight', length: 900, radius: 0 }, { name: 'T1 hairpin', length: 60, radius: 18 },
      { name: 'Back straight', length: 650, radius: 0 }, { name: 'T2 fast sweeper', length: 380, radius: 260 },
      { name: 'Short straight', length: 240, radius: 0 }, { name: 'T3 medium', length: 140, radius: 70 },
      { name: 'Link', length: 160, radius: 0 }, { name: 'T4 chicane left', length: 45, radius: 35 }, { name: 'T4 chicane right', length: 45, radius: 35 },
      { name: 'Run to the line', length: 520, radius: 0 }, { name: 'T5 final corner', length: 210, radius: 110 },
    ],
  }
}

export function validateTrack(track: Track): string[] {
  const errors: string[] = []
  if (!track.segments.length) errors.push('Track has no segments')
  track.segments.forEach((s, i) => {
    if (!(s.length > 0)) errors.push(`Segment ${i + 1} (${s.name}): length must be positive`)
    if (!(s.radius >= 0) || (s.radius > 0 && s.radius < 5)) errors.push(`Segment ${i + 1} (${s.name}): radius must be 0 (straight) or at least 5 m`)
  })
  return errors
}
