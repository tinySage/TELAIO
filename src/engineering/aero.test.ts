import { describe, expect, it } from 'vitest'
import { aeroForBraking, aeroMapToCsv, analyseAero, coefficientsAt, groundEffectSweep, illustrativeAeroMap, illustrativeWingConfigurations, interpolate, parseAeroMapCsv, validateAeroMap, type AeroMap } from './aero'
import { analyseBraking, illustrativeBrakingInputs } from './braking'
import { quantity, unknown } from './quantity'

/** 2×2 map with known corner values for exact bilinear checks. */
const small: AeroMap = { name: 'test', frontRideHeights: [10, 30], rearRideHeights: [50, 90], clA: [[1, 2], [3, 5]], cdA: [[0.5, 0.6], [0.7, 0.9]], balance: [[0.4, 0.45], [0.5, 0.6]], provenance: 'SOURCED', source: 'test fixture' }
const src = (value: number, unit: string) => quantity(value, unit, 'SOURCED', { source: 'test' })

describe('aero map', () => {
  it('interpolates exactly at nodes and bilinearly between them', () => {
    expect(interpolate(small, small.clA, 10, 50).value).toBe(1)
    expect(interpolate(small, small.clA, 30, 90).value).toBe(5)
    expect(interpolate(small, small.clA, 20, 70).value).toBeCloseTo((1 + 2 + 3 + 5) / 4)
    expect(interpolate(small, small.clA, 20, 50).value).toBeCloseTo(2)
  })

  it('clamps outside the map instead of extrapolating, and flags it', () => {
    const out = interpolate(small, small.clA, 0, 200)
    expect(out).toEqual({ value: 2, clamped: true })
    expect(analyseAero(small, { airDensity: src(1.2, 'kg/m³'), speed: src(100, 'km/h'), wheelbase: unknown('m'), frontRideHeight: 0, rearRideHeight: 50 }).warnings[0]).toMatch(/clamped/)
  })

  it('validates axes, grids, ranges and sources', () => {
    expect(validateAeroMap(small)).toEqual([])
    expect(validateAeroMap({ ...small, frontRideHeights: [30, 10] })).toContain('Front ride heights must increase strictly')
    expect(validateAeroMap({ ...small, balance: [[0.4, 1.4], [0.5, 0.6]] })).toContain('Balance must be between 0 and 1')
    expect(validateAeroMap({ ...small, source: '' })).toContain('A SOURCED map needs a source record')
    expect(validateAeroMap(illustrativeAeroMap())).toEqual([])
  })

  it('round-trips through CSV and reports missing or duplicate points', () => {
    const parsed = parseAeroMapCsv(aeroMapToCsv(small), { name: 'test', provenance: 'SOURCED', source: 'test fixture' })
    expect(parsed.errors).toEqual([])
    expect(parsed.map).toEqual(small)
    const missing = aeroMapToCsv(small).split('\n').slice(0, -1).join('\n')
    expect(parseAeroMapCsv(missing, { name: 'x', provenance: 'ESTIMATED' }).errors[0]).toMatch(/Missing point at front 30 mm, rear 90 mm/)
    expect(parseAeroMapCsv('10,50,1,0.5\n', { name: 'x', provenance: 'ESTIMATED' }).errors[0]).toMatch(/five numbers/)
  })
})

describe('aero forces', () => {
  const inputs = { airDensity: src(1.2, 'kg/m³'), speed: src(180, 'km/h'), wheelbase: src(3.6, 'm'), frontRideHeight: 10, rearRideHeight: 50 }
  it('applies F = ½ρv²·CA and splits downforce by balance', () => {
    const q = 0.5 * 1.2 * 50 * 50
    const r = analyseAero(small, inputs)
    expect(r.downforce.value).toBeCloseTo(q * 1)
    expect(r.drag.value).toBeCloseTo(q * 0.5)
    expect(r.frontDownforce.value! + r.rearDownforce.value!).toBeCloseTo(r.downforce.value!)
    expect(r.frontDownforce.value).toBeCloseTo(q * 0.4)
    expect(r.liftToDrag.value).toBeCloseTo(2)
    expect(r.dragPower.value).toBeCloseTo(q * 0.5 * 50)
    expect(r.copFromRearAxle.value).toBeCloseTo(0.4 * 3.6)
    expect(r.downforce.provenance).toBe('DERIVED')
  })

  it('needs speed and density for forces but not for coefficients', () => {
    const r = analyseAero(small, { ...inputs, speed: unknown('km/h') })
    expect(r.downforce).toMatchObject({ value: null, missing: ['speed'] })
    expect(r.liftToDrag.value).toBeCloseTo(2)
  })

  it('applies wing deltas and downgrades provenance to the weakest source', () => {
    const [, lowDrag] = illustrativeWingConfigurations()
    const c = coefficientsAt(small, 10, 50, lowDrag)
    expect(c.clA).toBeCloseTo(1 - 0.6)
    expect(c.cdA).toBeCloseTo(0.5 - 0.18)
    expect(c.balance).toBeCloseTo(0.44)
    expect(c.provenance).toBe('ILLUSTRATIVE')
  })

  it('reports ride-height sensitivity with the right signs on a known map', () => {
    const r = analyseAero(small, { ...inputs, frontRideHeight: 20, rearRideHeight: 70 })
    expect(r.sensitivity.dClA_dFront).toBeCloseTo(((3 + 5) / 2 - (1 + 2) / 2) / 20)
    expect(r.sensitivity.dClA_dRear).toBeCloseTo(((2 + 5) / 2 - (1 + 3) / 2) / 40)
  })

  it('finds the ground-effect peak of the demo map inside its range', () => {
    const sweep = groundEffectSweep(illustrativeAeroMap(), 30, 80)
    const peak = Math.max(...sweep.clA)
    expect(sweep.clA[0]).toBeLessThan(peak)
    expect(sweep.clA[sweep.clA.length - 1]).toBeLessThan(peak)
  })
})

describe('aero handoff to braking', () => {
  it('passes coefficients with provenance, and the braking lab uses them', () => {
    const handoff = aeroForBraking(small, 20, 70)
    expect(handoff.clA).toMatchObject({ value: (1 + 2 + 3 + 5) / 4, provenance: 'DERIVED' })
    expect(handoff.clA.source).toMatch(/aero map "test"/)
    const braking = analyseBraking({ ...illustrativeBrakingInputs(), ...handoff })
    expect(braking.model).toBe('aero')
  })
})
