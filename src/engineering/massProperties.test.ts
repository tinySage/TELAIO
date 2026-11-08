import { describe, expect, it } from 'vitest'
import { parts } from '../model/components'
import { derivedProvenance, gather, quantity, quantityIssues, unknown, parseQuantity } from './quantity'
import { ballastForTarget, compareMassReports, computeMassProperties, illustrativeDemoConfiguration, newMassConfiguration, parseMassConfigurations, MASS_CONFIG_STORAGE_KEY } from './massProperties'

const pos = (id: string) => parts.find((part) => part.id === id)!.position
const allIds = parts.map((part) => part.id)

describe('provenance rules', () => {
  it('a result is only as good as its weakest input', () => {
    expect(derivedProvenance(['SOURCED', 'SOURCED'])).toBe('DERIVED')
    expect(derivedProvenance(['SOURCED', 'DERIVED'])).toBe('DERIVED')
    expect(derivedProvenance(['SOURCED', 'ESTIMATED'])).toBe('ESTIMATED')
    expect(derivedProvenance(['ESTIMATED', 'ILLUSTRATIVE'])).toBe('ILLUSTRATIVE')
    expect(derivedProvenance(['SOURCED', 'UNKNOWN'])).toBe('UNKNOWN')
  })

  it('demands a source for SOURCED and assumptions for ESTIMATED values', () => {
    expect(quantityIssues(quantity(5, 'kg', 'SOURCED'), 'x')).toHaveLength(1)
    expect(quantityIssues(quantity(5, 'kg', 'SOURCED', { source: 'Datasheet rev B' }), 'x')).toEqual([])
    expect(quantityIssues(quantity(5, 'kg', 'ESTIMATED'), 'x')).toHaveLength(1)
    expect(quantityIssues(unknown('kg'), 'x')).toEqual([])
  })

  it('gathers known inputs and names the missing ones', () => {
    expect(gather({ a: quantity(1, 'kg', 'SOURCED', { source: 's' }), b: unknown('kg') })).toMatchObject({ values: { a: 1 }, missing: ['b'] })
  })

  it('parses stored quantities defensively', () => {
    expect(parseQuantity({ value: 'heavy', provenance: 'SOURCED' }, 'kg')).toMatchObject({ value: null, provenance: 'UNKNOWN' })
    expect(parseQuantity({ value: 3, provenance: 'MADE-UP' }, 'kg').provenance).toBe('UNKNOWN')
  })
})

