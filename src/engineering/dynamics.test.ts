import { describe, expect, it } from 'vitest'
import { accelerationLimit, analyseDynamics, compareLaps, corneringSpeed, coreOf, G, handling, illustrativeTrack, illustrativeVehicle, parameterSweep, simulateLap, topSpeed, tyreLateralForce, validateTrack, type Core, type Track, type VehicleConfig } from './dynamics'
import { quantity, unknown } from './quantity'

const base: Core = { m: 800, L: 3.6, f: 0.45, h: 0.3, P: 1e9, eta: 1, mu: 1.5, crr: 0, clA: 0, cdA: 0, rho: 1.2 }
const src = (value: number, unit: string) => quantity(value, unit, 'SOURCED', { source: 'test' })

describe('longitudinal and lateral limits', () => {
  it('traction-limited standing start covers d in √(2d/a), a = μg(1−f)/(1−μh/L)', () => {
    const a = 1.5 * G * 0.55 / (1 - 1.5 * 0.3 / 3.6)
    expect(accelerationLimit(base, 20)).toBeCloseTo(a, 9)
    const lap = simulateLap(base, { name: 'drag strip', provenance: 'SOURCED', segments: [{ name: 'strip', length: 400, radius: 0 }] }, 0.5, true)
    expect(lap.lapTime).toBeCloseTo(Math.sqrt(2 * 400 / a), 2)
  })

  it('a constant-radius circle without aero laps at √(μgR)', () => {
    const R = 50, v = Math.sqrt(1.5 * G * R)
    expect(corneringSpeed({ ...base, P: 5e5, cdA: 0.01 }, R)).toBeCloseTo(v, 9)
    const lap = simulateLap({ ...base, P: 5e5, cdA: 0.01 }, { name: 'skidpad', provenance: 'SOURCED', segments: [{ name: 'circle', length: 2 * Math.PI * R, radius: R }] }, 1)
    expect(lap.lapTime).toBeCloseTo(2 * Math.PI * R / v, 6)
  })

  it('top speed without rolling resistance is ∛(2Pη / ρCdA)', () => {
    const c = { ...base, P: 600000, eta: 0.9, cdA: 1.1 }
    expect(topSpeed(c)).toBeCloseTo(Math.cbrt(2 * 600000 * 0.9 / (1.2 * 1.1)), 6)
  })

  it('downforce raises the cornering limit, and enough of it makes grip exceed demand at any speed', () => {
    const aero = { ...base, P: 7e5, cdA: 1.2, clA: 4 }
    expect(corneringSpeed(aero, 100)).toBeGreaterThan(corneringSpeed({ ...aero, clA: 0 }, 100))
    expect(corneringSpeed(aero, 10000)).toBeCloseTo(topSpeed(aero), 6)
  })
})

