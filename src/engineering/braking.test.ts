import { describe, expect, it } from 'vitest'
import { analyseBraking, biasSweep, createStudy, distanceSensitivity, emptyBrakingInputs, G, illustrativeBrakingInputs, idealBias, reproduceStudy, speedSweep, type BrakingInputs } from './braking'
import { quantity, unknown } from './quantity'

const src = (value: number, unit: string) => quantity(value, unit, 'SOURCED', { source: 'test fixture' })
/** Fully SOURCED vehicle without aero; bias set to the ideal value at z = μ. */
function vehicle(overrides: Partial<Record<keyof BrakingInputs, number>> = {}): BrakingInputs {
  const v = { mass: 800, wheelbase: 3.6, frontWeightFraction: 0.45, cogHeight: 0.3, mu: 1.5, tyreRadius: 0.36, speed: 200, reactionTime: 0.2, rotorMass: 1.2, rotorSpecificHeat: 800, rotorEnergyShare: 0.8, ...overrides }
  const bias = overrides.brakeBias ?? idealBias({ f: v.frontWeightFraction, h: v.cogHeight, L: v.wheelbase }, v.mu)
  const inputs = emptyBrakingInputs()
  for (const [key, value] of Object.entries({ ...v, brakeBias: bias })) inputs[key as keyof BrakingInputs] = src(value, inputs[key as keyof BrakingInputs].unit)
  return inputs
}

describe('braking: constant model', () => {
  it('at the ideal bias both axles reach μ together, so deceleration equals μ', () => {
    const report = analyseBraking(vehicle())
    expect(report.model).toBe('constant')
    expect(report.decelG.value).toBeCloseTo(1.5, 10)
    expect(report.brakingDistance.value).toBeCloseTo((200 / 3.6) ** 2 / (2 * 1.5 * G), 8)
    expect(report.decelG.provenance).toBe('DERIVED')
  })

  it('off-ideal bias loses deceleration and names the axle that locks first', () => {
    const front = analyseBraking(vehicle({ brakeBias: 0.75 })), rear = analyseBraking(vehicle({ brakeBias: 0.4 }))
    expect(front.limitingAxle).toBe('front')
    expect(rear.limitingAxle).toBe('rear')
    // Closed form: front locks at z = μ f / (β − μ h / L)
    expect(front.decelG.value).toBeCloseTo(1.5 * 0.45 / (0.75 - 1.5 * 0.3 / 3.6), 10)
    // Rear locks at z = μ (1 − f) / ((1 − β) + μ h / L)
    expect(rear.decelG.value).toBeCloseTo(1.5 * 0.55 / (0.6 + 1.5 * 0.3 / 3.6), 10)
  })

  it('load transfer is m·g·z·h/L and axle loads sum to the weight', () => {
    const r = analyseBraking(vehicle())
    expect(r.loadTransfer.value).toBeCloseTo(800 * G * 1.5 * 0.3 / 3.6, 6)
    expect(r.frontLoad.value! + r.rearLoad.value!).toBeCloseTo(800 * G, 6)
  })

  it('rotor temperature rise = bias × KE × share / 2 / (m c), and stopping distance adds reaction travel', () => {
    const r = analyseBraking(vehicle())
    const v = 200 / 3.6, beta = idealBias({ f: 0.45, h: 0.3, L: 3.6 }, 1.5)
    expect(r.rotorTemperatureRise.value).toBeCloseTo(beta * 0.5 * 800 * v * v * 0.8 / 2 / (1.2 * 800), 6)
    expect(r.stoppingDistance.value! - r.brakingDistance.value!).toBeCloseTo(v * 0.2, 9)
  })

  it('distance elasticity is exactly +2 for speed and 0 for mass without aero (d = v² / 2zg, z independent of m)', () => {
    const sensitivity = Object.fromEntries(distanceSensitivity(vehicle({ brakeBias: 0.5 })).map((s) => [s.key, s.elasticity]))
    expect(sensitivity.speed).toBeCloseTo(2, 3)
    expect(sensitivity.mass ?? 0).toBeCloseTo(0, 6)
  })

  it('peaks at the ideal bias in a bias sweep', () => {
    const sweep = biasSweep(vehicle(), 0.4, 0.8, 401)
    expect(sweep.ideal).toBeCloseTo(idealBias({ f: 0.45, h: 0.3, L: 3.6 }, 1.5), 2)
  })

  it('reports missing inputs instead of numbers', () => {
    const inputs = vehicle(); inputs.speed = unknown('km/h')
    const r = analyseBraking(inputs)
    expect(r.brakingDistance).toMatchObject({ value: null, missing: ['speed'] })
    expect(r.decelG.value).not.toBeNull()
    expect(analyseBraking(emptyBrakingInputs()).decelG.missing).toContain('mass')
  })
})