describe('mass properties', () => {
  const two = ['wheel-tyre', 'rear-left-wheel']
  const sourced = (value: number) => quantity(value, 'kg', 'SOURCED', { source: 'test fixture' })

  it('is UNKNOWN until every included component has a mass, and says which are missing', () => {
    const report = computeMassProperties(newMassConfiguration('c', 'C'), parts, two)
    expect(report.totalMass).toMatchObject({ value: null, provenance: 'UNKNOWN' })
    expect(report.missing.sort()).toEqual([...two].sort())
  })

  it('computes total mass, CoG and the axle split for two point masses', () => {
    const config = { ...newMassConfiguration('c', 'C'), masses: { 'wheel-tyre': sourced(10), 'rear-left-wheel': sourced(30) } }
    const report = computeMassProperties(config, parts, two)
    expect(report.totalMass).toMatchObject({ value: 40, provenance: 'DERIVED' })
    const [f, r] = [pos('wheel-tyre'), pos('rear-left-wheel')]
    expect(report.cog.value![0]).toBeCloseTo((10 * f[0] + 30 * r[0]) / 40)
    expect(report.frontFraction.value).toBeCloseTo(0.25)
    expect(report.cogMetres.value).toBeNull()
    expect(report.cogMetres.missing).toContain('scale')
  })

  it('needs a scale for metres and inertia; a two-mass dumbbell gives textbook inertia', () => {
    const config = { ...newMassConfiguration('c', 'C'), masses: { 'wheel-tyre': sourced(10), 'front-right-wheel': sourced(10) }, scale: quantity(2, 'm/su', 'SOURCED', { source: 'test' }) }
    const report = computeMassProperties(config, parts, ['wheel-tyre', 'front-right-wheel'])
    const d = pos('wheel-tyre')[2] * 2 // half-track in metres
    const I = report.inertia.value!
    expect(I[0][0]).toBeCloseTo(2 * 10 * d * d)
    expect(I[1][1]).toBeCloseTo(2 * 10 * d * d)
    expect(I[2][2]).toBeCloseTo(0)
    expect(I[0][1]).toBeCloseTo(0)
    expect(report.inertia.provenance).toBe('ILLUSTRATIVE')
  })

  it('keeps total mass DERIVED but labels position-based results ILLUSTRATIVE, because the study geometry is not to scale', () => {
    const config = { ...newMassConfiguration('c', 'C'), masses: { 'wheel-tyre': sourced(10), 'rear-left-wheel': sourced(30) } }
    const report = computeMassProperties(config, parts, two)
    expect(report.totalMass.provenance).toBe('DERIVED')
    expect(report.cog.provenance).toBe('ILLUSTRATIVE')
    expect(report.frontFraction.provenance).toBe('ILLUSTRATIVE')
    expect(report.frontFraction.assumptions.some((a) => a.includes('not to scale'))).toBe(true)
  })

  it('downgrades the result to the weakest input and records exclusions as assumptions', () => {
    const config = { ...newMassConfiguration('c', 'C'), masses: { 'wheel-tyre': sourced(10), 'rear-left-wheel': quantity(30, 'kg', 'ESTIMATED', { note: 'scaled from similar car' }) }, excluded: { halo: 'negligible for this study' } }
    const report = computeMassProperties(config, parts, [...two, 'halo'])
    expect(report.totalMass.provenance).toBe('ESTIMATED')
    expect(report.totalMass.assumptions.some((a) => a.includes('halo (negligible for this study)'))).toBe(true)
  })

  it('finds the ballast that hits a target axle split, and adding it lands on the target', () => {
    const config = { ...newMassConfiguration('c', 'C'), masses: { 'wheel-tyre': sourced(10), 'rear-left-wheel': sourced(30) } }
    const report = computeMassProperties(config, parts, two)
    const x = pos('wheel-tyre')[0]
    const needed = ballastForTarget(report, x, 0.4)!
    expect(needed).toBeCloseTo(10)
    const withBallast = computeMassProperties({ ...config, ballast: [{ id: 'b', label: 'B', mass: sourced(needed), position: [x, 0, 0] }] }, parts, two)
    expect(withBallast.frontFraction.value).toBeCloseTo(0.4)
    expect(ballastForTarget(report, pos('rear-left-wheel')[0], 0.4)).toBeNull()
    const cmp = compareMassReports(report, withBallast)
    expect(cmp.deltaMass).toBeCloseTo(needed)
    expect(cmp.deltaFrontFraction).toBeCloseTo(0.15)
  })

  it('runs the opt-in illustrative demo end to end, labelled ILLUSTRATIVE', () => {
    const report = computeMassProperties(illustrativeDemoConfiguration(parts, 'demo'), parts, allIds)
    expect(report.missing).toEqual([])
    expect(report.totalMass.provenance).toBe('ILLUSTRATIVE')
    expect(report.frontFraction.value).toBeGreaterThan(0.3)
    expect(report.frontFraction.value).toBeLessThan(0.6)
    expect(report.inertia.value).not.toBeNull()
  })

  it('round-trips configurations through storage and drops unknown IDs', () => {
    const demo = illustrativeDemoConfiguration(parts, 'demo')
    const tampered = JSON.parse(JSON.stringify([demo]))
    tampered[0].masses['warp-core'] = { value: 1, provenance: 'SOURCED' }
    const parsed = parseMassConfigurations(JSON.stringify(tampered), new Set(allIds))
    expect(parsed.configurations[0]).toEqual(demo)
    expect(parsed.warnings).toHaveLength(1)
    expect(MASS_CONFIG_STORAGE_KEY).toMatch(/v1$/)
  })
})