describe('tyre and handling', () => {
  it('the tyre curve starts at the cornering stiffness and peaks at μFz', () => {
    const slope = tyreLateralForce(1e-6, 4000, 1.6, 90000) / 1e-6
    expect(slope).toBeCloseTo(90000, -1)
    const peak = Math.max(...Array.from({ length: 400 }, (_, i) => tyreLateralForce(i * 0.001, 4000, 1.6, 90000)))
    expect(peak).toBeCloseTo(1.6 * 4000, 0)
  })

  const car = (Cf: number, Cr: number, Iz = 1000): VehicleConfig => ({ ...illustrativeVehicle(), mass: src(800, 'kg'), wheelbase: src(3.6, 'm'), frontWeightFraction: src(0.45, 'fraction'), corneringStiffnessFront: src(Cf, 'N/rad'), corneringStiffnessRear: src(Cr, 'N/rad'), yawInertia: src(Iz, 'kg·m²') })
  it('neutral steer (b/Cf = a/Cr) has zero understeer gradient and yaw-rate gain v/L', () => {
    const a = 3.6 * 0.55, b = 3.6 * 0.45, Cf = 200000, Cr = Cf * a / b
    const h = handling(car(Cf, Cr), 50)
    expect(h.understeerGradient.value).toBeCloseTo(0, 9)
    expect(h.yawRateGain.value).toBeCloseTo(50 / 3.6, 9)
    expect(h.understeerGradient.provenance).toBe('DERIVED')
  })

  it('an understeering car has characteristic speed √(L/K) and is stable', () => {
    const h = handling(car(120000, 300000), 60)
    const K = (800 / 3.6) * (3.6 * 0.45 / 120000 - 3.6 * 0.55 / 300000)
    expect(h.characteristicSpeed.value).toBeCloseTo(Math.sqrt(3.6 / K) * 3.6, 6)
    expect(h.stable).toBe(true)
    expect(h.yawDamping.value).toBeGreaterThan(0)
  })

  it('an oversteering car has a critical speed and the yaw mode goes unstable above it', () => {
    const over = car(300000, 100000)
    const crit = handling(over, 20).criticalSpeed.value! / 3.6
    expect(handling(over, crit * 0.8).stable).toBe(true)
    expect(handling(over, crit * 1.2).stable).toBe(false)
  })

  it('needs yaw inertia for the transient yaw mode', () => {
    const h = handling({ ...car(150000, 250000), yawInertia: unknown('kg·m²') }, 50)
    expect(h.yawNaturalFrequency).toMatchObject({ value: null, missing: ['yawInertia'] })
    expect(h.understeerGradient.value).not.toBeNull()
  })
})

describe('lap simulation', () => {
  const track = illustrativeTrack()
  const { core } = coreOf(illustrativeVehicle())

  it('runs the illustrative car on the invented loop, deterministically, labelled ILLUSTRATIVE', () => {
    const r = analyseDynamics(illustrativeVehicle(), track)
    expect(r.lap.provenance).toBe('ILLUSTRATIVE')
    expect(r.lap.value!.lapTime).toBeGreaterThan(20)
    expect(analyseDynamics(illustrativeVehicle(), track).lap.value).toEqual(r.lap.value)
    expect(r.lap.value!.speed.every((v, i) => v <= r.lap.value!.limit[i] + 1e-6)).toBe(true)
  })

  it('closes the lap: finish speed equals start speed', () => {
    const lap = simulateLap(core!, track)
    expect(lap.speed[lap.speed.length - 1]).toBeCloseTo(lap.speed[0], 4)
  })

  it('downforce without extra drag is faster; drag without extra downforce is slower', () => {
    const t = (c: Core) => simulateLap(c, track).lapTime
    expect(t({ ...core!, clA: core!.clA + 1 })).toBeLessThan(t(core!))
    expect(t({ ...core!, cdA: core!.cdA + 0.3 })).toBeGreaterThan(t(core!))
  })

  it('compares configurations segment by segment, summing to the lap delta', () => {
    const a = simulateLap(core!, track), b = simulateLap({ ...core!, m: core!.m + 50 }, track)
    const cmp = compareLaps(a, b)
    expect(cmp.lapDelta).toBeGreaterThan(0)
    expect(cmp.segments.reduce((s, x) => s + x.delta, 0)).toBeCloseTo(cmp.lapDelta, 9)
  })

  it('a ClA sweep finds an optimum where drag cost balances grip gain', () => {
    const v = illustrativeVehicle()
    const sweep = parameterSweep({ ...v, cdA: { ...v.cdA, value: 1.2 } }, track, 'clA', 0, 8, 17)
    expect(sweep.best).not.toBeNull()
    expect(sweep.times.every((t) => t !== null)).toBe(true)
  })

  it('validates tracks and reports missing inputs', () => {
    const bad: Track = { name: 'x', provenance: 'ESTIMATED', segments: [{ name: 'a', length: -1, radius: 2 }] }
    expect(validateTrack(bad)).toHaveLength(2)
    expect(analyseDynamics({ ...illustrativeVehicle(), power: unknown('kW') }, track).lap).toMatchObject({ value: null, missing: ['power'] })
  })
})