describe('braking: aero model', () => {
  const withAero = (clA: number, cdA: number) => {
    const inputs = vehicle({ brakeBias: 0.56 })
    inputs.clA = src(clA, 'm²'); inputs.cdA = src(cdA, 'm²'); inputs.airDensity = src(1.2, 'kg/m³'); inputs.aeroBalance = src(0.42, 'fraction')
    return inputs
  }
  it('with zero aero coefficients reproduces the constant model', () => {
    const aero = analyseBraking(withAero(0, 0)), constant = analyseBraking(vehicle({ brakeBias: 0.56 }))
    expect(aero.model).toBe('aero')
    expect(aero.brakingDistance.value).toBeCloseTo(constant.brakingDistance.value!, 4)
    expect(aero.stopTime.value).toBeCloseTo(constant.stopTime.value!, 4)
  })
  it('downforce and drag each shorten the stop, and drag work leaves less heat for the rotors', () => {
    const base = analyseBraking(withAero(0, 0)), down = analyseBraking(withAero(4, 0)), drag = analyseBraking(withAero(0, 1.2))
    expect(down.brakingDistance.value!).toBeLessThan(base.brakingDistance.value!)
    expect(drag.brakingDistance.value!).toBeLessThan(base.brakingDistance.value!)
    expect(drag.rotorTemperatureRise.value!).toBeLessThan(base.rotorTemperatureRise.value!)
    expect(down.decelG.value!).toBeGreaterThan(base.decelG.value!)
  })
  it('falls back to the constant model when any aero input is unknown, and says so', () => {
    const inputs = withAero(4, 1.2); inputs.airDensity = unknown('kg/m³')
    const r = analyseBraking(inputs)
    expect(r.model).toBe('constant')
    expect(r.decelG.assumptions.some((a) => a.includes('aerodynamic forces ignored'))).toBe(true)
  })
  it('the illustrative preset runs end to end, labelled ILLUSTRATIVE', () => {
    const r = analyseBraking(illustrativeBrakingInputs())
    expect(r.model).toBe('aero')
    expect(r.brakingDistance.provenance).toBe('ILLUSTRATIVE')
    expect(speedSweep(illustrativeBrakingInputs()).distance.every((d) => d !== null && d > 0)).toBe(true)
  })
})

describe('reproducible studies', () => {
  it('a saved study reproduces exactly, survives JSON, and detects tampering or a model change', () => {
    const study = createStudy('Bias check', illustrativeBrakingInputs(), '2026-11-09T00:00:00Z')
    expect(reproduceStudy(JSON.parse(JSON.stringify(study)))).toMatchObject({ reproducible: true, differences: [] })
    const tampered = structuredClone(study); tampered.outputs.brakingDistance.value! *= 0.9
    expect(reproduceStudy(tampered)).toMatchObject({ reproducible: false, differences: ['brakingDistance'] })
    const otherModel = { ...structuredClone(study), model: { id: 'telaio.braking', version: '0.9.0' } } as unknown as typeof study
    expect(reproduceStudy(otherModel)).toMatchObject({ reproducible: false, modelMatches: false })
  })
})
